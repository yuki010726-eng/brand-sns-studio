"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AI가 "~은 확인된 상품 사실에 포함되어 있지 않습니다" 같은 문장을 정직하게 써서 게시글에
 * 그대로 섞여 나가는 것을 막는 모달 (lib/missingdata.js 참고).
 *
 * 요청자 지시(2026-09-02): 데이터가 없으면 AI 생성을 일시정지하고, 데이터를 입력할 수 있는
 * 칸과 취소 버튼을 보여준다. 취소를 누르면 AI 생성을 멈춘다.
 *
 * ⚠️ 입력한 내용은 **이번 생성 1회에만** 쓰인다 — 상품 자료에 자동으로 저장되지 않는다.
 *    대신 Supabase `missing_data_reports`에 기록해 담당자가 나중에 검토한다
 *    (app/text/page.jsx의 submitMissingData/cancelMissingData가 reportMissingData를 부른다).
 *
 * @param {{subject:string, sentence:string}|null} notice null이면 닫혀 있다.
 * @param {(text:string) => void} onSubmit 입력한 보완 데이터로 다시 생성한다.
 * @param {() => void} onCancel AI 생성을 멈춘다.
 */
export function MissingDataModal({ notice, onSubmit, onCancel }) {
  const [text, setText] = useState("");
  const dialogRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!notice) return;
    setText("");
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    const onKeyDown = (event) => event.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

  if (!notice) return null;

  const trimmed = text.trim();

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 py-8"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="missing-data-title"
        aria-describedby="missing-data-desc"
        className="w-full max-w-[480px] rounded-[15px] border border-[#e5e8eb] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.25)] outline-none"
      >
        <header className="border-b border-[#e5e8eb] px-[26px] py-[22px]">
          <h2 id="missing-data-title" className="text-[18px] font-bold text-black">
            데이터가 없습니다
          </h2>
        </header>

        <div className="px-[26px] py-6">
          <p id="missing-data-desc" className="text-[15px] leading-relaxed text-[#4e5968]">
            <span className="font-bold text-black">『{notice.subject}』</span>
            에 대한 데이터가 없습니다. 데이터를 추가하거나 담당자에게 정보 업데이트를
            요청해주세요.
          </p>
          {notice.sentence && (
            <p className="mt-3 rounded-[10px] bg-[#f2f4f6] px-4 py-3 text-[13px] leading-relaxed text-[#8b95a1]">
              AI가 이렇게 답했어요 — “{notice.sentence}”
            </p>
          )}

          <label
            htmlFor="missing-data-input"
            className="mt-6 block text-[14px] font-bold text-black"
          >
            데이터 직접 입력 (선택)
          </label>
          <textarea
            id="missing-data-input"
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            placeholder="여기에 확인된 내용을 입력하면 이번 생성에만 반영됩니다."
            className="mt-2 w-full resize-none rounded-[12px] border border-[#e5e8eb] bg-white px-4 py-[14px] text-[15px] leading-[1.45] text-[#4e5968] shadow-[0_0_4px_rgba(0,30,78,0.07)] outline-none transition focus:border-[#287aff] focus:ring-2 focus:ring-[#287aff]/15"
          />
          <p className="mt-2 text-[12px] leading-relaxed text-[#8b95a1]">
            입력한 내용은 이번 생성 1회에만 사용되고, 담당자 확인을 위해 별도로
            기록됩니다. 상품 자료에는 자동으로 반영되지 않습니다.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#e5e8eb] px-[26px] py-[18px]">
          <button
            type="button"
            onClick={onCancel}
            aria-label="AI 생성 취소"
            className="h-[44px] rounded-full border border-[#e5e8eb] bg-white px-6 text-[15px] font-medium text-[#4e5968] hover:bg-[#f2f4f6]"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!trimmed}
            onClick={() => onSubmit(trimmed)}
            aria-label="입력한 내용으로 AI 생성 계속"
            className="h-[44px] rounded-full bg-[#287aff] px-6 text-[15px] font-bold text-white disabled:opacity-40"
          >
            이 내용으로 계속
          </button>
        </div>
      </section>
    </div>
  );
}
