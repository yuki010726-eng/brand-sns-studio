export function StyleSelector({ styles, selectedId, onSelect }) {
  return (
    <section className="rounded-2xl border border-[#e5e8eb] bg-white p-5">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="블로그 스타일 선택"
      >
        <span className="mr-2 text-sm font-bold text-[#333d4b]">
          블로그 스타일
        </span>
        {[{ id: null, name: "사용 안 함" }, ...styles].map((style, index) => (
          <button
            key={style.id || "none"}
            onClick={() => onSelect(style.id)}
            aria-pressed={selectedId === style.id}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${selectedId === style.id ? "border-[#1a1a1a] bg-[#1a1a1a] text-white" : "border-[#d1d6db] bg-white hover:bg-[#f2f4f6]"}`}
          >
            {style.id
              ? `${String.fromCharCode(64 + index)}타입 · ${style.name}`
              : style.name}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-[#8b95a1]">
        {styles.find((style) => style.id === selectedId)?.name
          ? "선택한 스타일의 리듬과 말투를 다음 생성에 반영합니다."
          : "스타일 없이 사실과 주제에 맞춰 작성합니다."}
      </p>
    </section>
  );
}
