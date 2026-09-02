"use client";

import { useEffect, useRef, useState } from "react";
import { CHANNELS } from "../../../data/channels.js";
import { Icon } from "../Icon.jsx";
import { FlowArrow } from "./FlowArrow.jsx";

const TONES = [
  { id: "trust", label: "신뢰·정보형", desc: "사실 중심으로 차분하게" },
  { id: "hook", label: "후킹·공감형", desc: "첫 줄에서 시선을 잡고" },
  { id: "plain", label: "담백·실무형", desc: "군더더기 없이 핵심만" },
  { id: "celebrate", label: "축하·발표형", desc: "수상·소식 알림 톤" },
  {
    id: "custom",
    label: "글 스타일 직접 추가",
    desc: "블로그 글의 문체를 참고해 작성",
  },
];
const HINTS = {
  1: "표지 한 장에 후킹과 마무리를 함께 얹습니다.",
  2: "표지 · 마무리",
  3: "표지 · 본문 1 · 마무리",
  4: "표지 · 본문 2 · 마무리",
  5: "표지 · 본문 2 · 반론 · 마무리",
  6: "표지 · 본문 3 · 반론 · 마무리",
};
const inputClass =
  "w-full rounded-[12px] border border-[#e5e8eb] bg-white px-4 py-[13px] text-[15px] text-[#4e5968] outline-none transition hover:border-[#cdd3d9] focus:border-[#3182f6] focus:shadow-[0_0_0_3px_rgba(49,130,246,0.18)] placeholder:text-[#5f6b7a]";

function ToneSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = TONES.find((item) => item.id === value);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative mt-2">
      <button
        type="button"
        className={`flex min-h-[50px] w-full items-center justify-between gap-3 rounded-[12px] border bg-white px-4 py-3 text-left text-[15px] outline-none transition ${open ? "border-[#3182f6] shadow-[0_0_0_3px_rgba(49,130,246,0.18)]" : "border-[#e5e8eb] hover:border-[#cdd3d9]"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={selected ? "font-medium text-[#333d4b]" : "text-[#5f6b7a]"}
        >
          {selected?.label || "글 스타일을 선택하세요."}
        </span>
        <span
          aria-hidden="true"
          className={`mr-1 size-2.5 shrink-0 border-b-2 border-r-2 border-[#6b7684] transition-transform ${open ? "translate-y-0.5 rotate-[225deg]" : "-translate-y-0.5 rotate-45"}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="글 스타일 선택"
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-full overflow-hidden rounded-[14px] border border-[#e5e8eb] bg-white p-1.5 shadow-[0_14px_35px_rgba(0,30,78,0.16)]"
        >
          {TONES.map((item) => {
            const active = item.id === value;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-3.5 py-3 text-left transition ${active ? "bg-[#e8f2fe]" : "hover:bg-[#f2f4f6]"}`}
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
              >
                <span className="min-w-0">
                  <strong
                    className={`block text-[14px] ${active ? "text-[#1b64da]" : "text-[#333d4b]"}`}
                  >
                    {item.label}
                  </strong>
                  <span
                    className={`mt-0.5 block text-[12px] ${active ? "text-[#3182f6]" : "text-[#8b95a1]"}`}
                  >
                    {item.desc}
                  </span>
                </span>
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full border ${active ? "border-[#3182f6] bg-[#3182f6] text-white" : "border-[#d1d6db] text-transparent"}`}
                >
                  <Icon name="check" className="size-3 stroke-[2.5]" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TopicSection({
  product,
  presets,
  presetsLoading,
  state,
  topicRef,
  onUpdate,
  onToggleChannel,
  onClear,
  onSubmit,
  onSaveCustomStyle,
  onRefreshPresets,
}) {
  const hasTopic = state.topic.trim().length >= 2;
  const hasCustomStyle =
    state.tone !== "custom" ||
    String(state.customStyleUrl || "").trim().length > 0;
  const hasOptions =
    hasTopic &&
    Boolean(state.tone) &&
    hasCustomStyle &&
    Number(state.cardCount) > 0;
  const hasRequiredFields = hasOptions && state.channels.length > 0;
  const tone = TONES.find((item) => item.id === state.tone);
  return (
    <section className="flex flex-col gap-7" aria-labelledby="topic-heading">
      <h2
        id="topic-heading"
        className="text-[25px] font-bold leading-[1.35] text-white max-sm:text-[22px]"
      >
        2. 게시물의 주제를 선택해주세요.
      </h2>
      {product ? (
        <div className="flex min-h-[504px] flex-col gap-3.5 rounded-[15px] bg-white px-[26px] pb-8 pt-[23px] text-[#4e5968]">
          <h3 className="pl-2.5 text-[18px] font-bold text-[#191f28]">
            게시물 주제 설정
          </h3>
          <div className="h-px w-full bg-[#e5e8eb]" />
          <div className="mx-[27px] mt-[15px] grid grid-cols-[minmax(360px,1.35fr)_28px_minmax(300px,1fr)_28px_minmax(280px,0.95fr)] gap-[22px] max-[1024px]:mx-0 max-[1024px]:grid-cols-1">
            <div className="flex min-w-0 flex-col gap-6">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[15px] font-bold text-[#333d4b]">
                    추천 주제
                  </p>
                  <button
                    type="button"
                    className="grid size-7 place-items-center rounded-full text-[#6b7684] transition hover:bg-[#f2f4f6] hover:text-[#1b64da] disabled:cursor-wait disabled:opacity-50"
                    aria-label="추천 주제 새로고침"
                    title="추천 주제 새로고침"
                    disabled={presetsLoading}
                    onClick={onRefreshPresets}
                  >
                    <Icon
                      name="refresh"
                      className={`size-4 ${presetsLoading ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {presets.map((preset) => {
                    const isSelected = state.topic === preset;

                    return (
                      <button
                        key={preset}
                        type="button"
                        aria-pressed={isSelected}
                        className={`inline-flex items-center rounded-full border bg-white px-[15px] py-2 text-[15px] font-medium leading-[22.4px] transition ${isSelected ? "border-[#287aff] text-[#287aff] shadow-[0_0_2px_rgba(0,30,78,0.07)]" : "border-[#e5e8eb] text-[#4e5968] hover:border-[#d5dae0] hover:text-[#191f28]"}`}
                        onClick={() => {
                          onUpdate({
                            topic: preset,
                            tone: "",
                            customStyleUrl: "",
                            customStyleGuide: "",
                            customStyleGuideUrl: "",
                            customStyleSaveRequested: false,
                            cardCount: 0,
                            channels: [],
                            libraryTitle: "",
                          });
                          topicRef.current?.focus();
                        }}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label>
                <span className="sr-only">이번 게시물 주제</span>
                <textarea
                  ref={topicRef}
                  className={`${inputClass} min-h-12 resize-none leading-[1.65]`}
                  rows={1}
                  value={state.topic}
                  onChange={(event) =>
                    onUpdate({
                      topic: event.target.value,
                      tone: "",
                      customStyleUrl: "",
                      customStyleGuide: "",
                      customStyleGuideUrl: "",
                      customStyleSaveRequested: false,
                      cardCount: 0,
                      channels: [],
                      libraryTitle: "",
                    })
                  }
                  placeholder="주제를 입력해주세요. ( 구체적일수록 글귀가 정확해집니다. )"
                />
              </label>
              <label>
                <span className="text-[15px] font-bold text-[#333d4b]">
                  강조하고 싶은 내용
                </span>
                <textarea
                  className={`${inputClass} mt-2 min-h-[92px] resize-none leading-[1.65]`}
                  rows={3}
                  value={state.focusPoint || ""}
                  onChange={(event) =>
                    onUpdate({
                      focusPoint: event.target.value,
                      libraryTitle: "",
                    })
                  }
                  placeholder="게시물에서 꼭 강조할 내용을 입력해주세요. (선택)"
                />
              </label>
            </div>
            <FlowArrow />
            <fieldset
              className={`flex min-w-0 flex-col gap-6 border-0 transition ${hasTopic ? "" : "pointer-events-none opacity-[0.38] grayscale-[0.35]"}`}
              disabled={!hasTopic}
              aria-disabled={!hasTopic}
            >
              <legend className="sr-only">글 스타일과 카드뉴스 장수</legend>
              <div>
                <span className="text-[15px] font-bold text-[#333d4b]">
                  글 스타일
                </span>
                <span className="mt-2 block text-[15px] text-[#5f6b7a]">
                  {tone?.desc || "글 스타일을 선택하세요."}
                </span>
                <ToneSelect
                  value={state.tone}
                  onChange={(tone) =>
                    onUpdate({
                      tone,
                      ...(tone === "custom"
                        ? {}
                        : {
                            customStyleUrl: "",
                            customStyleGuide: "",
                            customStyleGuideUrl: "",
                            customStyleSaveRequested: false,
                          }),
                    })
                  }
                />
                {state.tone === "custom" && (
                  <span className="mt-3 block">
                    <input
                      type="url"
                      inputMode="url"
                      className={inputClass}
                      value={state.customStyleUrl || ""}
                      onChange={(event) =>
                        onUpdate({
                          customStyleUrl: event.target.value,
                          customStyleGuide: "",
                          customStyleGuideUrl: "",
                          customStyleSaveRequested: false,
                        })
                      }
                      placeholder="참고할 네이버 블로그 글 링크를 입력하세요."
                      aria-label="참고할 블로그 링크"
                    />
                    <button
                      type="button"
                      className="ml-auto mt-2 block rounded-md px-1 py-1 text-[13px] font-semibold text-[#4e5968] underline decoration-[#b0b8c1] underline-offset-4 transition hover:text-[#1b64da] hover:decoration-[#1b64da]"
                      onClick={onSaveCustomStyle}
                    >
                      {state.customStyleSaveRequested
                        ? "스타일 저장 예약됨"
                        : "스타일 저장하기"}
                    </button>
                  </span>
                )}
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#333d4b]">
                  이미지 · 카드뉴스 장수
                </p>
                <div className="w-max mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6].map((count) => (
                    <label
                      key={count}
                      className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-[9px] text-[15px] font-medium transition ${state.cardCount === count ? "border-[#191f28] bg-[#191f28] font-bold text-white" : "border-[#e5e8eb] bg-white text-[#4e5968] hover:border-[#d5dae0]"}`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="card-count"
                        checked={state.cardCount === count}
                        onChange={() => onUpdate({ cardCount: count })}
                      />
                      {count}장
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[15px] leading-[1.6] text-[#5f6b7a]">
                  {HINTS[state.cardCount] || "카드뉴스 장수를 선택하세요."}{" "}
                  장수를 줄여도 블로그·인스타 글은 기승전결을 그대로 씁니다.
                  이미지만 줄어듭니다.
                </p>
              </div>
            </fieldset>
            <FlowArrow />
            <fieldset
              className={`min-w-0 border-0 transition ${hasOptions ? "" : "pointer-events-none opacity-[0.38] grayscale-[0.35]"}`}
              disabled={!hasOptions}
              aria-disabled={!hasOptions}
            >
              <legend className="text-[15px] font-bold text-[#333d4b]">
                내보낼 채널
              </legend>
              <ul className="mt-2 flex flex-col gap-2">
                {CHANNELS.map((channel) => {
                  const checked = state.channels.includes(channel.id);
                  return (
                    <li key={channel.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-2.5 rounded-[12px] border px-4 py-[13px] transition hover:border-[#d5dae0] ${checked ? "border-[#1b64da] bg-[#e8f2fe]" : "border-[#e5e8eb]"}`}
                      >
                        <input
                          className="sr-only"
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleChannel(channel.id)}
                        />
                        <Icon
                          name={channel.icon}
                          className={`mt-0.5 size-[18px] stroke-[1.75] ${checked ? "text-[#1b64da]" : "text-[#5f6b7a]"}`}
                        />
                        <span>
                          <strong className="block text-[14px] text-[#333d4b]">
                            {channel.name}
                          </strong>
                          <em className="block text-[12px] not-italic text-[#5f6b7a]">
                            {channel.hint}
                          </em>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          </div>
          <div className="mx-[26px] mt-[30px] flex items-center justify-end gap-4 border-t border-[#e5e8eb] pt-[30px] max-[560px]:flex-col max-[560px]:items-stretch">
            <button
              type="button"
              className="rounded-full bg-transparent px-3 py-2 text-[15px] font-bold text-[#333d4b] hover:bg-[#f2f4f6]"
              onClick={onClear}
            >
              초기화
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#287aff] px-7 py-3.5 text-[16px] font-bold text-white transition hover:bg-[#1b64da] disabled:cursor-not-allowed disabled:bg-[#e5e8eb] disabled:text-[#4e5968]"
              disabled={!hasRequiredFields}
              onClick={onSubmit}
            >
              게시물 생성하기{" "}
              <Icon name="arrowRight" className="size-[18px] stroke-[1.75]" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[180px] place-items-center rounded-[15px] bg-white/10 px-5 text-center text-[14px] text-white/60">
          상품을 선택하면 주제 설정이 열립니다.
        </div>
      )}
    </section>
  );
}

export { TONES };
