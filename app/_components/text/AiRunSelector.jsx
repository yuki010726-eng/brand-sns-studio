import { getConcept } from "../../../lib/concepts.js";

/**
 * 시안 버튼 이름 짓기.
 *
 * 보통은 "시안 1 · 시안 2…"로 충분하지만, 담당자가 다른 조건(제목·강조할 내용·톤)은
 * 그대로 두고 **카드뉴스 템플릿만 바꿔** 다시 생성한 경우에는 "시안 N"이 아무 단서가
 * 안 된다 — 그때는 템플릿 이름("노트형" · "카드형")으로 보여줘서 어느 버튼이 어느
 * 템플릿으로 만든 것인지 바로 알 수 있게 한다 (요청자 지시 2026-09-08).
 *
 * ⚠️ 옛 저장분처럼 `run.conditions.concept` 이 없는 시안이 하나라도 섞여 있으면
 *    비교할 근거가 없으므로 조용히 "시안 N"으로 돌아간다.
 */
function sameOtherConditions(a, b) {
  return (
    (a?.tone || "") === (b?.tone || "") &&
    (a?.focusPoint || "") === (b?.focusPoint || "") &&
    (a?.title || "") === (b?.title || "")
  );
}

function labelsFor(entries) {
  const conditions = entries.map(({ run }) => run.conditions || null);
  const concepts = conditions.map((c) => c?.concept);
  const hasAllConcepts = concepts.every(Boolean);
  const conceptsDiffer = new Set(concepts).size > 1;
  const othersMatch = conditions.every(
    (c, i) => i === 0 || sameOtherConditions(c, conditions[0]),
  );

  if (hasAllConcepts && conceptsDiffer && othersMatch) {
    const seen = new Map();
    return concepts.map((id) => {
      const name = getConcept(id)?.name || id;
      const count = (seen.get(name) || 0) + 1;
      seen.set(name, count);
      return count > 1 ? `${name} ${count}` : name;
    });
  }

  return entries.map((_, index) => `시안 ${index + 1}`);
}

export function AiRunSelector({ runs, activeIndex, onSelect }) {
  if (!runs.length) return null;
  const labels = labelsFor(runs);
  return (
    <div
      className="flex flex-wrap gap-2.5"
      role="group"
      aria-label="AI 생성 버전 선택"
    >
      {runs.map((entry, index) => (
        <button
          key={entry.index}
          onClick={() => onSelect(index)}
          aria-pressed={activeIndex === index}
          className={`h-[45px] rounded-full border px-[19px] text-[15px] font-bold ${activeIndex === index ? "border-white bg-white text-[#287aff]" : "border-transparent bg-white/45 text-[#5f6b7a] hover:bg-white/60"}`}
        >
          {labels[index]}
        </button>
      ))}
    </div>
  );
}
