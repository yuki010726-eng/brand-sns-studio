import { AD_CONCEPTS, adThumbSvg } from "../../../lib/adprompt.js";

/**
 * 광고형(D) 전용 — **인물·색·화풍 컨셉** 선택. 카드뉴스 템플릿(A·B·C·D)과는 다른 축이다.
 *
 * ⚠️ 컨셉은 주제 하나에 하나다 (`lib/adprompt.js` 머리말 참고). 여기서 고르면 전 장이
 *    한꺼번에 다시 만들어진다 — 장마다 다른 컨셉을 고르는 UI 를 만들지 말 것.
 * ⚠️ 견본(`adThumbSvg`)은 실제 생성 이미지가 아니라 배치·색 견본이다. 고정 사진을 박아 두면
 *    "재활용처럼 보인다"는 지적(8-30)으로 되돌아간다.
 */
export function AdConceptPicker({ value, toneLabel, isManualPick, count, onChange }) {
  const selected = AD_CONCEPTS.find((c) => c.id === value) || AD_CONCEPTS[0];

  return (
    <fieldset className="m-0">
      <legend className="mb-3 text-[15px] font-bold text-black">컨셉</legend>
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="이미지 컨셉 선택"
      >
        {AD_CONCEPTS.map((c) => {
          const checked = c.id === value;
          return (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-[14px] py-[9px] text-[14px] font-bold transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#287aff] ${
                checked
                  ? "border-[#191f28] bg-[#191f28] text-white"
                  : "border-[#e5e8eb] bg-white text-[#5f6b7a] hover:bg-[#f7f8fa]"
              }`}
            >
              <input
                type="radio"
                name="adconcept"
                className="sr-only"
                value={c.id}
                checked={checked}
                autoComplete="off"
                onChange={() => onChange(c.id)}
                aria-label={`${c.name} — ${c.who}. ${c.when}`}
              />
              <span
                className="size-[22px] shrink-0 overflow-hidden rounded-[6px]"
                aria-hidden="true"
                dangerouslySetInnerHTML={{
                  __html: adThumbSvg(c, { size: 22, id: `pick-${c.id}` }),
                }}
              />
              {c.name}
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <span
          className="size-[88px] shrink-0 overflow-hidden rounded-[12px]"
          aria-hidden="true"
          dangerouslySetInnerHTML={{
            __html: adThumbSvg(selected, { size: 88, id: "sel" }),
          }}
        />
        <p className="text-[13px] leading-[1.6] text-[#5f6b7a]">
          {selected.who} · {selected.when}
          <br />
          <strong className="text-[#333d4b]">{count}장</strong>을 같은 사람·색·그림체로 만듭니다.{" "}
          {isManualPick
            ? "직접 고른 컨셉입니다."
            : `톤 「${toneLabel}」에 맞춰 골라 뒀습니다.`}{" "}
          장수와 톤은 1단계에서 정합니다.
        </p>
      </div>
    </fieldset>
  );
}
