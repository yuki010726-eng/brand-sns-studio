"use client";

import { useState } from "react";
import { Icon } from "../../_components/Icon.jsx";

/** 프롬프트를 들고 갈 곳 — 한글을 그릴 수 있는 도구여야 한다 */
const TOOLS = [
  { name: "ChatGPT", url: "https://chatgpt.com/" },
  { name: "Gemini", url: "https://gemini.google.com/app" },
];

/**
 * 카드 한 장의 배경/아이콘 이미지 패널. 옛 components/imagepanel.js 를 JSX로 옮겼다.
 *
 * AI가 여기서 이미지를 직접 만들지 않는다(요청자 결정) — 프롬프트를 복사해 원하는 도구에서
 * 만든 뒤 파일을 올리는 흐름이다. 이미지는 선택 사항이라 없어도 템플릿 기본 배경으로 그려진다.
 *
 * 접었다 펴는 구조다 — 기본은 접힘. 피그마: https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=72-2605
 */
export function ImagePanel({ label, disabled, hasImage, source, prompt, cardIndex, onUpload, onDelete, onCopy }) {
  const [open, setOpen] = useState(false);
  const n = cardIndex + 1;

  if (disabled) {
    return (
      <div>
        <h3 className="text-[15px] font-bold text-black">{label}</h3>
        <p className="mt-1.5 text-[13px] text-[#5f6b7a]">이 카드는 단색 배경으로 고정입니다 — 이미지를 쓰지 않습니다.</p>
      </div>
    );
  }

  const statusText = hasImage
    ? `${n}번 카드에 ${source === "upload" ? "올린" : "생성한"} 이미지가 들어가 있습니다.`
    : "없어도 됩니다. 넣지 않으면 템플릿 기본 배경으로 그려집니다.";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[15px] font-bold text-[#333d4b]">{label}</span>
          <span className="text-[13px] text-[#5f6b7a]">{statusText}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-[#f2f4f6] px-[11px] py-[3px] text-[12px] font-bold text-[#5f6b7a]">
            {hasImage ? (source === "upload" ? "업로드됨" : "생성됨") : "선택 사항"}
          </span>
          <Icon
            name="chevronRight"
            className={`size-4 text-[#8b95a1] transition-transform ${open ? "rotate-90" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <h4 className="text-[15px] font-bold text-[#333d4b]">이미지 프롬프트</h4>

          <div className="rounded-[8px] bg-[#f2f4f6] px-3 py-2.5">
            <p className="whitespace-pre-wrap text-[12px] leading-[1.6] text-[#5f6b7a]">{prompt}</p>
          </div>

          <p className="text-[15px] font-bold text-[#333d4b]">
            프롬프트를 복사해 원하는 이미지 생성 도구에서 만든 뒤, 「파일 올리기」로 넣으세요.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onCopy}
              aria-label={`${n}번 카드 프롬프트 복사하기`}
              className="inline-flex items-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] py-[11px] text-[15px] font-bold text-[#5f6b7a] shadow-[0_0_2px_rgba(0,30,78,0.07)] transition hover:bg-[#f7f8fa]"
            >
              <Icon name="copy" className="size-[18px]" />
              프롬프트 복사
            </button>

            {TOOLS.map((t) => (
              <a
                key={t.name}
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t.name} 를 새 탭에서 열기`}
                className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#333d4b] transition hover:text-[#287aff]"
              >
                <Icon name="external" className="size-[15px]" />
                {t.name}
              </a>
            ))}

            <label className="inline-flex cursor-pointer items-center gap-[5px] rounded-full border border-[#287aff] bg-[#287aff] px-[19px] py-[11px] text-[15px] font-bold text-white shadow-[0_0_2px_rgba(0,30,78,0.07)] transition hover:border-[#1b64da] hover:bg-[#1b64da]">
              <Icon name="image" className="size-[18px]" />
              파일 올리기
              <input
                type="file"
                accept="image/*"
                autoComplete="off"
                className="sr-only"
                aria-label={`${n}번 카드 이미지 파일 선택`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onUpload(file);
                }}
              />
            </label>

            {hasImage && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={`${n}번 카드 이미지 지우기`}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold text-[#5f6b7a] transition hover:bg-[#f7f8fa]"
              >
                <Icon name="trash" className="size-4" />
                지우기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
