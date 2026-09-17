"use client";

import { getState, setState } from "../../../store.js";

/** 제목 후보만 고르고, 글의 세부 구조는 미리 만들지 않는다. */
export function TitleSuggestionSection({ state, busy }) {
  const outline = state.contentOutline;
  const titles = Array.isArray(outline?.titleOptions)
    ? outline.titleOptions.filter(Boolean)
    : [];
  if (!titles.length) return null;

  function selectTitle(title) {
    const current = getState().contentOutline || {};
    setState({ contentOutline: { ...current, title } });
  }

  return (
    <section className="rounded-[15px] border border-[#e5e8eb] bg-white px-8 py-7 max-sm:px-5">
      <h3 className="text-[16px] font-bold text-black">추천 제목</h3>
      <p className="mt-1 text-[13px] text-[#6b7684]">
        제목을 고르면 선택한 제목으로 게시물을 생성합니다.
      </p>
      <div
        className="mt-5 flex flex-wrap gap-2"
        role="group"
        aria-label="추천 제목 선택"
      >
        {titles.map((title) => {
          const selected = outline.title === title;
          return (
            <button
              key={title}
              type="button"
              aria-pressed={selected}
              onClick={() => selectTitle(title)}
              className={`rounded-full border px-4 py-2.5 text-left text-[14px] font-semibold leading-snug transition ${selected ? "border-[#287aff] bg-[#e8f2fe] text-[#287aff]" : "border-[#e5e8eb] bg-white text-[#4e5968] hover:border-[#287aff]/50 hover:bg-[#f7f9fc]"}`}
            >
              {title}
            </button>
          );
        })}
      </div>
    </section>
  );
}
