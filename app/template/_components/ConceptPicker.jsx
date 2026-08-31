import Image from "next/image.js";
import { Icon } from "../../_components/Icon.jsx";

/**
 * 템플릿 선택 — 왼쪽 목록 + 오른쪽 미리보기·설명 패널.
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
export function ConceptPicker({ concepts, value, onChange }) {
  const visible = concepts;
  const selected = visible.find((c) => c.id === value) || visible[0];
  const previewSlots =
    selected?.previewImages?.length > 0
      ? selected.previewImages
      : new Array(PLACEHOLDER_COUNT).fill(null);

  return (
    <div className="relative flex h-[317px] w-full mb-[95px] [container-type:inline-size] max-[860px]:h-auto max-[860px]:flex-col">
      <fieldset
        className="relative z-10 m-0 flex h-[317px] w-[clamp(300px,27.85cqw,350px)] shrink-0 flex-col rounded-[15px] border border-[#e5e8eb] bg-white px-[19px] pb-[17px] pt-[18px] max-[860px]:h-auto max-[860px]:w-full"
        aria-label="카드뉴스 템플릿을 선택하세요"
      >
        <legend className="sr-only">템플릿 선택</legend>
        <div className="mb-[11px] border-b border-[#e5e8eb] pb-[20px] text-[18px] font-bold leading-[24px] text-black">
          템플릿 선택
        </div>
        {visible.map((c) => {
          const checked = c.id === value;
          return (
            <label
              key={c.id}
              className={`flex min-h-[47px] cursor-pointer items-center gap-[15px] rounded-full border px-[18px] py-[10px] transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#287aff] ${
                checked
                  ? "border-[#287aff] bg-white drop-shadow-[0_0_2px_rgba(0,30,78,0.07)]"
                  : "border-transparent hover:bg-[#f7f8fa]"
              }`}
            >
              <input
                type="radio"
                name="tpl-concept"
                className="sr-only"
                value={c.id}
                checked={checked}
                autoComplete="off"
                onChange={() => onChange(c.id)}
                aria-label={`템플릿 ${c.badge} ${c.name} — ${c.desc}`}
              />
              <span
                className={`w-[27px] shrink-0 text-center text-[18px] leading-5 ${checked ? "text-[#287aff] font-bold" : "text-[#8e8e8e] font-medium"}`}
                aria-hidden="true"
              >
                {c.badge}
              </span>
              <span
                className={`min-w-0 flex-1 text-[18px] leading-5 ${checked ? "text-[#287aff] font-bold" : "text-[#8e8e8e] font-medium"}`}
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
        <div className="ml-[clamp(-40px,-2.64cqw,-20px)] flex min-w-0 flex-1 items-center overflow-hidden rounded-r-[15px] bg-white/20 py-[18px] pl-[clamp(38px,4.36cqw,66px)] pr-[clamp(24px,4.03cqw,61px)] max-[860px]:ml-0 max-[860px]:min-h-[317px] max-[860px]:rounded-[15px] max-[860px]:px-6 max-[860px]:py-5 max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:gap-5">
          <div className="flex min-w-0 shrink-0 gap-[10px] overflow-hidden py-0 max-[620px]:overflow-x-auto">
            {previewSlots.map((src, i) => (
              <div
                key={i}
                className="w-[clamp(140px,14.85cqw,184px)] h-[clamp(187px,14.85cqw,231px)] shrink-0 overflow-hidden rounded-[15px] bg-[#d9d9d9] shadow-[5px_5px_15px_0px_rgba(0,30,78,0.15)]"
                style={{
                  zIndex: previewSlots.length - i,
                }}
              >
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <Image
                    width={400}
                    height={400}
                    src={src}
                    alt=""
                    className="block h-full w-full object-cover object-center"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="ml-[clamp(18px,2.7cqw,41px)] flex min-w-0 flex-1 flex-col text-white max-[620px]:ml-0">
            <p className="text-[18px] font-bold leading-[24px]">
              {selected.name}
            </p>
            <div className="mt-[17px] flex min-h-[67px] items-stretch gap-[13px]">
              <span
                className="w-[3px] shrink-0 rounded-full bg-white"
                aria-hidden="true"
              />
              <p className="w-full text-[15px] break-keep font-normal leading-[1.54] text-white">
                {selected.desc}
              </p>
            </div>
            <div className="mt-[36px] flex min-h-[47px] items-stretch gap-[13px]">
              <span
                className="w-[3px] shrink-0 rounded-full bg-white"
                aria-hidden="true"
              />
              <p className="w-full text-[15px] break-keep font-normal leading-[1.54] text-white">
                {selected.mood}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
