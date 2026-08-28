import { Icon } from "../../_components/Icon.jsx";
import { roleLabel } from "../../../lib/adprompt.js";

/**
 * 직관형 프롬프트 한 장 — 무엇이 찍히는지(헤드라인) 먼저 보이고, 전문은 접어 둔다.
 * 옛 pages/template.js 의 `adCardHTML()` 을 그대로 옮긴 것이다.
 */
export function AdCard({ item, onCopy }) {
  const c = item.copy;
  const headline = [c.line1, c.line2].filter(Boolean).join(" ");
  const rows = [
    ["말풍선", c.hook],
    ["보조 문구", c.sub],
    ["숫자 강조", c.number],
    ["체크 리스트", c.bullets.join(" · ")],
    ["하단 CTA", c.cta],
  ].filter(([, value]) => value);

  return (
    <article className="rounded-[15px] border border-[#e5e8eb] bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-[#f2f4f6] px-[11px] py-[3px] text-[12px] font-bold text-[#5f6b7a]">
          {item.n}번 · {roleLabel(item.role)}
        </span>
        <button
          type="button"
          onClick={() => onCopy(item)}
          aria-label={`${item.n}번 프롬프트 복사하기`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e8eb] bg-white px-3 py-1.5 text-[13px] font-bold text-[#5f6b7a] transition hover:bg-[#f7f8fa]"
        >
          <Icon name="copy" className="size-4" />
          복사
        </button>
      </div>

      <p className="mt-3 text-[15px] font-bold leading-[1.4] text-black">
        {headline}
      </p>

      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] font-bold text-[#287aff] [&::-webkit-details-marker]:hidden">
          자세히
        </summary>
        <dl className="mt-3 space-y-1.5 text-[13px] leading-[1.5]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="shrink-0 font-bold text-[#4e5968]">{label}</dt>
              <dd className="min-w-0 text-[#8b95a1]">{value}</dd>
            </div>
          ))}
        </dl>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-[8px] bg-[#f2f4f6] p-3 text-[12px] leading-[1.6] text-[#5f6b7a]">
          {item.prompt}
        </pre>
      </details>
    </article>
  );
}
