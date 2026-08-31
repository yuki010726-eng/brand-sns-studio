import { AD_CONCEPTS, adThumbSvg } from "../../../lib/adprompt.js";

/**
 * 광고형(D) 전용 — **인물·색·화풍 컨셉** 선택. 카드뉴스 템플릿(A·B·C·D)과는 다른 축이다.
 * 피그마: https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=146-949
 *
 * ⚠️ 컨셉은 주제 하나에 하나다 (`lib/adprompt.js` 머리말 참고). 여기서 고르면 배너가
 *    다시 만들어진다 — 장마다 다른 컨셉을 고르는 UI 를 만들지 말 것.
 * ⚠️ `lib/adprompt.js` 가 2026-08-28에 카드별 여러 장에서 배너 한 장으로 바뀌어
 *    "N장을 같은 사람·색·그림체로" 문구는 더 이상 맞지 않는다 — 지금은 이 한 장의
 *    인물·색·화풍을 정하는 자리다.
 * ⚠️ 견본(`adThumbSvg`)은 실제 생성 이미지가 아니라 배치·색 견본이다. 고정 사진을 박아 두면
 *    "재활용처럼 보인다"는 지적(8-30)으로 되돌아간다.
 */
export function AdConceptPicker({ value, toneLabel, isManualPick, onChange }) {
  const selected = AD_CONCEPTS.find((c) => c.id === value) || AD_CONCEPTS[0];

  return (
    <fieldset className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-6 max-[620px]:grid-cols-1">
      <legend className="sr-only">이미지 컨셉 선택</legend>
      <div
        className="flex w-max flex-col gap-2"
        role="radiogroup"
        aria-label="이미지 컨셉 선택"
      >
        {AD_CONCEPTS.map((c) => {
          const checked = c.id === value;
          return (
            <label
              key={c.id}
              className={`flex w-full cursor-pointer items-center gap-[15px] whitespace-nowrap rounded-full border px-[18px] py-[11px] text-[15px] transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#287aff] ${
                checked
                  ? "border-[#287aff] bg-white font-bold text-[#287aff] drop-shadow-[0_0_2px_rgba(0,30,78,0.07)]"
                  : "border-[#e5e8eb] bg-white font-medium text-[#4e5968] hover:bg-[#f7f8fa]"
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

      <div className="flex min-w-0 items-center gap-6 max-[920px]:flex-col max-[920px]:items-start max-[620px]:flex-row max-[520px]:flex-col">
        <span
          className="size-[194px] shrink-0 overflow-hidden rounded-[11px] border border-[#e5e8eb]"
          aria-hidden="true"
          dangerouslySetInnerHTML={{
            __html: adThumbSvg(selected, { size: 194, id: "sel" }),
          }}
        />
        <div className="min-w-0">
          <p className="text-[18px] font-bold text-black">{selected.name}</p>
          {/*
            ⚠️ 컨셉마다 다른 설명(`who`·`when`·`desc`)이다. 여기서 빼면 알약 이름만
               남아 8-31 ③ 의 「컨셉을 저렇게 말해주면 누가 알아듣겠냐」로 되돌아간다.
          */}
          <p className="mt-2 text-[13px] leading-[1.6] text-[#5f6b7a]">
            {selected.who} · {selected.when}
            <br />
            {selected.desc}
          </p>
          <p className="mt-2 text-[13px] leading-[1.6] text-[#5f6b7a]">
            {isManualPick
              ? "직접 고른 컨셉입니다."
              : `톤 「${toneLabel}」에 맞춰 골라 뒀습니다.`}{" "}
            다른 톤을 쓰려면 1단계에서 바꾸세요.
          </p>
        </div>
      </div>
    </fieldset>
  );
}
