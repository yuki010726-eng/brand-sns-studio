"use client";

import { lastBoxes, lastSizes, W, H } from "../../../lib/cardrender.js";

/**
 * 캔버스 위에서 오브젝트를 선택했을 때 뜨는 숫자 조정 패널.
 * 옛 pages/template.js 의 `layoutPanelHTML()`/`applyLayoutInputs()`에 대응한다.
 *
 * ⚠️ `data-layout-panel` 은 CanvasPreview 의 바깥 클릭 감지에서 "편집 영역"으로 취급하는
 *    선택자다. 지우면 이 패널의 숫자 입력을 누르는 순간 선택이 풀려 값을 못 바꾼다.
 */
const DEFAULT_SIZES = { brand: 36, eyebrow: 30, title: 82, footer: 30 };
const DEFAULT_WEIGHTS = { brand: 900, eyebrow: 700, title: 900, footer: 500 };
const WEIGHTS = [
  [400, "보통"],
  [500, "중간"],
  [700, "굵게"],
  [900, "아주 굵게"],
];

export function LayoutPanel({ objId, label, saved, onChange }) {
  const cur = lastBoxes()[objId];
  if (!cur) return null;

  const isExtra = objId.startsWith("extra-");
  const shownWeight = Number(saved.fontWeight) || DEFAULT_WEIGHTS[objId] || (isExtra ? 400 : 500);
  const measuredSize = lastSizes()[objId]?.size || null;
  const legacySize = saved.fontScale ? Math.round((DEFAULT_SIZES[objId] || 30) * saved.fontScale) : null;
  const shownSize = Math.round(
    Number(saved.fontSize) || measuredSize || legacySize || DEFAULT_SIZES[objId] || (isExtra ? 40 : 30),
  );

  function commitSize(value) {
    const oldSize = Number(saved.fontSize) || measuredSize || DEFAULT_SIZES[objId] || 30;
    const nextSize = Math.min(180, Math.max(12, Number(value) || oldSize));
    const next = { ...saved, fontSize: nextSize };
    delete next.fontScale;
    // 키울 때만 기존 상자가 글자를 자르지 않도록 함께 확장한다.
    // 줄일 때는 배치 영역까지 작아지지 않도록 사용자가 잡아 둔 상자 크기를 그대로 둔다.
    const ratio = nextSize / oldSize;
    if (ratio > 1) {
      next.w = (cur.w * ratio) / W;
      next.h = (cur.h * ratio) / H;
    }
    onChange(next);
  }

  function commitWeight(value) {
    onChange({ ...saved, fontWeight: Number(value) || saved.fontWeight });
  }

  return (
    <div data-layout-panel className="space-y-3 rounded-[12px] border border-[#e5e8eb] bg-[#f7f8fa] p-4">
      <h3 className="text-[15px] font-bold text-[#333d4b]">{label} 텍스트 설정</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="block text-[13px] text-[#5f6b7a]">텍스트 크기 (px)</span>
          <input
            key={objId}
            type="number"
            min={12}
            max={180}
            step={1}
            defaultValue={shownSize}
            onBlur={(e) => commitSize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-full rounded-[10px] border border-[#e5e8eb] px-3 py-2 text-[15px] text-[#4e5968] outline-none focus-visible:border-[#287aff] focus-visible:ring-2 focus-visible:ring-[#287aff]/25"
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-[13px] text-[#5f6b7a]">텍스트 굵기</span>
          <select
            value={shownWeight}
            onChange={(e) => commitWeight(e.target.value)}
            className="w-full rounded-[10px] border border-[#e5e8eb] px-3 py-2 text-[15px] text-[#4e5968] outline-none focus-visible:border-[#287aff] focus-visible:ring-2 focus-visible:ring-[#287aff]/25"
          >
            {WEIGHTS.map(([v, w]) => (
              <option key={v} value={v}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
