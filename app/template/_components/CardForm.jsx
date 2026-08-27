"use client";

import { useEffect, useRef } from "react";
import { roleOf } from "../../../lib/templates.js";
import { findBanned } from "../../../lib/copywriter.js";
import { BANNED_PHRASES } from "../../../data/banned-phrases.js";
import { Icon } from "../../_components/Icon.jsx";
import { SectionDivider } from "./SectionDivider.jsx";

/** 노트형 본문에 넣을 수 있는 서식 — 커서 자리에 바로 꽂는다 (옛 INSERTS) */
const INSERTS = [
  { label: "강조", wrap: ["**", "**"], hint: "굵고 진하게" },
  { label: "하이라이트 바", line: "> ", hint: "검정 바 + 흰 글씨" },
  { label: "번호 목록", line: "1. ", hint: "번호 박스" },
  { label: "✅", text: "✅ " },
  { label: "👉", text: "👉 " },
  { label: "🔥", text: "🔥 " },
  { label: "💡", text: "💡 " },
  { label: "⚠️", text: "⚠️ " },
];

function Field({ slot, value, onChange, showTools, selected, fieldRef }) {
  const ref = useRef(null);
  const over = Boolean(slot.max) && value.length > slot.max;

  function insert(x) {
    const ta = ref.current;
    if (!ta) return;
    const a = ta.selectionStart;
    const b = ta.selectionEnd;
    const v = ta.value;
    const before = v.slice(0, a);
    const sel = v.slice(a, b);
    const after = v.slice(b);
    let next;
    let caret;
    if (x.wrap) {
      const inner = sel || "강조할 문구";
      next = before + x.wrap[0] + inner + x.wrap[1] + after;
      caret = (before + x.wrap[0] + inner + x.wrap[1]).length;
    } else if (x.line) {
      const ls = before.lastIndexOf("\n") + 1;
      next = before.slice(0, ls) + x.line + before.slice(ls) + sel + after;
      caret = (before.slice(0, ls) + x.line + before.slice(ls) + sel).length;
    } else {
      next = before + x.text + sel + after;
      caret = (before + x.text + sel).length;
    }
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  return (
    <div
      ref={fieldRef}
      className={`rounded-[12px] p-2 -m-2 transition-colors ${selected ? "bg-[#eef5ff] ring-2 ring-[#287aff]" : ""}`}
    >
      <div className="mb-[6px] flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <label htmlFor={`f-${slot.id}`} className="text-[15px] font-bold text-[#333d4b]">
            {slot.label}
          </label>
          <span
            className="text-[13px] text-[#5f6b7a]"
            // eslint-disable-next-line react/no-danger -- 우리가 lib/templates.js 에 직접 적은 정적 문자열이다(HTML 엔터티 포함)
            dangerouslySetInnerHTML={{ __html: slot.hint }}
          />
        </span>
        {Boolean(slot.max) && (
          <span className={`shrink-0 whitespace-nowrap text-[13px] ${over ? "font-bold text-[#e11d48]" : "text-[#5f6b7a]"}`}>
            {value.length} / {slot.max}자
          </span>
        )}
      </div>

      {slot.tag === "textarea" ? (
        <textarea
          ref={ref}
          id={`f-${slot.id}`}
          rows={slot.rows || 3}
          spellCheck={false}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y rounded-[12px] border border-[#e5e8eb] px-4 py-[13px] text-[15px] leading-[1.5] text-[#4e5968] outline-none focus-visible:border-[#287aff] focus-visible:ring-2 focus-visible:ring-[#287aff]/25"
        />
      ) : (
        <input
          id={`f-${slot.id}`}
          type="text"
          spellCheck={false}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[12px] border border-[#e5e8eb] px-4 py-[13px] text-[15px] text-[#4e5968] outline-none focus-visible:border-[#287aff] focus-visible:ring-2 focus-visible:ring-[#287aff]/25"
        />
      )}

      {showTools && (
        <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`${slot.label} 서식 도구`}>
          {INSERTS.map((x, i) => (
            <button
              key={i}
              type="button"
              onClick={() => insert(x)}
              title={x.hint || x.label}
              aria-label={`${slot.label}에 ${x.hint || x.label} 넣기`}
              className="rounded-full border border-[#e5e8eb] bg-white px-2.5 py-1 text-[12px] text-[#5f6b7a] transition hover:bg-[#f7f8fa]"
            >
              {x.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 카드 한 장의 슬롯 편집 폼. 옛 pages/template.js 의 `formHTML()`(문구 부분)에 대응한다.
 * 추가 텍스트 상자의 내용·정렬은 여기서 고치고, 위치·크기 드래그는 `CanvasPreview.jsx` 가 맡는다.
 * 피그마: https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=72-1399
 */
export function CardForm({
  conceptId,
  kind,
  slots,
  text,
  extraTexts = [],
  selectedObj,
  onFieldChange,
  onExtraTextChange,
  onDeleteExtraText,
}) {
  const rich = conceptId === "note" || (conceptId === "card" && roleOf("card", kind) !== "outro");
  const bannedText = ["title", "highlight", "body"].map((k) => text[k] || "").join("\n");
  const banned = findBanned(bannedText, BANNED_PHRASES);

  // 캔버스에서 오브젝트를 고르거나(선택) 새 텍스트 상자를 추가하면, 해당 칸을 찾기
  // 쉽게 화면을 그 칸으로 스크롤한다 (요청자 지적 — 아래쪽에 생겨서 못 찾겠다).
  const fieldRefs = useRef(new Map());
  const registerField = (id) => (el) => {
    if (el) fieldRefs.current.set(id, el);
    else fieldRefs.current.delete(id);
  };
  useEffect(() => {
    if (!selectedObj) return;
    fieldRefs.current
      .get(selectedObj)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedObj]);

  return (
    <div className="space-y-5">
      <SectionDivider title="문구" />

      <div className="space-y-6">
        {slots.map((slot) => (
          <Field
            key={slot.id}
            slot={slot}
            value={text[slot.id] ?? ""}
            onChange={(v) => onFieldChange(slot.id, v)}
            showTools={rich && slot.id === "body"}
            selected={selectedObj === slot.id}
            fieldRef={registerField(slot.id)}
          />
        ))}
      </div>

      {extraTexts.length > 0 && (
        <div className="space-y-4">
          <SectionDivider title="추가 텍스트 상자" />
          {extraTexts.map((item, index) => (
            <div
              key={item.id}
              ref={registerField(`extra-${item.id}`)}
              className={`space-y-2 rounded-[12px] p-3 -m-1 transition-colors ${selectedObj === `extra-${item.id}` ? "bg-[#eef5ff] ring-2 ring-[#287aff]" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`extra-${item.id}`} className="text-[15px] font-bold text-[#333d4b]">
                  텍스트 {index + 1}
                </label>
                <button
                  type="button"
                  onClick={() => onDeleteExtraText(item.id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] text-[#6b7684] transition hover:bg-[#f2f4f6] hover:text-[#e11d48]"
                  aria-label={`${index + 1}번째 텍스트 상자 삭제`}
                >
                  <Icon name="trash" className="size-4" /> 삭제
                </button>
              </div>
              <textarea
                id={`extra-${item.id}`}
                rows={2}
                spellCheck={false}
                autoComplete="off"
                value={item.text || ""}
                onChange={(event) => onExtraTextChange(item.id, { text: event.target.value })}
                className="w-full resize-y rounded-[12px] border border-[#e5e8eb] px-4 py-[13px] text-[15px] leading-[1.5] text-[#4e5968] outline-none focus-visible:border-[#287aff] focus-visible:ring-2 focus-visible:ring-[#287aff]/25"
              />
              <div className="flex gap-1.5" role="group" aria-label="텍스트 정렬">
                {["left", "center", "right"].map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => onExtraTextChange(item.id, { textAlign: align })}
                    aria-pressed={(item.textAlign || "left") === align}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] transition ${(item.textAlign || "left") === align ? "border-[#287aff] bg-[#edf5ff] font-bold text-[#287aff]" : "border-[#e5e8eb] text-[#6b7684] hover:bg-[#f7f8fa]"}`}
                  >
                    {{ left: "왼쪽", center: "가운데", right: "오른쪽" }[align]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {banned.length > 0 && (
        <div className="flex items-start gap-2 rounded-[12px] border border-[#ffd6d6] bg-[#fff5f5] p-3" role="alert">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-[#e11d48]" />
          <div className="text-[13px] leading-[1.5] text-[#c81e3a]">
            <strong className="block font-bold">게시 전 확인이 필요합니다</strong>
            <ul className="mt-1 list-disc pl-4">
              {banned.map((b) => (
                <li key={b}>금지 표현 포함: &ldquo;{b}&rdquo;</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
