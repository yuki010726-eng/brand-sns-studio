export function FilterChip({ id, label, count, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={active}
      aria-label={`${label} 게시물만 보기 (${count}개)`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[14px] transition ${
        active
          ? "border-[#191f28] bg-[#191f28] font-bold text-white"
          : "border-[#e5e8eb] bg-white font-medium text-[#4e5968] hover:border-[#d5dae0]"
      }`}
    >
      {label}
      <span className={active ? "text-white" : "text-[#8b95a1]"}>{count}</span>
    </button>
  );
}
