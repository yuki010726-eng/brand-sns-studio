import { useState } from "react";
import { Icon } from "../Icon.jsx";
import { CopyChatPanel } from "./CopyChatPanel.jsx";
import { CompliancePanel } from "./CompliancePanel.jsx";
import { InstagramPostPreview } from "./InstagramPostPreview.jsx";

const QUOTE_RE = /^\[[^\]]*인용구\]$/;
const SLOT_RE = /^📷\s*\[이미지\s*(\d+)\s*·\s*([^\]]+)\]/;

const ISSUE_UNDERLINE = {
  warning: "decoration-amber-500",
  review: "decoration-orange-600",
  error: "decoration-red-500",
};

function HighlightedText({ text, issues }) {
  const ranges = issues
    .filter((issue) => issue.match)
    .flatMap((issue) => {
      const rangesForIssue = [];
      let start = 0;
      while (start < text.length) {
        const index = text.indexOf(issue.match, start);
        if (index === -1) break;
        rangesForIssue.push({
          start: index,
          end: index + issue.match.length,
          level: issue.level,
        });
        start = index + issue.match.length;
      }
      return rangesForIssue;
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  if (!ranges.length) return text;

  const nodes = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) nodes.push(text.slice(cursor, range.start));
    nodes.push(
      <span
        key={`${range.start}-${range.end}-${range.level}`}
        className={`underline decoration-2 underline-offset-4 ${ISSUE_UNDERLINE[range.level] || ISSUE_UNDERLINE.warning}`}
      >
        {text.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function Preview({ value, issues = [] }) {
  const lines = value.split("\n");
  const nodes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    if (QUOTE_RE.test(line)) {
      const title = [lines[index + 1]?.trim(), lines[index + 2]?.trim()].filter(
        Boolean,
      );
      index += title.length;
      nodes.push(
        <blockquote
          key={`quote-${index}`}
          className="relative mb-[38px] min-h-[76px] px-12 pt-2 text-center font-serif text-[15px] leading-[28px] text-[#4e5968] before:absolute before:left-2 before:top-[-4px] before:text-[44px] before:font-bold before:text-[#c7cbd1] before:content-['“'] after:absolute after:bottom-[-10px] after:left-[68%] after:text-[44px] after:font-bold after:text-[#c7cbd1] after:content-['”']"
        >
          {title.map((text) => (
            <span key={text} className="block">
              <HighlightedText text={text} issues={issues} />
            </span>
          ))}
        </blockquote>,
      );
      continue;
    }

    const slot = line.match(SLOT_RE);
    if (slot) {
      const captionLine = lines[index + 1]?.trim() || "";
      const caption = captionLine.startsWith("⤷")
        ? captionLine.slice(1).trim()
        : "";
      if (caption) index += 1;
      nodes.push(
        <div
          key={`slot-${index}`}
          className="my-[16px] flex min-h-[59px] flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-[#e5e8eb] px-4 py-3"
        >
          <span className="rounded-full bg-[#f2f4f6] px-[11px] py-1 text-xs font-bold leading-[22px] text-[#5f6b7a]">
            이미지 {slot[1]} · {slot[2]}
          </span>
          {caption && (
            <span className="text-[13px] leading-6 text-[#5f6b7a]">
              {caption}
            </span>
          )}
        </div>,
      );
      continue;
    }

    if (line.startsWith("## ")) {
      nodes.push(
        <h3
          key={`head-${index}`}
          className="mb-[24px] mt-[38px] border-l-2 border-[#191f28] pl-3 text-[18px] font-black leading-[26px] text-[#191f28]"
        >
          <HighlightedText text={line.slice(3)} issues={issues} />
        </h3>,
      );
      continue;
    }

    if (/^(#[^#\s]+\s*)+$/.test(line)) {
      nodes.push(
        <div key={`tags-${index}`} className="mt-[30px] flex flex-wrap gap-1.5">
          {line.split(/\s+/).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#f2f4f6] px-2.5 py-1 text-[13px] leading-6 text-[#5f6b7a]"
            >
              {tag}
            </span>
          ))}
        </div>,
      );
      continue;
    }

    nodes.push(
      <p
        key={`text-${index}`}
        className="mb-[16px] whitespace-pre-wrap text-[15px] leading-[28px] text-[#4e5968]"
      >
        <HighlightedText text={line} issues={issues} />
      </p>,
    );
  }
  return nodes.length ? (
    nodes
  ) : (
    <p className="py-16 text-center text-[15px] text-[#8b95a1]">
      AI 생성 버튼을 눌러 글을 만들어 보세요.
    </p>
  );
}

export function CopyEditor({
  channel,
  value,
  generatedValue,
  readMode,
  compliance,
  runSelector,
  onChange,
  onToggleMode,
  onCopy,
  showChat,
  chatContextKey,
  draftLabel,
  generation,
  onToggleGenerationPause,
  onCancelGeneration,
  instagramHandle,
  cardCount,
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const over = value.length > channel.limit;
  const bodyCount = value
    .split("\n")
    .filter(
      (line) =>
        !SLOT_RE.test(line.trim()) &&
        !line.trim().startsWith("⤷") &&
        !QUOTE_RE.test(line.trim()),
    )
    .join("\n").length;
  return (
    <section
      role="tabpanel"
      aria-labelledby={`tab-${channel.id}`}
      className="px-[21px] pb-[22px] pt-[34px]"
    >
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div>{runSelector}</div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
          <output
            className={`mr-5 text-[15px] font-bold ${over ? "text-red-200" : "text-white"}`}
          >
            본문 {bodyCount.toLocaleString()}자 · 전체{" "}
            {value.length.toLocaleString()} / {channel.limit.toLocaleString()}자
          </output>
          <button
            type="button"
            onClick={onToggleMode}
            className="inline-flex h-[45px] items-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] text-[15px] font-medium text-[#4e5968]"
          >
            <Icon name={readMode ? "edit" : "eye"} className="size-[18px]" />
            {readMode ? "고치기" : "미리보기"}
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-[45px] items-center gap-[5px] rounded-full border border-[#287aff] bg-[#287aff] px-[19px] text-[15px] font-bold text-white hover:bg-[#1769ed]"
          >
            <Icon name="copy" className="size-[18px]" />
            복사
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <div className="rounded-xl border border-[#e5e8eb] bg-white shadow-[0_0_2px_rgba(0,30,78,0.07)]">
          {generation ? (
            <div
              className="flex min-h-[200px] flex-col justify-center px-6 py-12"
              role="status"
              aria-live="polite"
            >
              <div className="mx-auto w-full max-w-md rounded-xl border border-[#e5e8eb] bg-[#f8f9fa] px-5 py-4 text-[#4e5968]">
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <span className="font-semibold">
                    {generation.paused
                      ? "AI 생성 일시정지 중"
                      : `${generation.channelName || "AI 결과"} 생성 중…`}
                  </span>
                  <span className="text-[#8b95a1]">
                    {generation.current}/{generation.total}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-[#6b7684]">
                  조금만 기다려주세요. 다른 곳으로 이동할 경우 생성이 취소됩니다.
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e5e8eb]">
                  <div
                    className="h-full rounded-full bg-[#287aff] transition-[width] duration-300"
                    style={{
                      width: `${Math.max(8, (generation.current / generation.total) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onToggleGenerationPause}
                    className="rounded-full border border-[#d1d6db] bg-white px-3 py-1.5 text-[13px] font-semibold hover:bg-[#f2f4f6]"
                  >
                    {generation.paused ? "계속하기" : "일시정지"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelGeneration}
                    className="rounded-full border border-[#ff6b6b]/60 bg-white px-3 py-1.5 text-[13px] font-semibold text-[#e5484d] hover:bg-[#fff0f0]"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          ) : readMode && channel.id === "instagram" ? (
            value.trim() ? (
              <article className="flex min-h-[200px] flex-col gap-8 break-words px-6 py-6 sm:px-[25px] sm:py-[25px] lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <Preview value={value} issues={compliance.issues} />
                </div>
                <div className="w-full shrink-0 lg:sticky lg:top-[calc(var(--header-h)+20px)] lg:w-[380px]">
                  <InstagramPostPreview
                    value={value}
                    handle={instagramHandle}
                    cardCount={cardCount}
                  />
                </div>
              </article>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center px-6 py-6">
                <p className="text-[15px] text-[#8b95a1]">
                  AI 생성 버튼을 눌러 글을 만들어 보세요.
                </p>
              </div>
            )
          ) : readMode ? (
            <article className="min-h-[200px] break-words px-6 py-6 sm:px-[25px] sm:py-[25px]">
              <Preview value={value} issues={compliance.issues} />
            </article>
          ) : (
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              spellCheck="false"
              aria-label={`${channel.name} 글 편집`}
              className="min-h-[760px] w-full resize-y rounded-xl border-0 bg-white p-6 text-[15px] leading-[28px] text-[#4e5968] outline-none focus:ring-2 focus:ring-inset focus:ring-[#287aff]"
            />
          )}
        </div>

        {generatedValue.trim() && !generation ? (
          <CompliancePanel report={compliance} />
        ) : null}
      </div>

      {showChat && (
        <>
          <button
            type="button"
            onClick={() => setChatOpen((open) => !open)}
            aria-label={chatOpen ? "글쓰기 도우미 닫기" : "글쓰기 도우미 열기"}
            aria-expanded={chatOpen}
            className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-[#287aff] text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-colors hover:bg-[#1769ed]"
          >
            <Icon name={chatOpen ? "close" : "chat"} className="size-6" />
          </button>

          {chatOpen && (
            <div className="fixed bottom-24 right-6 z-40 flex h-[min(70vh,640px)] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-[#e5e8eb] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
              <CopyChatPanel
                key={chatContextKey}
                channelId={channel.id}
                channelName={channel.name}
                contextKey={chatContextKey}
                draftLabel={draftLabel}
                draftValue={value}
                onApplyToDraft={onChange}
                onClose={() => setChatOpen(false)}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
