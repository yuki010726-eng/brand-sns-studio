import { AWARD_BRANDS, MARKETER_STYLES, PROFILE_TYPES } from "../../../../lib/profile.js";
import { Icon } from "../../../_components/Icon.jsx";

const TYPE_ICON = { awards: "award", aitvcf: "sparkles", marketer: "user" };

/**
 * 계정 유형 3종 (브랜드 어워즈 / AI TV CF / 마케터) 선택.
 * 옛 pages/profile.js 의 `brandHTML()`·`marketerStyleHTML()` 을 그대로 옮겼다.
 *
 * ⚠️ 브랜드·마케터 방식 칩은 유형 `<label>` **밖의 형제 요소**로 둔다. 라벨 안에 넣으면
 *    칩 클릭이 라벨의 기본 동작(연결된 라디오 클릭)을 다시 먹어 칩이 눌리지 않는다
 *    (2026-08-11 실제로 겪은 문제, CLAUDE.md 8절 참고).
 */
export function ProfileTypePicker({ profile, onTypeChange, onBrandChange, onMarketerStyleChange }) {
  return (
    <fieldset className="grid grid-cols-3 gap-4 border-0 p-0 m-0 max-[720px]:grid-cols-1" aria-label="계정 유형을 선택하세요">
      <legend className="sr-only">계정 유형</legend>
      {PROFILE_TYPES.map((t) => {
        const checked = profile?.typeId === t.id;
        return (
          <div
            key={t.id}
            className={`flex flex-col gap-3 rounded-[15px] border p-5 transition ${
              checked ? "border-[#287aff] bg-[#eef5ff]" : "border-[#e5e8eb] bg-white"
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="ptype"
                className="sr-only"
                value={t.id}
                checked={checked}
                autoComplete="off"
                onChange={() => onTypeChange(t.id)}
                aria-label={`${t.label} — ${t.desc}`}
              />
              <span
                className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
                  checked ? "bg-[#287aff] text-white" : "bg-[#f2f4f6] text-[#8b95a1]"
                }`}
                aria-hidden="true"
              >
                <Icon name={TYPE_ICON[t.id] || "sparkles"} className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <strong className={`block text-[16px] font-bold ${checked ? "text-[#1b64da]" : "text-[#191f28]"}`}>
                  {t.label}
                </strong>
                <span className="mt-0.5 block text-[13px] leading-[1.5] text-[#5f6b7a]">{t.desc}</span>
              </span>
            </label>

            {t.id === "awards" && checked && (
              <BrandChips brandId={profile.brandId} onChange={onBrandChange} />
            )}
            {t.id === "marketer" && checked && (
              <MarketerStyleChips value={profile.marketerStyle || "symbol"} onChange={onMarketerStyleChange} />
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

function BrandChips({ brandId, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-[#287aff]/15 pt-3" role="group" aria-label="어느 브랜드인가요?">
      {AWARD_BRANDS.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onChange(b.id)}
          aria-pressed={brandId === b.id}
          className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
            brandId === b.id
              ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
              : "border-[#d1d6db] bg-white text-[#4e5968] hover:bg-[#f2f4f6]"
          }`}
        >
          {b.short}
        </button>
      ))}
    </div>
  );
}

function MarketerStyleChips({ value, onChange }) {
  return (
    <div
      className="flex flex-wrap gap-2 border-t border-[#287aff]/15 pt-3"
      role="group"
      aria-label="아바타를 심볼로 만들까요, 인물로 만들까요?"
    >
      {MARKETER_STYLES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          aria-pressed={value === m.id}
          aria-label={`${m.label} — ${m.desc}`}
          className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
            value === m.id
              ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
              : "border-[#d1d6db] bg-white text-[#4e5968] hover:bg-[#f2f4f6]"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
