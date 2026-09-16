/** AI 생성 결과는 조건과 관계없이 생성 순서대로 시안 번호를 표시한다. */
function labelsFor(entries) {
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
