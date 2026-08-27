export function AiRunSelector({ runs, activeIndex, onSelect }) {
  if (!runs.length) return null;
  return (
    <div
      className="flex flex-wrap gap-2.5"
      role="group"
      aria-label="AI 생성 버전 선택"
    >
      {runs.map((run, index) => (
        <button
          key={run.index}
          onClick={() => onSelect(index)}
          aria-pressed={activeIndex === index}
          className={`h-[45px] rounded-full border px-[19px] text-[15px] font-bold ${activeIndex === index ? "border-white bg-white text-[#287aff]" : "border-transparent bg-white/45 text-[#5f6b7a] hover:bg-white/60"}`}
        >
          시안 {index + 1}
        </button>
      ))}
    </div>
  );
}
