const KIND_LABEL = {
  cover: "표지",
  body: "본문",
  note: "반론",
  outro: "마무리",
  follow: "팔로우",
};

/** 편집할 카드(01~06) 선택 탭. 방향키 이동은 WAI-ARIA 탭 패턴을 따른다(옛 bindTabs). */
export function CardTabs({ deck, active, onSelect }) {
  function onKeyDown(e, i) {
    const map = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: deck.length - 1,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = (map[e.key] + deck.length) % deck.length;
    onSelect(next);
    e.currentTarget.parentElement
      ?.querySelector(`[data-card-tab="${next}"]`)
      ?.focus();
  }

  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="편집할 카드 선택"
    >
      {deck.map((card, i) => {
        const on = i === active;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            data-card-tab={i}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            aria-label={`${i + 1}번 카드 ${KIND_LABEL[card.kind] || "본문"} 편집`}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-[18px] py-[10px] text-[15px] font-bold transition ${on ? "border-[#287aff] bg-[#287aff] text-white" : "border-[#e5e8eb] bg-white text-[#5f6b7a] hover:bg-[#f7f8fa]"}`}
          >
            <span>{String(i + 1)}</span>
            <span>{KIND_LABEL[card.kind] || "본문"}</span>
          </button>
        );
      })}
    </div>
  );
}

export { KIND_LABEL };
