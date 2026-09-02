"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  renderCard,
  cardAlt,
  lastClipped,
  lastBoxes,
  lastLines,
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
  const [lines, setLines] = useState({});
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
      setLines(lastLines());
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
  // ⚠️ 추가 텍스트 상자의 입력칸(`data-tpl-extra`, CardForm.jsx)도 편집 영역이다 — 빠지면
  //    본문을 고치려고 그 칸을 누르는 순간 선택이 풀려 LayoutPanel(글자 크기·굵기)이 사라진다.
  useEffect(() => {
    function onDocDown(e) {
      const inEditor = Boolean(
        e.target.closest?.("[data-tpl-handle]") ||
          e.target.closest?.("[data-canvas-wrap]") ||
          e.target.closest?.("[data-layout-panel]") ||
          e.target.closest?.("[data-tpl-extra]"),
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
    if (!wrap) return;
    const obj = objects.find((o) => o.id === objId);
    setIdle(false);
    selectObj(objId);
    const rect = wrap.getBoundingClientRect();

    // 선(구분선)은 상자가 아니라 두 끝점을 갖는다 — 끝점을 잡으면 길이·각도가,
    // 몸통을 잡으면 위치만 바뀐다.
    if (obj?.type === "line") {
      const cur = lines[objId];
      if (!cur) return;
      const startLine = {
        ...(opts.layout?.[objId] || {}),
        x1: cur.x1 / W,
        y1: cur.y1 / H,
        x2: cur.x2 / W,
        y2: cur.y2 / H,
        hidden: false,
      };
      dragRef.current = {
        objId,
        kind: "line",
        grip: grip || "move",
        startClientX: e.clientX,
        startClientY: e.clientY,
        startLine,
        rectW: rect.width,
        rectH: rect.height,
      };
      draftBoxRef.current = { ...startLine };
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", onDragEnd, { once: true });
      return;
    }

    const cur = boxes[objId];
    if (!cur) return;
    // Keep the saved text style in the draft layout while dragging.  The renderer
    // replaces a layout entry as a whole, so a geometry-only draft temporarily
    // fell back to the default font size/weight until pointerup committed the box.
    const startBox = {
      ...(opts.layout?.[objId] || {}),
      x: cur.x / W,
      y: cur.y / H,
      w: cur.w / W,
      h: cur.h / H,
    };
    dragRef.current = {
      objId,
      kind: "box",
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

    if (drag.kind === "line") {
      const { startLine, grip } = drag;
      const next = { ...startLine };
      if (grip === "start" || grip === "end") {
        const isStart = grip === "start";
        const anchor = isStart
          ? { x: startLine.x2, y: startLine.y2 }
          : { x: startLine.x1, y: startLine.y1 };
        let px = (isStart ? startLine.x1 : startLine.x2) + dx;
        let py = (isStart ? startLine.y1 : startLine.y2) + dy;
        // 디자인 툴처럼 Ctrl 을 누른 채 끝점을 끌면 반대쪽 끝점을 축으로 90도 단위(수평·수직)
        // 로만 움직인다. 캔버스가 정사각형이 아니라(1080×1350) 정규화 좌표 그대로 각도를
        // 재면 시각적으로 기울어져 보이므로, 반드시 캔버스 픽셀 공간(W·H 를 곱한 값)에서 잰다.
        if (e.ctrlKey || e.metaKey) {
          const vx = (px - anchor.x) * W;
          const vy = (py - anchor.y) * H;
          const dist = Math.hypot(vx, vy);
          if (dist > 0) {
            const angle = Math.atan2(vy, vx);
            const snapped = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
            px = anchor.x + (Math.cos(snapped) * dist) / W;
            py = anchor.y + (Math.sin(snapped) * dist) / H;
          }
        }
        if (isStart) {
          next.x1 = px;
          next.y1 = py;
        } else {
          next.x2 = px;
          next.y2 = py;
        }
      } else {
        next.x1 = startLine.x1 + dx;
        next.y1 = startLine.y1 + dy;
        next.x2 = startLine.x2 + dx;
        next.y2 = startLine.y2 + dy;
      }
      draftBoxRef.current = next;
      requestDragPaint();
      return;
    }

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
    const [dx, dy] = deltas[e.key];
    const obj = objects.find((o) => o.id === objId);

    if (obj?.type === "line") {
      const cur = lines[objId];
      if (!cur) return;
      const norm = opts.layout?.[objId] || {
        x1: cur.x1 / W,
        y1: cur.y1 / H,
        x2: cur.x2 / W,
        y2: cur.y2 / H,
      };
      onCommitLayout?.(objId, {
        ...norm,
        x1: norm.x1 + dx,
        y1: norm.y1 + dy,
        x2: norm.x2 + dx,
        y2: norm.y2 + dy,
        hidden: false,
      });
      return;
    }

    const cur = boxes[objId];
    if (!cur) return;
    const norm = opts.layout?.[objId] || {
      x: cur.x / W,
      y: cur.y / H,
      w: cur.w / W,
      h: cur.h / H,
    };
    onCommitLayout?.(objId, { ...norm, x: norm.x + dx, y: norm.y + dy });
  }

  const visibleObjects = objects.filter((o) => o.type !== "line" && boxes[o.id]);
  const visibleLines = objects.filter((o) => o.type === "line" && lines[o.id]);

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
      {visibleLines.length > 0 && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="pointer-events-none absolute inset-0 touch-none"
          aria-hidden="true"
        >
          {visibleLines.map((o) => {
            const ln = lines[o.id];
            const on = o.id === selectedObj;
            return (
              <g key={o.id} data-tpl-handle data-obj={o.id}>
                {/* 몸통 — 두꺼운 투명 히트 영역으로 몸통 전체를 드래그하면 옮겨진다 */}
                <line
                  x1={ln.x1}
                  y1={ln.y1}
                  x2={ln.x2}
                  y2={ln.y2}
                  stroke="transparent"
                  strokeWidth={28}
                  tabIndex={0}
                  role="button"
                  aria-pressed={on}
                  aria-label={`${o.label} 위치 — 드래그해서 옮기고, 방향키로도 옮길 수 있습니다`}
                  style={{ pointerEvents: "stroke", cursor: "move" }}
                  className="pointer-events-auto focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#287aff]"
                  onPointerDown={(e) => startDrag(e, o.id, null)}
                  onKeyDown={(e) => handleKeyDown(e, o.id)}
                />
                {/* 실제 선 — 눈에 보이는 안내선. 선택 중이 아니면 옅은 점선으로만 위치를 알린다 */}
                <line
                  x1={ln.x1}
                  y1={ln.y1}
                  x2={ln.x2}
                  y2={ln.y2}
                  stroke={on ? "#287aff" : "rgba(40,122,255,0.6)"}
                  strokeWidth={on ? 3 : 2}
                  strokeDasharray={on ? undefined : "8 6"}
                  style={{ pointerEvents: "none" }}
                />
                {/* 라벨 뱃지는 순수 SVG로는 CSS 트랜지션이 번거로워 foreignObject로 얹는다 */}
                <foreignObject
                  x={(ln.x1 + ln.x2) / 2 - 60}
                  y={Math.min(ln.y1, ln.y2) - 34}
                  width={120}
                  height={22}
                  className="pointer-events-none overflow-visible"
                >
                  <div
                    className={`mx-auto w-fit whitespace-nowrap rounded-full bg-[#1b64da] px-2 py-0.5 text-[11px] font-bold text-white transition-opacity duration-500 ${o.id === flashObj ? "opacity-100" : "opacity-0"}`}
                  >
                    {o.label}
                  </div>
                </foreignObject>
                {on && (
                  <>
                    <circle
                      cx={ln.x1}
                      cy={ln.y1}
                      r={16}
                      fill="#287aff"
                      stroke="#fff"
                      strokeWidth={2}
                      style={{ pointerEvents: "auto", cursor: "grab" }}
                      className="pointer-events-auto"
                      onPointerDown={(e) => startDrag(e, o.id, "start")}
                    />
                    <circle
                      cx={ln.x2}
                      cy={ln.y2}
                      r={16}
                      fill="#287aff"
                      stroke="#fff"
                      strokeWidth={2}
                      style={{ pointerEvents: "auto", cursor: "grab" }}
                      className="pointer-events-auto"
                      onPointerDown={(e) => startDrag(e, o.id, "end")}
                    />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
