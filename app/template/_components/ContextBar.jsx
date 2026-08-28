import { Icon } from "../../_components/Icon.jsx";

/**
 * 상품·주제·톤 요약 바 + 「글 수정」·「저장」 바로가기.
 * 캔버스 편집(A·B·C)과 직관형 프롬프트(D) 화면이 함께 쓴다 — 옛 pages/template.js 의
 * `ctxbar` 를 그대로 옮긴 것이라 두 화면에서 같은 자리에 같은 모양으로 뜬다.
 */
export function ContextBar({
  product,
  topic,
  focusPoint,
  toneLabel,
  onEditText,
  onSave,
  saveDisabled,
  saveBusy,
}) {
  const rows = [
    { label: "상품", value: product.name },
    { label: "주제", value: topic },
    ...(focusPoint?.trim() ? [{ label: "강조 할 내용", value: focusPoint }] : []),
    { label: "글 스타일", value: toneLabel },
  ];

  return (
    <section
      aria-label="글 생성 조건 요약"
      className="mb-[30px] flex min-h-[66px] items-center gap-6 overflow-hidden rounded-[15px] border border-[#e5e8eb] bg-white px-8 py-[17px] max-[1100px]:flex-wrap max-[1100px]:py-4 max-sm:px-5"
    >
      <dl className="grid min-w-0 flex-1 grid-cols-[minmax(150px,0.7fr)_minmax(220px,1fr)_minmax(220px,1.15fr)_minmax(220px,1.15fr)] items-center gap-x-8 gap-y-3 max-[1380px]:grid-cols-2 max-[700px]:grid-cols-1">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex min-w-0 items-center gap-[15px] text-[15px] leading-[1.3]"
          >
            <dt className="shrink-0 whitespace-nowrap font-bold text-black">
              {label}
            </dt>
            <dd
              className="min-w-0 truncate font-normal text-[#8e8e8e]"
              title={value || "-"}
            >
              {value || "-"}
            </dd>
          </div>
        ))}
      </dl>

      <div className="ml-auto flex shrink-0 items-center gap-[10px]">
        <button
          type="button"
          onClick={onEditText}
          aria-label="글귀 단계로 돌아가 글 수정하기"
          className="inline-flex h-[42px] items-center justify-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] text-[15px] font-medium leading-[22.4px] text-[#4e5968] transition hover:bg-[#f7f8fa]"
        >
          <Icon name="arrowLeft" className="size-[18px]" />글 수정
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          aria-label="지금 게시물을 마이페이지에 저장하기"
          aria-busy={saveBusy}
          className="inline-flex h-[42px] items-center justify-center gap-[5px] rounded-full border border-[#287aff] bg-[#287aff] px-[19px] text-[15px] font-bold leading-[22.4px] text-white transition hover:border-[#1b64da] hover:bg-[#1b64da] disabled:opacity-40"
        >
          <Icon name="archive" className="size-[18px]" />
          저장
        </button>
      </div>
    </section>
  );
}
