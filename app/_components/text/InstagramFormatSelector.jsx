import { CONCEPTS } from "../../../lib/concepts.js";

export const INSTAGRAM_FORMATS = [
  { id: "simple", label: "기본형" },
  { id: "informative", label: "정보형" },
  { id: "qna", label: "문답형" },
];

export function InstagramFormatSelector({
  value,
  onChange,
  conceptValue,
  onConceptChange,
  disabled = false,
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-end gap-2"
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
          className={`relative h-[36px] rounded-full border px-4 text-[14px] font-bold disabled:opacity-40 ${value === format.id ? "border-[#287aff] bg-[#287aff] text-white" : "border-white/55 bg-transparent text-white hover:bg-white/10"}`}
        >
          {format.label}
          {conceptValue === "magazine" && format.id === "informative" && (
            <span className="absolute -right-2 -top-2 rounded-full bg-[#ff6b35] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white shadow-sm">
              추천
            </span>
          )}
        </button>
      ))}
      {onConceptChange && (
        <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-white/35 sm:block" />
      )}
      {onConceptChange && CONCEPTS.map((concept) => (
        <button
          key={concept.id}
          type="button"
          disabled={disabled}
          onClick={() => onConceptChange(concept.id)}
          aria-pressed={conceptValue === concept.id}
          className={`h-[36px] rounded-full border px-4 text-[14px] font-bold disabled:opacity-40 ${conceptValue === concept.id ? "border-[#287aff] bg-[#287aff] text-white" : "border-white/55 bg-transparent text-white hover:bg-white/10"}`}
        >
          {concept.name}
        </button>
      ))}
    </div>
  );
}
