import Image from "next/image.js";
import { Icon } from "../../_components/Icon.jsx";
import { AD_CONCEPTS } from "../../../lib/adprompt.js";

/**
 * 템플릿 선택 — 왼쪽 목록 + 오른쪽 미리보기 패널.
 * 피그마: https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=92-89
 *
 * 오른쪽 미리보기 카드는 `concept.previewImages`(`lib/concepts.js`)에서 온다.
 * 아직 이미지가 없으면(빈 배열) 자리만 표시한다 — 컨셉마다 다른 이미지가
 * 들어갈 자리이므로 플레이스홀더 개수만 여기서 정하고 실제 그림은 데이터로 채운다.
 *
 * ⚠️ 광고형(D, `promptOnly`)도 목록에 포함한다. 이미지 프롬프트 화면이 없던 동안은
 *    여기서 걸러 숨겼는데, 그 화면이 생긴 지금 계속 걸러 두면 D 를 고를 방법 자체가
 *    사라진다 — `previewImages` 가 없는 컨셉은 아래에서 자리만 있는 빈 박스로 보인다.
 */
const PLACEHOLDER_COUNT = 4;
const TEMPLATE_ORDER = ["blog", "intuitive", "card", "note", "magazine"];

function templateOrder(concept) {
  const index = TEMPLATE_ORDER.indexOf(concept.id);
  return index === -1 ? TEMPLATE_ORDER.length : index;
}

export function ConceptPicker({
  concepts,
  value,
  selectedIds = [value],
  onChange,
  onPreviewChange,
  adSelectedIds = [],
  onAdSelectionChange,
  emptyPreview = false,
  variant = "image",
}) {
  const showDetails = variant === "legacy";
  // Keep the display order independent from the source array: the latter is
  // also used as a data registry by the editor and saved posts.
  const visible = [...concepts].sort(
    (a, b) => templateOrder(a) - templateOrder(b),
  );
  const selected = emptyPreview
    ? visible.find((c) => c.id === value)
    : visible.find((c) => c.id === value) || visible[0];
  const isBlogPreview = selected?.id === "blog";
  const previewSlots =
    selected?.previewImages?.length > 0
      ? selected.previewImages
      : new Array(PLACEHOLDER_COUNT).fill(null);

  return (
    <div
      className={`relative flex w-full ${showDetails ? "mb-[95px]" : "mb-[20px]"} [container-type:inline-size] max-[860px]:h-auto max-[860px]:flex-col ${
        selected?.promptOnly || (showDetails && isBlogPreview)
          ? "h-[414px]"
          : showDetails
            ? "h-[330px]"
            : "h-[500px]"
      }`}
    >
      <fieldset
        className={`relative z-10 m-0 flex w-[clamp(300px,27.85cqw,350px)] shrink-0 flex-col rounded-[15px] border border-[#e5e8eb] bg-white px-[19px] pb-[17px] pt-[18px] max-[860px]:h-auto max-[860px]:w-full ${
          selected?.promptOnly || (showDetails && isBlogPreview)
            ? "h-[414px]"
            : showDetails
              ? "h-[330px]"
              : "h-[500px]"
        }`}
        aria-label="카드뉴스 템플릿을 선택하세요"
      >
        <legend className="sr-only">템플릿 선택</legend>
        <div className="mb-[11px] border-b border-[#e5e8eb] pb-[20px] text-[18px] font-bold leading-[24px] text-black">
          템플릿 선택
        </div>
        {visible.map((c, index) => {
          const checked = selectedIds.includes(c.id);
          const active = c.id === selected?.id;
          const badge = String.fromCharCode(65 + index);
          return (
            <label
              key={c.id}
              className={`flex min-h-[47px] cursor-pointer items-center gap-[15px] rounded-full border px-[18px] py-[10px] transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#287aff] ${
                active
                  ? "border-[#287aff] bg-white drop-shadow-[0_0_2px_rgba(0,30,78,0.07)]"
                  : "border-transparent hover:bg-[#f7f8fa]"
              }`}
            >
              <input
                type="checkbox"
                name="tpl-concept"
                className="sr-only"
                value={c.id}
                checked={checked}
                autoComplete="off"
                onClick={(event) => {
                  // A click first opens an inactive template. Only a repeat
                  // click on the open template changes its checkbox state.
                  event.preventDefault();
                  if (active) onChange(c.id);
                  else onPreviewChange?.(c.id);
                }}
                aria-label={`템플릿 ${badge} ${c.name} — ${c.desc}`}
              />
              <span
                className={`w-[27px] shrink-0 text-center text-[18px] leading-5 ${active ? "text-[#287aff] font-bold" : "text-[#8e8e8e] font-medium"}`}
                aria-hidden="true"
              >
                {badge}
              </span>
              <span
                className={`min-w-0 flex-1 text-[18px] leading-5 ${active ? "text-[#287aff] font-bold" : "text-[#8e8e8e] font-medium"}`}
              >
                {c.name}
              </span>
              {checked && (
                <span className="flex size-[24px] shrink-0 items-center justify-center rounded-xl bg-[#287aff]">
                  <Icon name="check" className="size-[15px] text-white" />
                </span>
              )}
            </label>
          );
        })}
      </fieldset>

      {selected && (
        <div
          className={`relative z-20 ml-[clamp(-40px,-2.64cqw,-20px)] flex min-w-0 flex-1 items-center rounded-r-[15px] bg-white/20 ${showDetails ? "py-[18px]" : ""} pl-[clamp(38px,4.36cqw,66px)] pr-[clamp(24px,4.03cqw,61px)] max-[860px]:ml-0 max-[860px]:min-h-[317px] max-[860px]:rounded-[15px] max-[860px]:px-6 max-[860px]:py-5 max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:gap-5 ${
            selected.promptOnly || isBlogPreview
              ? "overflow-visible"
              : "overflow-hidden"
          }`}
        >
          <div
            className={`relative min-w-0 shrink-0 gap-[10px] overflow-hidden py-0 ${
              selected.promptOnly
                ? `grid max-h-[378px] ${showDetails ? "grid-cols-4" : "w-full grid-cols-3"} overflow-x-hidden overflow-y-auto`
                : isBlogPreview
                  ? `grid ${showDetails ? "w-[min(100%,562px)] gap-[10px]" : "w-[min(100%,378px)]"} grid-cols-2`
                  : showDetails
                    ? "flex max-[620px]:overflow-x-auto"
                    : "grid h-full w-[min(100%,378px)] grid-cols-2 grid-rows-2"
            }`}
          >
            {previewSlots.map((src, i) => (
              <PreviewCard
                key={i}
                src={src}
                index={i}
                promptOnly={selected.promptOnly}
                blogPreview={isBlogPreview}
                total={previewSlots.length}
                adConcept={selected.promptOnly ? AD_CONCEPTS[i] : null}
                adSelectedIds={adSelectedIds}
                onAdSelectionChange={onAdSelectionChange}
                variant={variant}
              />
            ))}
          </div>

          {showDetails && (
            <div className="ml-[clamp(18px,2.7cqw,41px)] flex min-w-0 flex-1 flex-col text-white max-[620px]:ml-0">
              <p className="text-[18px] font-bold leading-[24px]">{selected.name}</p>
              <div className="mt-[17px] flex min-h-[67px] items-stretch gap-[13px]"><span className="w-[3px] shrink-0 rounded-full bg-white" aria-hidden="true" /><p className="w-full text-[15px] break-keep font-normal leading-[1.54] text-white">{selected.desc}</p></div>
              <div className="mt-[36px] flex min-h-[47px] items-stretch gap-[13px]"><span className="w-[3px] shrink-0 rounded-full bg-white" aria-hidden="true" /><p className="w-full text-[15px] break-keep font-normal leading-[1.54] text-white">{selected.mood}</p></div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function PreviewCard({
  src,
  index,
  promptOnly,
  blogPreview,
  total,
  adConcept,
  adSelectedIds,
  onAdSelectionChange,
  variant,
}) {
  const selectable = Boolean(adConcept && onAdSelectionChange);
  const selected = selectable && adSelectedIds[0] === adConcept.id;
  const className = `${
    promptOnly
      ? variant === "legacy"
        ? "size-[184px]"
        : "aspect-square w-full"
      : blogPreview
        ? "aspect-[3/2] w-full"
        : variant === "legacy"
          ? "w-[clamp(140px,14.85cqw,184px)] h-[clamp(187px,14.85cqw,231px)]"
          : "h-full w-full"
  } shrink-0 overflow-hidden rounded-[15px] bg-[#d9d9d9] shadow-[5px_5px_15px_0px_rgba(0,30,78,0.15)] ${
    selectable
      ? "relative cursor-pointer border-2 p-0 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287aff]"
      : ""
  } ${selected ? "border-[#287aff] ring-2 ring-[#287aff]" : selectable ? "border-transparent hover:ring-2 hover:ring-white" : ""}`;

  const image = src && (
    <Image
      width={400}
      height={400}
      src={src}
      alt={adConcept?.name || ""}
      className="block h-full w-full object-cover object-center"
    />
  );

  if (!selectable) {
    return (
      <div className={className} style={{ zIndex: total - index }}>
        {image}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={{ zIndex: total - index }}
      aria-pressed={selected}
      aria-label={`${adConcept.name} 템플릿 ${selected ? "선택 해제" : "선택"}`}
      onClick={() => onAdSelectionChange([adConcept.id])}
    >
      {image}
      <span
        className={`absolute right-2 top-2 grid size-7 place-items-center rounded-full text-[15px] font-bold shadow-sm ${
          selected ? "bg-[#287aff] text-white" : "bg-white/90 text-[#6b7684]"
        }`}
        aria-hidden="true"
      >
        {selected ? "✓" : "+"}
      </span>
      <span className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-2 text-center text-[12px] font-bold leading-tight text-white">
        {adConcept.name}
      </span>
    </button>
  );
}
