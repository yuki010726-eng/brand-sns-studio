import { Icon } from "../../_components/Icon.jsx";

/**
 * 광고형 프롬프트 패널 — 배너 한 장의 프롬프트를 통째로 펼쳐 보여 준다.
 * 피그마: https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=146-949
 *
 * 옛 `AdCard.jsx` 는 카드가 여러 장이던 시절 배지("n번 · 표지")를 달고 접힌
 * `<details>` 안에 내용을 숨겼다. `lib/adprompt.js` 가 2026-08-28에 카드별 여러 장
 * 에서 배너 한 장으로 바뀌어 `buildAdPrompts()` 는 이제 항상 길이 1인 배열을
 * 돌려준다 — 목록도, 번호도, 접었다 펴는 토글도 필요 없다.
 */
export function AdPromptPanel({ item, tools, onCopy }) {
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
    <div>
      <div className="flex h-[47px] flex-wrap items-start justify-between gap-3 border-b border-[#e5e8eb] lg:-ml-5 lg:pl-5">
        <h2 className="text-[18px] font-bold text-black">프롬프트</h2>
        <div className="flex flex-wrap items-center gap-4">
          {tools.map((t) => (
            <a
              key={t.name}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t.name} 를 새 탭에서 열기`}
              className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#333d4b] transition hover:text-[#287aff]"
            >
              <Icon name="external" className="size-[15px]" />
              {t.name}
            </a>
          ))}
          <button
            type="button"
            onClick={() => onCopy(item)}
            aria-label="프롬프트 복사하기"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e8eb] bg-white px-3 py-1.5 text-[13px] font-bold text-[#5f6b7a] transition hover:bg-[#f7f8fa]"
          >
            <Icon name="copy" className="size-4" />
            복사
          </button>
        </div>
      </div>

      <p className="mt-5 text-[15px] font-bold leading-[1.4] text-black">
        {headline}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <dl className="space-y-2.5 text-[13px] leading-[1.5]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-[84px] shrink-0 font-bold text-black">
                {label}
              </dt>
              <dd className="min-w-0 text-[#5f6b7a]">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="relative min-h-[160px] md:min-h-0">
          <pre className="max-h-[260px] overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-[15px] bg-[#f2f4f6] p-3.5 text-[12px] leading-[1.6] text-[#5f6b7a] md:absolute md:inset-0 md:max-h-none">
            {item.prompt}
          </pre>
        </div>
      </div>
    </div>
  );
}
