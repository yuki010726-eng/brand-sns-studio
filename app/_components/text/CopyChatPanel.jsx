"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon.jsx";
import { getUser, onAuth } from "../../../lib/auth.js";
import { toast } from "../../../components/toast.js";
import {
  clearMemory,
  getMemorySummary,
  loadMessages,
  refreshSummary,
  reviseDraftWithChat,
  saveMemorySummary,
  saveMessage,
  sendChat,
} from "../../../lib/copymemory.js";

/**
 * 글쓰기 스타일 챗봇 — CopyEditor 오른쪽에 붙는 개인 전용 패널.
 *
 * 여기서 나눈 대화는 Supabase 에 쌓이고, 매 대화 뒤 짧게 다시 쓴 요약으로 남는다.
 * 요약은 상품·주제와 무관하게 "이 사용자가 어떤 글을 좋아하는지"만 다루고,
 * `lib/copyai.js` 의 프롬프트에 자동으로 들어간다(`app/text/page.jsx` 의 `generate()`) —
 * 그래서 예전에는 "AI 생성"을 다시 눌러야 다음 시안에서야 반영되는 느낌이었다.
 *
 * ⚠️ 그것과 별개로, 지금 보고 있는 시안(`draftValue`)에도 요청을 바로 반영한다
 *    (요청자 지시 2026-08-26). 채널·현재 시안·적용 콜백을 부모(app/text/page.jsx →
 *    CopyEditor)로부터 props 로 받는다 — 그래야 어느 채널·어느 시안을 고치는지 안다.
 */
export function CopyChatPanel({ channelId, channelName, draftValue, onApplyToDraft }) {
  const [loggedIn, setLoggedIn] = useState(Boolean(getUser()));
  const [messages, setMessages] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => onAuth((user) => setLoggedIn(Boolean(user))), []);

  useEffect(() => {
    if (!loggedIn) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    Promise.all([loadMessages(), getMemorySummary()]).then(([history, mem]) => {
      if (cancelled) return;
      setMessages(
        history.map((m) => ({ id: m.id, role: m.role, content: m.content })),
      );
      setSummary(mem || null);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const userMsg = { id: `local-${Date.now()}`, role: "user", content: text };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setSending(true);
    saveMessage("user", text);

    // 지금 보고 있는 시안이 있으면, 요약과는 별개로 이 요청을 그 시안에도 바로 반영해 본다.
    // 챗봇 답변과 동시에 부르는 이유는 둘이 서로 다른 자료(대화 vs 원고)를 보고 하는
    // 별개의 작업이라 기다릴 이유가 없어서다.
    const revisePromise = draftValue?.trim()
      ? reviseDraftWithChat(text, draftValue, channelId).catch((error) => {
          console.warn("[copy-chat] 시안 반영 실패", error);
          return null;
        })
      : Promise.resolve(null);

    try {
      const [reply, revisedDraft] = await Promise.all([sendChat(withUser), revisePromise]);
      const botMsg = {
        id: `local-${Date.now()}-a`,
        role: "assistant",
        content: reply,
        applied: Boolean(revisedDraft),
      };
      const withReply = [...withUser, botMsg];
      setMessages(withReply);
      saveMessage("assistant", reply);

      if (revisedDraft) {
        onApplyToDraft?.(revisedDraft);
        toast(
          `${channelName ? `${channelName} ` : ""}지금 보던 시안에 요청하신 내용을 반영했습니다.`,
        );
      }

      // 요약은 화면을 막지 않고 뒤에서 갱신한다 — 다음 AI 생성부터 반영되면 충분하다.
      refreshSummary(summary?.summary || "", withReply)
        .then((nextSummary) => {
          setSummary({ summary: nextSummary, message_count: withReply.length });
          return saveMemorySummary(nextSummary, withReply.length);
        })
        .catch((error) => console.warn("[copy-chat] 요약 갱신 실패", error));
    } catch (error) {
      toast(error?.message || "챗봇 응답을 받지 못했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function handleReset() {
    if (!messages.length && !summary?.summary) return;
    if (
      !window.confirm(
        "대화 이력과 스타일 메모를 모두 지울까요? 되돌릴 수 없습니다.",
      )
    )
      return;
    const result = await clearMemory();
    if (!result.ok && !result.skipped) {
      toast(`초기화 실패 · ${result.error}`);
      return;
    }
    setMessages([]);
    setSummary(null);
    toast("스타일 메모를 초기화했습니다.");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <aside className="flex w-[320px] shrink-0 flex-col rounded-xl border border-[#e5e8eb] bg-white max-[1100px]:w-full">
      <header className="flex items-start justify-between gap-2 border-b border-[#e5e8eb] px-4 py-3.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-[#333d4b]">
            <Icon name="chat" className="size-4 text-[#287aff]" />
            글쓰기 스타일 챗봇
          </p>
          <p className="mt-1 text-xs leading-5 text-[#8b95a1]">
            지금 보고 있는 시안에 바로 반영되고, 다음 AI 글 생성에도 참고됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          aria-label="스타일 메모 초기화"
          className="shrink-0 rounded-full p-1.5 text-[#8b95a1] hover:bg-[#f2f4f6] hover:text-[#4e5968]"
        >
          <Icon name="trash" className="size-4" />
        </button>
      </header>

      <div className="border-b border-[#e5e8eb] px-4 py-2.5">
        <button
          type="button"
          onClick={() => setShowSummary((v) => !v)}
          className="flex w-full items-center justify-between text-left text-xs font-semibold text-[#4e5968]"
        >
          <span>
            현재 기억된 스타일 {summary?.summary ? "" : "(아직 없음)"}
          </span>
          <Icon
            name="chevronRight"
            className={`size-3.5 transition-transform ${showSummary ? "rotate-90" : ""}`}
          />
        </button>
        {showSummary && (
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-[22px] text-[#4e5968]">
            {summary?.summary ||
              "대화를 나누면 이 사용자만의 글쓰기 스타일이 여기에 정리됩니다."}
          </p>
        )}
      </div>

      {!loggedIn ? (
        <p className="flex-1 px-4 py-8 text-center text-[13px] leading-6 text-[#8b95a1]">
          로그인하면 대화가 저장되고 다음 글 생성에 참고됩니다.
        </p>
      ) : (
        <>
          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
            style={{ minHeight: 360, maxHeight: 560 }}
          >
            {!ready ? (
              <p className="text-center text-xs text-[#8b95a1]">불러오는 중…</p>
            ) : messages.length === 0 ? (
              <p className="text-[13px] leading-6 text-[#8b95a1]">
                평소 좋아하는 말투나 피하고 싶은 표현을 이야기해 보세요. 예)
                "너무 딱딱하지 않게, 문장은 짧게 끊어 써 줘."
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "ml-auto max-w-[92%]" : "max-w-[92%]"}>
                  <div
                    className={`rounded-xl px-3 py-2 text-[13px] leading-[21px] ${
                      m.role === "user"
                        ? "bg-[#287aff] text-white"
                        : "bg-[#f2f4f6] text-[#333d4b]"
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.applied && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#287aff]">
                      <Icon name="check" className="size-3" />
                      지금 보던 시안에 반영함
                    </p>
                  )}
                </div>
              ))
            )}
            {sending && (
              <div className="max-w-[92%] rounded-xl bg-[#f2f4f6] px-3 py-2 text-[13px] text-[#8b95a1]">
                생각하는 중…
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 border-t border-[#e5e8eb] p-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="스타일에 대해 이야기해 보세요"
              aria-label="스타일 챗봇에게 메시지 보내기"
              className="min-h-[40px] flex-1 resize-none rounded-lg border border-[#e5e8eb] px-3 py-2 text-[13px] leading-5 outline-none focus:ring-2 focus:ring-inset focus:ring-[#287aff]"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !input.trim()}
              aria-label="메시지 보내기"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#287aff] text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="send" className="size-4" />
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
