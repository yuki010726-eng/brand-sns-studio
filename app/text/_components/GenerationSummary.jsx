import { Icon } from "../../_components/Icon.jsx";

export function GenerationSummary({
  productName,
  topic,
  focusPoint,
  writingStyle,
  onEditConditions,
  onNext,
}) {
  const items = [
    { label: "상품", value: productName },
    { label: "주제", value: topic },
    ...(focusPoint?.trim()
      ? [{ label: "강조 할 내용", value: focusPoint }]
      : []),
    { label: "글 스타일", value: writingStyle },
  ];

  return (
    <section
      aria-label="글 생성 조건 요약"
      className="flex min-h-[66px] items-center gap-6 overflow-hidden rounded-[15px] border border-[#e5e8eb] bg-white px-8 py-[17px] max-[1100px]:flex-wrap max-[1100px]:py-4 max-sm:px-5"
    >
      <dl className="grid min-w-0 flex-1 grid-cols-[minmax(150px,0.7fr)_minmax(220px,1fr)_minmax(220px,1.15fr)_minmax(220px,1.15fr)] items-center gap-x-8 gap-y-3 max-[1380px]:grid-cols-2 max-[700px]:grid-cols-1">
        {items.map(({ label, value }) => (
          <div key={label} className="flex min-w-0 items-center gap-[15px] text-[15px] leading-[1.3]">
            <dt className="shrink-0 whitespace-nowrap font-bold text-black">{label}</dt>
            <dd className="min-w-0 truncate font-normal text-[#8e8e8e]" title={value || "-"}>
              {value || "-"}
            </dd>
          </div>
        ))}
      </dl>

      <div className="ml-auto flex shrink-0 items-center gap-[10px]">
        <button
          type="button"
          onClick={onEditConditions}
          className="inline-flex h-[42px] items-center justify-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] text-[15px] font-medium leading-[22.4px] text-[#4e5968] transition hover:bg-[#f7f8fa]"
        >
          <Icon name="arrowLeft" className="size-[18px]" />
          조건 수정
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex h-[42px] items-center justify-center gap-[5px] rounded-full border border-[#287aff] bg-[#287aff] px-[19px] text-[15px] font-bold leading-[22.4px] text-white transition hover:border-[#1b64da] hover:bg-[#1b64da]"
        >
          다음 단계
          <Icon name="arrowRight" className="size-[17px]" />
        </button>
      </div>
    </section>
  );
}
