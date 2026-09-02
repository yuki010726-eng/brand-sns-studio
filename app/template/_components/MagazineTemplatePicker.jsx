"use client";

/**
 * 매거진형 세부 템플릿(1~4) 선택 — 옛 카드 탭(01~06, 표지/본문/마무리) 자리를 대신한다.
 *
 * 매거진형은 이제 표지 한 장만 만든다 (`app/template/page.jsx` 의 덱 자르기).
 * 그래서 "어느 카드를 편집할지"가 아니라 "어느 배치를 쓸지"를 고르는 자리로 바뀌었고,
 * 그 모양은 카드 탭(`CardTabs.jsx`)의 알약 버튼과 같게 맞춰 화면이 갑자기 낯설어지지 않게 했다.
 *
 * 피그마: 템플릿 2 https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=206-16 ·
 *         템플릿 3 https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=206-23 ·
 *         템플릿 4 https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=206-36
 */
export function MagazineTemplatePicker({ templates, value, onChange }) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label="매거진 템플릿 선택"
    >
      {templates.map((tpl) => {
        const on = tpl.id === value;
        return (
          <button
            key={tpl.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(tpl.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-[18px] py-[10px] text-[15px] font-bold transition ${on ? "border-[#287aff] bg-[#287aff] text-white" : "border-[#e5e8eb] bg-white text-[#5f6b7a] hover:bg-[#f7f8fa]"}`}
          >
            {tpl.name}
          </button>
        );
      })}
    </div>
  );
}
