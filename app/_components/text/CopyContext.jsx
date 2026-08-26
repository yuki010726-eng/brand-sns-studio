import { Icon } from "../Icon.jsx";

export function CopyContext({
  product,
  topic,
  tone,
  busy,
  canGenerate,
  onBack,
  onGenerateCurrent,
  onGenerateAll,
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[#e5e8eb] bg-white p-5 shadow-sm">
      <dl className="flex min-w-0 flex-1 flex-wrap gap-x-8 gap-y-3">
        {[
          ["상품", product?.name],
          ["주제", topic],
          ["톤", tone],
        ].map(([label, value]) => (
          <div key={label} className="min-w-[120px]">
            <dt className="mb-1 text-xs font-semibold text-[#8b95a1]">
              {label}
            </dt>
            <dd className="truncate text-sm font-bold text-[#333d4b]">
              {value || "-"}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#d1d6db] px-3 py-2 text-sm font-semibold hover:bg-[#f2f4f6]"
        >
          <Icon name="arrowLeft" className="size-4" />
          조건 수정
        </button>
        <button
          disabled={!canGenerate || busy}
          onClick={onGenerateCurrent}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#d1d6db] px-3 py-2 text-sm font-semibold hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="sparkles" className="size-4" />
          현재 채널만
        </button>
        <button
          disabled={!canGenerate || busy}
          onClick={onGenerateAll}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#b9f73e] px-3 py-2 text-sm font-bold text-[#1a1a1a] hover:bg-[#a9e72e] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="sparkles" className="size-4" />
          {busy ? "생성 중…" : "전체 채널 AI 생성"}
        </button>
      </div>
    </section>
  );
}
