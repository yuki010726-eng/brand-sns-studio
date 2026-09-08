import { CONCEPTS } from "../../../lib/concepts.js";

/**
 * 블로그 탭에서 카드뉴스 템플릿(컨셉)을 빠르게 바꾸는 알약 묶음.
 * 인스타그램 탭의 `InstagramFormatSelector`(기본형·정보형·문답형)와 같은 자리,
 * 같은 모양이다 — "시안 1" 버튼 바로 아래(2026-09-08, 요청자 지시).
 *
 * 조건 패널의 `TemplateSection`(`ConceptPicker`)이 이미 같은 값(`state.concept`)을
 * 미리보기 이미지까지 담아 고르게 해 주지만, 글을 보는 동안 조건 패널을 다시 펼치지
 * 않고도 템플릿만 바로 바꿀 수 있게 여기 축약형을 둔다. 두 곳은 같은 상태를 본다.
 */
export function BlogConceptSelector({ value, onChange, disabled = false }) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="블로그 카드뉴스 템플릿 선택"
    >
      {CONCEPTS.map((concept) => (
        <button
          key={concept.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(concept.id)}
          aria-pressed={value === concept.id}
          className={`h-[36px] rounded-full border px-4 text-[14px] font-bold disabled:opacity-40 ${value === concept.id ? "border-[#287aff] bg-[#287aff] text-white" : "border-white/55 bg-transparent text-white hover:bg-white/10"}`}
        >
          {concept.name}
        </button>
      ))}
    </div>
  );
}
