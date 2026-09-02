"use client";

import { useEffect, useState } from "react";
import { DEFAULT_DIVIDER_WIDTH } from "../../../lib/cardrender.js";

/**
 * 매거진 t2·t4 구분선을 선택했을 때 뜨는 굵기 조정 패널.
 * 위치·길이는 캔버스 위 손잡이(끝점 드래그)로 바꾸고, 굵기만 여기서 숫자로 바꾼다 —
 * 굵기는 드래그로 표현할 손잡이가 없어서다.
 *
 * ⚠️ `data-layout-panel` 은 CanvasPreview 의 바깥 클릭 감지에서 "편집 영역"으로 취급하는
 *    선택자다. 지우면 이 패널을 누르는 순간 선택이 풀려 슬라이더를 못 움직인다.
 */
const MIN_WIDTH = 1;
const MAX_WIDTH = 10;

export function DividerPanel({ saved, onChange }) {
  const shown =
    Math.round((Number(saved.lineWidth) || DEFAULT_DIVIDER_WIDTH) * 10) / 10;
  const [value, setValue] = useState(shown);

  useEffect(() => {
    setValue(shown);
  }, [shown]);

  function commit(next) {
    const clamped = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, Number(next) || DEFAULT_DIVIDER_WIDTH),
    );
    setValue(clamped);
    onChange({ ...saved, lineWidth: clamped });
  }

  return (
    <div
      data-layout-panel
      className="space-y-3 rounded-[12px] border border-[#e5e8eb] bg-[#f7f8fa] p-4"
    >
      <h3 className="text-[15px] font-bold text-[#333d4b]">구분선 설정</h3>
      <label className="block space-y-1.5">
        <span className="block text-[13px] text-[#5f6b7a]">
          선 굵기 · {value}px
        </span>
        <input
          type="range"
          min={MIN_WIDTH}
          max={MAX_WIDTH}
          step={0.5}
          value={value}
          onChange={(e) => commit(e.target.value)}
          className="w-full accent-[#287aff]"
        />
      </label>
    </div>
  );
}
