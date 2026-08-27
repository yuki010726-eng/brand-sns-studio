import { SectionDivider } from "./SectionDivider.jsx";

/**
 * 재사용 스와치 라디오 그룹 — 강조색/테마색/마크/종이색/글씨색/심볼이 전부 이 모양을 쓴다.
 * 프리셋 칩 + (선택) `#RRGGBB` 직접 입력. 대비가 기준에 못 미쳐도 막지 않고 `hint`로만 알린다
 * (요청자 지시: 직접 입력을 막지 말 것 — CLAUDE.md 8절 참고).
 *
 * `hintPlacement="inline"` 이면 제목 옆 구분선에 짧은 설명을 함께 단다(강조 색상처럼 고정된
 * 한 줄 안내). 길고 상황에 따라 달라지는 안내(대비 경고 등)는 기본값인 "below"로 칩 아래에 둔다.
 * 피그마: https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=72-1399
 */
export function SwatchPicker({
  legend,
  name,
  options,
  value,
  onChange,
  hint,
  hintPlacement = "below",
  custom,
  onCustomChange,
}) {
  return (
    <div>
      <SectionDivider title={legend} description={hintPlacement === "inline" ? hint : null} />
      <fieldset className="mt-4 flex flex-wrap gap-[10px]" aria-label={`${legend}를 선택하세요`}>
        <legend className="sr-only">{legend}를 선택하세요</legend>
        {options.map((o) => {
          const checked = String(o.id).toLowerCase() === String(value).toLowerCase();
          return (
            <label
              key={o.id}
              className={`inline-flex cursor-pointer items-center gap-[7px] rounded-full border px-[14px] py-[10px] text-[13px] transition ${checked ? "border-[#287aff] bg-white font-bold text-[#191f28] shadow-[0_0_0_1px_#1b64da]" : "border-[#e5e8eb] bg-white font-normal text-[#5f6b7a] hover:bg-[#f7f8fa]"}`}
            >
              <input
                type="radio"
                name={name}
                value={o.id}
                checked={checked}
                onChange={() => onChange(o.id)}
                autoComplete="off"
                className="sr-only"
                aria-label={`${legend} ${o.name}`}
              />
              {o.hex && (
                <span
                  className="size-5 rounded-full border border-black/10"
                  style={{ background: o.hex }}
                  aria-hidden="true"
                />
              )}
              {o.name}
            </label>
          );
        })}
        {custom && (
          <label
            className="inline-flex cursor-pointer items-center gap-[7px] rounded-full border border-[#e5e8eb] bg-white px-[14px] py-[10px] text-[13px] font-normal text-[#5f6b7a]"
            title="원하는 색상 직접 선택"
          >
            <span
              className="relative inline-flex size-5 shrink-0 items-center justify-center rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.16)]"
              style={{
                background:
                  "conic-gradient(from 180deg, #ff6b6b, #ffa23a, #fdf25c, #b9f73e, #5fe1ff, #287aff, #ff6b6b)",
              }}
              aria-hidden="true"
            >
              <span className="absolute inset-0 rounded-full shadow-[inset_0_0_0_2px_white]" />
              <input
                type="color"
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                value={custom.value}
                autoComplete="off"
                onChange={(e) => onCustomChange(e.target.value)}
                aria-label="원하는 색상 직접 선택"
              />
            </span>
            직접 선택
          </label>
        )}
      </fieldset>
      {hint && hintPlacement !== "inline" && (
        <p className="mt-2 text-[13px] leading-[1.5] text-[#5f6b7a]">{hint}</p>
      )}
    </div>
  );
}
