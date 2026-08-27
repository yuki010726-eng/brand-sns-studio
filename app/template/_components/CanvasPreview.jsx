"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  renderCard,
  cardAlt,
  lastClipped,
  lastBoxes,
  W,
  H,
} from "../../../lib/cardrender.js";

/**
 * 카드 미리보기 캔버스 + 오브젝트 자유 배치(드래그·리사이즈) 손잡이.
 * 옛 pages/template.js 의 `paint()`/`schedulePaint()`/`requestPaint()`/`startDrag()`/`onDragMove()`/
 * `onDragEnd()`/`syncOverlay()` 를 이 컴포넌트 하나로 옮긴 것이다.
 *
 * - 글자 하나마다 큰 캔버스를 다시 그리지 않도록 120ms 모아서 그린다(문구 입력 등 일반 변경).
 * - 드래그 중에는 rAF 로 매 프레임 다시 그린다 — 디바운스로는 손을 뗄 때까지 캔버스가 멈춰 보인다.
 * - 손잡이 좌표는 렌더러가 실제로 그린 자리(`lastBoxes()`)에서 얻는다. 그래야 자동 배치든
 *   오버라이드든 손잡이가 늘 진짜 결과와 일치한다. 그린 직후에만 유효하다(매번 비워진다).
 */
const GRIPS = ["nw", "ne", "sw", "se"];

const GRIP_POS = {
  nw: "-left-[7px] -top-[7px] cursor-nwse-resize",
  ne: "-right-[7px] -top-[7px] cursor-nesw-resize",
  sw: "-left-[7px] -bottom-[7px] cursor-nesw-resize",
  se: "-right-[7px] -bottom-[7px] cursor-nwse-resize",
};

export function CanvasPreview({
  texts,
  opts,
  cardIndex,
  objects = [],
  selectedObj,
  onSelectObj,
  onCommitLayout,
  onClipped,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);
  const dragRef = useRef(null);
  const draftBoxRef = useRef(null);
  const rafScheduled = useRef(false);
  const flashTimerRef = useRef(null);
  const [boxes, setBoxes] = useState({});
  const [idle, setIdle] = useState(true);
  const [flashObj, setFlashObj] = useState(null);

  const draw = useCallback(
    (renderOpts) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderCard(canvas, texts, renderOpts);
      canvas.setAttribute("aria-label", cardAlt(texts, cardIndex));
      onClipped?.(lastClipped());
      setBoxes(lastBoxes());
    },
    [texts, cardIndex, onClipped],
  );

  // 문구 편집 등 일반 변경 — 120ms 모아서 그린다. 드래그 중에는 rAF 경로가 대신 그린다.
  useEffect(() => {
    if (dragRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => draw(opts), 120);
    return () => clearTimeout(timerRef.current);
  }, [texts, opts, draw]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onDragMove);
      clearTimeout(timerRef.current);
      clearTimeout(flashTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 언마운트 정리 전용
  }, []);

  // 편집 영역 밖을 누르면 점선을 숨긴다 (요청자 지적 2026-08-14 "파란 점점점이 시야에 방해").
  // 캔버스와 숫자 입력 패널(#tpl-layout-slot 대응)은 편집 영역이라 여기서 뺀다.
  useEffect(() => {
    function onDocDown(e) {
      const inEditor = Boolean(
        e.target.closest?.("[data-tpl-handle]") ||
          e.target.closest?.("[data-canvas-wrap]") ||
          e.target.closest?.("[data-layout-panel]"),
      );
      if (inEditor) {
        setIdle(false);
        return;
      }
      if (!selectedObj && idle) return;
      onSelectObj?.(null);
      setIdle(true);
    }
    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, [onSelectObj, selectedObj, idle]);

  function selectObj(objId) {
    onSelectObj?.(objId);
    setFlashObj(objId);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashObj(null), 1400);
  }

  function requestDragPaint() {
    if (rafScheduled.current) return;
    rafScheduled.current = true;
    requestAnimationFrame(() => {
      rafScheduled.current = false;
      const drag = dragRef.current;
      if (!drag || !draftBoxRef.current) return;
      draw({ ...opts, layout: { ...opts.layout, [drag.objId]: draftBoxRef.current } });
    });
  }

  function startDrag(e, objId, grip) {
    e.preventDefault();
    const wrap = wrapRef.current;
    const cur = boxes[objId];
    if (!wrap || !cur) return;
    setIdle(false);
    selectObj(objId);
    const rect = wrap.getBoundingClientRect();
    const startBox = { x: cur.x / W, y: cur.y / H, w: cur.w / W, h: cur.h / H };
    dragRef.current = {
      objId,
      grip: grip || null,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox,
      rectW: rect.width,
      rectH: rect.height,
    };
    draftBoxRef.current = { ...startBox };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd, { once: true });
  }

  function onDragMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startClientX) / drag.rectW;
    const dy = (e.clientY - drag.startClientY) / drag.rectH;
    const { startBox, grip } = drag;
    const box = { ...startBox };
    if (!grip) {
      box.x = startBox.x + dx;
      box.y = startBox.y + dy;
    } else {
      if (grip.includes("w")) {
        box.x = startBox.x + dx;
        box.w = startBox.w - dx;
      }
      if (grip.includes("e")) box.w = startBox.w + dx;
      if (grip.includes("n")) {
        box.y = startBox.y + dy;
        box.h = startBox.h - dy;
      }
      if (grip.includes("s")) box.h = startBox.h + dy;
    }
    // 완전히 뒤집히거나 0에 가까워지지 않게만 막는다 — 그 밖의 자유는 막지 않는다
    box.w = Math.max(0.03, box.w);
    box.h = Math.max(0.02, box.h);
    draftBoxRef.current = box;
    requestDragPaint();
  }

  function onDragEnd(e) {
    window.removeEventListener("pointermove", onDragMove);
    const drag = dragRef.current;
    if (!drag) return;
    const movedPx = Math.hypot(
      (e.clientX ?? drag.startClientX) - drag.startClientX,
      (e.clientY ?? drag.startClientY) - drag.startClientY,
    );
    const finalBox = draftBoxRef.current ? { ...draftBoxRef.current } : null;
    dragRef.current = null;
    draftBoxRef.current = null;
    // 클릭할 때 생기는 미세한 손떨림은 이동으로 보지 않는다.
    if (movedPx >= 8 && finalBox) onCommitLayout?.(drag.objId, finalBox);
    else draw(opts);
  }

  function handleKeyDown(e, objId) {
    if (e.key === "Escape") {
      onSelectObj?.(null);
      return;
    }
    const step = e.shiftKey ? 0.02 : 0.005;
    const deltas = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (!(e.key in deltas)) return;
    e.preventDefault();
    selectObj(objId);
    const cur = boxes[objId];
    if (!cur) return;
    const norm = opts.layout?.[objId] || {
      x: cur.x / W,
      y: cur.y / H,
      w: cur.w / W,
      h: cur.h / H,
    };
    const [dx, dy] = deltas[e.key];
    onCommitLayout?.(objId, { ...norm, x: norm.x + dx, y: norm.y + dy });
  }

  const visibleObjects = objects.filter((o) => boxes[o.id]);

  return (
    <div ref={wrapRef} data-canvas-wrap className="relative">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        role="img"
        aria-label={cardAlt(texts, cardIndex)}
        className="aspect-[4/5] w-full rounded-[15px] border border-[#e5e8eb] bg-[#f2f4f6]"
      />
      {visibleObjects.length > 0 && (
        <div className="pointer-events-none absolute inset-0 touch-none">
          {visibleObjects.map((o) => {
            const box = boxes[o.id];
            const on = o.id === selectedObj;
            const style = {
              left: `${(box.x / W) * 100}%`,
              top: `${(box.y / H) * 100}%`,
              width: `${(box.w / W) * 100}%`,
              height: `${(box.h / H) * 100}%`,
            };
            const borderClass = on
              ? "border-solid border-[#287aff] bg-[#287aff]/10"
              : idle
                ? "border-transparent bg-transparent hover:border-[#287aff]/45 hover:bg-[#287aff]/[0.06]"
                : "border-dashed border-[#287aff]/75 bg-[#287aff]/5 hover:bg-[#287aff]/[0.12]";
            return (
              <div
                key={o.id}
                data-tpl-handle
                data-obj={o.id}
                tabIndex={0}
                role="button"
                aria-pressed={on}
                aria-label={`${o.label} 위치·크기 — 드래그하거나 방향키로 옮기고, 아래 숫자 입력으로도 조정할 수 있습니다`}
                style={style}
                onPointerDown={(e) => {
                  const grip = e.target.closest("[data-grip]");
                  startDrag(e, o.id, grip?.dataset.grip || null);
                }}
                onKeyDown={(e) => handleKeyDown(e, o.id)}
                className={`pointer-events-auto absolute cursor-move touch-none rounded-[6px] border-[1.5px] transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#287aff] ${borderClass} ${o.id === "image" ? "z-0" : "z-[1]"}`}
              >
                <span
                  className={`pointer-events-none absolute -top-[22px] left-0 whitespace-nowrap rounded-full bg-[#1b64da] px-2 py-0.5 text-[11px] font-bold text-white transition-opacity duration-500 ${o.id === flashObj ? "opacity-100" : "opacity-0"}`}
                >
                  {o.label}
                </span>
                {on &&
                  GRIPS.map((gr) => (
                    <span
                      key={gr}
                      data-grip={gr}
                      className={`pointer-events-auto absolute size-3.5 rounded-full border-2 border-white bg-[#287aff] shadow-[0_1px_3px_rgba(0,0,0,0.3)] ${GRIP_POS[gr]}`}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
