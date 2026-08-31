"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BANNED_PHRASES } from "../../data/banned-phrases.js";
import { CHANNELS } from "../../data/channels.js";
import { generateWithAI } from "../../lib/copyai.js";
import { analyzeCustomBlogStyle } from "./_lib/customBlogStyle.js";
import {
  copyChatContextKey,
  getMemorySummary,
} from "../../lib/copymemory.js";
import { coreWithOutline, outlineKeyOf } from "../../lib/outline.js";
import { findBanned, TONE_LABEL } from "../../lib/copywriter.js";
import { saveToLibrary } from "../../lib/librarystore.js";
import { loadLocalConfig } from "../../lib/localconfig.js";
import { getProduct, loadProducts } from "../../lib/products.js";
import { getState, setState, STEPS, subscribe } from "../../store.js";
import { toast } from "../../components/toast.js";
import { LoadingScreen } from "../_components/LoadingScreen.jsx";
import { Icon } from "../_components/Icon.jsx";
import { AiRunSelector } from "../_components/text/AiRunSelector.jsx";
import { ChannelTabs } from "../_components/text/ChannelTabs.jsx";
// import { CopyActions } from "../_components/text/CopyActions.jsx";
import { CopyEditor } from "../_components/text/CopyEditor.jsx";
import { TextStepper } from "../_components/text/TextStepper.jsx";
import { GenerationSummary } from "./_components/GenerationSummary.jsx";

const runsKeyOf = (state) =>
  `${state.productId}|${String(state.topic || "").trim()}|${String(state.focusPoint || "").trim()}|${state.tone}|${state.tone === "custom" ? String(state.customStyleUrl || "").trim() : ""}|${JSON.stringify(state.contentOutline || null)}`;

/** 이 채널의 글을 담고 있는 AI 생성 벌들을, 원래 `aiRuns.list` 안 위치를 지킨 채로 골라낸다. */
function aiRunsForChannel(state, channelId) {
  if (!state || state.aiRuns?.key !== runsKeyOf(state)) return [];
  return (state.aiRuns?.list || [])
    .map((run, index) => ({ run, index }))
    .filter(({ run }) => Object.hasOwn(run.drafts || {}, channelId));
}

const contentOutlineKeyOf = (contentOutline) =>
  contentOutline ? JSON.stringify(contentOutline) : "";

const outlineJobs = new Map();

/**
 * 채널 글을 쓰기 전에 주제 뼈대(core)를 먼저 만든다.
 *
 * 세 채널이 각자 알아서 주제를 쪼개면 서로 다른 이야기를 하게 되므로, 뼈대를 한 번만
 * AI로 만들어(`coreWithOutline`) 모든 채널이 같은 것을 보게 한다 (CLAUDE.md 8-8 참고).
 * 조건(상품·주제·톤·라운드·뼈대잡기 초안)이 그대로면 다시 만들지 않는다 — 있는 뼈대를
 * 또 사면 돈만 쓴다.
 *
 * ⚠️ `state.contentOutline`(홈 화면의 뼈대잡기 모달에서 담당자가 다듬은 서론/본론/결론
 *    초안)은 여기서 `coreWithOutline`에 **참고 자료**로 함께 넘어간다 — 강제 지시가 아니라
 *    각도·항목을 짤 때 반영하는 재료다. 초안이 바뀌면(`contentOutlineKey`) 캐시된 뼈대를
 *    다시 만든다.
 */
async function ensureOutline(
  state,
  { round = 0, researchStyle = "", signal, waitIfPaused } = {},
) {
  const key = outlineKeyOf(state);
  const contentOutlineKey = contentOutlineKeyOf(state.contentOutline);
  if (
    state.outline?.key === key &&
    (state.outline.round || 0) === round &&
    (state.outline.contentOutlineKey || "") === contentOutlineKey
  ) {
    return { core: state.outline.core, error: null };
  }

  const jobKey = `${key}|r${round}|c${contentOutlineKey}`;
  if (outlineJobs.has(jobKey)) return outlineJobs.get(jobKey);

  // 직전 라운드의 소제목을 넘겨 AI 2 이후가 같은 구성을 다시 짜지 못하게 한다.
  const pastHeads =
    state.outline?.key === key ? state.outline.pastHeads || [] : [];
  const avoid = [
    ...new Set([
      ...pastHeads,
      ...(state.outline?.key === key
        ? (state.outline.core?.points || []).map((x) => x.q)
        : []),
    ]),
  ].filter(Boolean);

  const job = coreWithOutline(
    {
      product: getProduct(state.productId),
      topic: state.topic.trim(),
      focusPoint: String(state.focusPoint || "").trim(),
      tone: state.tone,
      cardCount: state.cardCount,
      round,
      avoid,
      researchStyle,
      contentOutline: state.contentOutline || null,
    },
    { signal, waitIfPaused },
  )
    .then(({ core, error }) => {
      const latest = getState();
      if (
        !error &&
        (latest.outline?.key !== key || (latest.outline.round || 0) <= round)
      ) {
        setState({
          outline: { key, round, core, pastHeads: avoid, contentOutlineKey },
        });
      }
      return { core: error ? null : core, error };
    })
    .finally(() => outlineJobs.delete(jobKey));
  outlineJobs.set(jobKey, job);
  return job;
}

export default function CopyPage() {
  const router = useRouter();
  const [state, setViewState] = useState(null);
  const [activeId, setActiveId] = useState("");
  const [readMode, setReadMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(null);
  const [productsReady, setProductsReady] = useState(false);
  const generationController = useRef(null);
  const pausedRef = useRef(false);
  const pauseWaiters = useRef([]);

  useEffect(() => {
    setViewState(getState());
    const unsubscribe = subscribe(setViewState);
    Promise.all([loadLocalConfig(), loadProducts()]).finally(() =>
      setProductsReady(true),
    );
    return unsubscribe;
  }, []);

  useEffect(() => () => generationController.current?.abort(), []);

  function waitIfPaused() {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise((resolve) => pauseWaiters.current.push(resolve));
  }

  function toggleGenerationPause() {
    if (!busy) return;
    pausedRef.current = !pausedRef.current;
    setGeneration((current) =>
      current ? { ...current, paused: pausedRef.current } : current,
    );
    if (!pausedRef.current) {
      pauseWaiters.current.splice(0).forEach((resolve) => resolve());
    }
  }

  function cancelGeneration() {
    if (!busy) return;
    pausedRef.current = false;
    pauseWaiters.current.splice(0).forEach((resolve) => resolve());
    generationController.current?.abort();
  }

  const channels = useMemo(
    () => CHANNELS.filter((channel) => state?.channels?.includes(channel.id)),
    [state?.channels],
  );

  useEffect(() => {
    if (!state) return;
    if (!state.productId || !state.topic?.trim()) {
      router.replace("/");
      return;
    }
    if (!channels.some((channel) => channel.id === activeId)) {
      setActiveId(channels[0]?.id || "");
    }
  }, [activeId, channels, router, state]);

  const activeChannel = channels.find((channel) => channel.id === activeId);
  const product = state ? getProduct(state.productId) : null;
  const matchingRuns = useMemo(
    () => aiRunsForChannel(state, activeId),
    [activeId, state],
  );
  const activeRun =
    typeof state?.activeAiRun === "object"
      ? (state.activeAiRun?.[activeId] ?? null)
      : (state?.activeAiRun ?? null);
  const activeRunEntry = matchingRuns[activeRun];
  const chatContextKey = activeRunEntry
    ? copyChatContextKey(state.aiRuns.key, activeId, activeRun)
    : "";

  function updateDraft(value) {
    const current = getState();
    const patch = { drafts: { ...current.drafts, [activeId]: value } };
    const entry = matchingRuns[activeRun];
    if (entry) {
      patch.aiRuns = {
        ...current.aiRuns,
        list: current.aiRuns.list.map((run, index) =>
          index === entry.index
            ? { ...run, drafts: { ...run.drafts, [activeId]: value } }
            : run,
        ),
      };
    }
    setState(patch);
  }

  async function generate(channelIds) {
    if (!product || busy) return;
    const controller = new AbortController();
    generationController.current = controller;
    pausedRef.current = false;
    setGeneration({ current: 0, total: channelIds.length, paused: false });
    setBusy(true);
    try {
      const current = getState();
      const style = (current.styles || []).find(
        (item) => item.id === current.styleId,
      );
      let researchStyle = style?.guide || "";
      if (current.tone === "custom") {
        const customUrl = String(current.customStyleUrl || "").trim();
        if (!customUrl)
          throw new Error("참고할 블로그 글 링크를 입력해 주세요.");
        if (
          current.customStyleGuideUrl === customUrl &&
          current.customStyleGuide
        ) {
          researchStyle = current.customStyleGuide;
        } else {
          toast("블로그 글 스타일을 확인하고 있습니다.");
          researchStyle = await analyzeCustomBlogStyle(customUrl);
          setState({
            customStyleGuide: researchStyle,
            customStyleGuideUrl: customUrl,
          });
        }
        if (current.customStyleSaveRequested) {
          const latest = getState();
          const existing = (latest.styles || []).find((item) =>
            (item.sources || []).includes(customUrl),
          );
          if (existing) {
            setState({
              styles: (latest.styles || []).map((item) =>
                item.id === existing.id
                  ? { ...item, guide: researchStyle, at: Date.now() }
                  : item,
              ),
              styleId: existing.id,
              customStyleSaveRequested: false,
            });
            toast("이미 저장된 글 스타일을 최신 분석으로 업데이트했습니다.");
          } else {
            const used = new Set(
              (latest.styles || []).map((item) => {
                const match = String(item.name || "").match(/^\((\d+)\)$/);
                return match ? Number(match[1]) : 0;
              }),
            );
            let number = 1;
            while (used.has(number)) number += 1;
            const entry = {
              id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name: `(${number})`,
              guide: researchStyle,
              at: Date.now(),
              sources: [customUrl],
            };
            setState({
              styles: [entry, ...(latest.styles || [])].slice(0, 12),
              styleId: entry.id,
              customStyleSaveRequested: false,
            });
            toast(`글 스타일 ${entry.name}을 마이페이지에 저장했습니다.`);
          }
        }
      }

      // 채널 글을 쓰기 전에 주제 뼈대(core)를 먼저 만든다 — 세 채널이 같은 뼈대를 봐야
      // 내용이 통일된다. AI 1/2/3... 몇 번째 벌인지(round)에 따라 뼈대도 새로 짠다.
      const round = Math.max(
        0,
        ...channelIds.map((id) => aiRunsForChannel(current, id).length),
      );
      const { core, error: outlineError } = await ensureOutline(current, {
        round,
        researchStyle,
        signal: controller.signal,
        waitIfPaused,
      });
      if (outlineError) {
        toast(`AI 주제 구성을 만들지 못했습니다 — ${outlineError}`, 5000);
        return;
      }

      // 챗봇에서 정리된 이 사용자의 스타일 메모 — 있으면 채널 프롬프트에 참고로 들어간다.
      const memory = await getMemorySummary().catch(() => null);

      const drafts = {};
      for (let index = 0; index < channelIds.length; index++) {
        await waitIfPaused();
        if (controller.signal.aborted) {
          throw new DOMException("취소되었습니다.", "AbortError");
        }
        const channelId = channelIds[index];
        setGeneration((current) => ({
          ...current,
          current: index + 1,
          channelName:
            CHANNELS.find((channel) => channel.id === channelId)?.name ||
            channelId,
        }));
        drafts[channelId] = await generateWithAI(
          channelId,
          {
            product,
            topic: current.topic.trim(),
            focusPoint: String(current.focusPoint || "").trim(),
            tone: current.tone,
            variant: (current.variants?.[channelId] || 0) + 1,
            cardCount: current.cardCount,
            core,
            contentOutline: current.contentOutline || null,
            researchStyle,
            userMemory: memory?.summary || "",
          },
          {
            signal: controller.signal,
            waitIfPaused,
          },
        );
      }
      const latest = getState();
      const run = { drafts, generated: { ...drafts } };
      const sameKey = latest.aiRuns?.key === runsKeyOf(latest);
      const list = sameKey ? [...(latest.aiRuns?.list || []), run] : [run];
      const activeAiRun =
        typeof latest.activeAiRun === "object" && latest.activeAiRun
          ? { ...latest.activeAiRun }
          : {};
      channelIds.forEach((id) => {
        const channelRunIndex =
          list.filter((item) => Object.hasOwn(item.drafts || {}, id)).length -
          1;
        activeAiRun[id] = channelRunIndex;
      });
      setState({
        drafts: { ...latest.drafts, ...drafts },
        generated: { ...latest.generated, ...drafts },
        sources: {
          ...latest.sources,
          ...Object.fromEntries(channelIds.map((id) => [id, "ai"])),
        },
        variants: {
          ...latest.variants,
          ...Object.fromEntries(
            channelIds.map((id) => [id, (latest.variants?.[id] || 0) + 1]),
          ),
        },
        aiRuns: {
          key: runsKeyOf(latest),
          groupId: sameKey ? latest.aiRuns?.groupId : undefined,
          list,
        },
        activeAiRun,
        card: null,
      });
      const saved = await saveToLibrary(getState());
      if (!saved.ok) toast(`자동 저장 실패 · ${saved.error}`, 6000);
      toast(`${channelIds.length}개 채널 글을 만들었습니다.`);
    } catch (error) {
      if (error?.name === "AbortError") {
        toast("AI 생성을 취소했습니다.");
        return;
      }
      console.error(error);
      toast(error?.message || "AI 글 생성에 실패했습니다.");
    } finally {
      generationController.current = null;
      pausedRef.current = false;
      pauseWaiters.current.splice(0).forEach((resolve) => resolve());
      setGeneration(null);
      setBusy(false);
    }
  }

  function selectRun(index) {
    const entry = matchingRuns[index];
    if (!entry) return;
    const current = getState();
    setState({
      drafts: { ...current.drafts, [activeId]: entry.run.drafts[activeId] },
      generated: {
        ...current.generated,
        [activeId]: entry.run.generated[activeId],
      },
      sources: { ...current.sources, [activeId]: "ai" },
      activeAiRun: {
        ...(typeof current.activeAiRun === "object" ? current.activeAiRun : {}),
        [activeId]: index,
      },
      card: null,
    });
  }

  async function copy(text, message) {
    if (!text?.trim()) return toast("복사할 내용이 없습니다.");
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast("복사하지 못했습니다. 내용을 직접 선택해 주세요.");
    }
  }

  function moveToTemplate() {
    const hasGeneratedPost = channels.some((channel) =>
      String(getState().generated?.[channel.id] || "").trim(),
    );
    if (!hasGeneratedPost) {
      toast("글 생성 후 이동할 수 있습니다.");
      return;
    }
    router.push("/template");
  }

  if (!state || !productsReady || !activeChannel) return <LoadingScreen />;
  const value = state.drafts?.[activeId] || "";
  return (
    <main className="min-h-dvh bg-[#1a1a1a] pb-[140px] text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <div className="flex min-h-[1050px] items-stretch overflow-clip rounded-[15px] bg-white/10 max-[860px]:min-h-0 max-[860px]:flex-col">
          <TextStepper steps={STEPS} activeIndex={1} />
          <div className="min-w-0 flex-1 px-[clamp(24px,4vw,56px)] py-14">
            <header className="flex items-end gap-[14px] mb-8">
              <h1 className="text-[32px] font-bold tracking-[-0.04em] text-white">
                {Object.keys(state.drafts || {}).length
                  ? "상품의 글을 생성해보세요."
                  : "상품의 글을 생성해보세요."}
              </h1>
              <p className="mb-2 text-white/55">
                AI 생성 결과는 주제와 채널별로 계속 쌓입니다.
              </p>
            </header>
            <div className="space-y-5">
              <GenerationSummary
                productName={product?.name}
                topic={state.topic}
                focusPoint={state.focusPoint}
                writingStyle={TONE_LABEL[state.tone] || state.tone}
                onEditConditions={() => router.push("/")}
                onNext={moveToTemplate}
              />
              <div className="overflow-clip rounded-[15px] bg-[#595959]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-[21px] py-[33px]">
                  <ChannelTabs
                    channels={channels}
                    activeId={activeId}
                    onSelect={setActiveId}
                  />
                  <div className="flex min-w-[310px] flex-col items-end gap-3 max-[640px]:w-full max-[640px]:items-stretch">
                    <div className="flex flex-wrap justify-end gap-2.5">
                      <button
                        disabled={busy}
                        onClick={() => generate([activeId])}
                        className="inline-flex h-[45px] items-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] text-[15px] font-medium text-[#4e5968] disabled:opacity-40"
                      >
                        <Icon name="sparkles" className="size-[18px]" />
                        현재 채널만 AI 생성
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          generate(channels.map((channel) => channel.id))
                        }
                        className="inline-flex h-[45px] items-center gap-[5px] rounded-full border border-[#287aff] bg-[#287aff] px-[19px] text-[15px] font-bold text-white disabled:opacity-40"
                      >
                        <Icon name="sparkles" className="size-[18px]" />
                        전체 채널 AI 생성
                      </button>
                    </div>
                  </div>
                </div>
                <CopyEditor
                  channel={activeChannel}
                  value={value}
                  generatedValue={state.generated?.[activeId] || ""}
                  readMode={readMode}
                  banned={findBanned(value, BANNED_PHRASES)}
                  showChat={Boolean(state.aiRuns?.list?.length)}
                  chatContextKey={chatContextKey}
                  draftLabel={activeRun == null ? "" : `시안 ${activeRun + 1}`}
                  generation={busy ? generation : null}
                  onToggleGenerationPause={toggleGenerationPause}
                  onCancelGeneration={cancelGeneration}
                  runSelector={
                    <AiRunSelector
                      runs={matchingRuns}
                      activeIndex={activeRun}
                      onSelect={selectRun}
                    />
                  }
                  onChange={updateDraft}
                  onToggleMode={() => setReadMode((mode) => !mode)}
                  onCopy={() =>
                    copy(value, `${activeChannel.name} 글귀를 복사했습니다.`)
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        id="toast-root"
        className="toast-root"
        role="status"
        aria-live="polite"
      />
    </main>
  );
}
