"use client";

import { Icon } from "../../_components/Icon.jsx";

/**
 * PNG 저장(1장/전체) 버튼. 옛 pages/template.js 의 saveOne/saveAll UI.
 * 피그마: https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=72-1399
 */
export function SaveActions({ cardCount, savingAll, onSaveOne, onSaveAll }) {
  return (
    <div className="flex flex-wrap justify-end gap-[10px]" aria-label="카드 이미지 저장">
      <button
        type="button"
        onClick={onSaveOne}
        aria-label="이 카드 PNG로 저장하기"
        className="inline-flex items-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] py-[11px] text-[15px] font-bold text-[#5f6b7a] shadow-[0_0_2px_rgba(0,30,78,0.07)] transition hover:bg-[#f7f8fa]"
      >
        <Icon name="download" className="size-[18px]" />
        이 카드 저장
      </button>
      <button
        type="button"
        onClick={onSaveAll}
        disabled={savingAll}
        aria-busy={savingAll}
        aria-label={`카드 ${cardCount}장 모두 PNG로 저장하기`}
        className="inline-flex items-center gap-[5px] rounded-full border border-[#287aff] bg-[#287aff] px-[19px] py-[11px] text-[15px] font-bold text-white shadow-[0_0_2px_rgba(0,30,78,0.07)] transition hover:border-[#1b64da] hover:bg-[#1b64da] disabled:opacity-40"
      >
        <Icon name="download" className="size-[18px]" />
        {cardCount}장 모두 저장
      </button>
    </div>
  );
}
