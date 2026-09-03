export const INSTAGRAM_FORMATS = [
  { id: "simple", label: "심플형" },
  { id: "informative", label: "정보형" },
  { id: "qna", label: "문답형" },
];

export function InstagramFormatSelector({ value, onChange, disabled = false }) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="인스타그램 글 유형 선택"
    >
      {INSTAGRAM_FORMATS.map((format) => (
        <button
          key={format.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(format.id)}
          aria-pressed={value === format.id}
          className={`h-[36px] rounded-full border px-4 text-[14px] font-bold disabled:opacity-40 ${value === format.id ? "border-[#287aff] bg-[#287aff] text-white" : "border-white/55 bg-transparent text-white hover:bg-white/10"}`}
        >
          {format.label}
        </button>
      ))}
    </div>
  );
}
