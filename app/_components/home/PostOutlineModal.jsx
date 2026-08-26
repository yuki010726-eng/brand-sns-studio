"use client";

import { useEffect, useRef, useState } from "react";
import { CHANNELS } from "../../../data/channels.js";
import { Icon } from "../Icon.jsx";
import { TONES } from "./TopicSection.jsx";

const fieldClass =
  "min-h-[50px] w-full resize-none overflow-hidden rounded-[12px] border border-[#e5e8eb] bg-white px-4 py-[14px] text-[15px] leading-[1.45] text-[#4e5968] shadow-[0_0_4px_rgba(0,30,78,0.07)] outline-none transition focus:border-[#287aff] focus:ring-2 focus:ring-[#287aff]/15";

function makeOutline(state, product) {
  const topic = state.topic.trim();
  const focus = String(state.focusPoint || "").trim();
  const bodyCount = Math.max(1, Math.min(3, Number(state.cardCount || 3) - 2));
  const focusParts = focus
    .split(/[\n.!?]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const fallback = [
    `${topic}의 핵심 내용과 알아두어야 할 정보를 정리합니다.`,
    `${product?.name || "선택한 상품"}과 주제가 연결되는 지점을 구체적으로 살펴봅니다.`,
    `${topic}을 실제 콘텐츠에 활용할 때 놓치기 쉬운 부분을 짚습니다.`,
  ];

  return {
    intro: `${topic}에 관심을 가져야 하는 이유와 글에서 다룰 내용을 소개합니다.`,
    bodies: Array.from({ length: bodyCount }, (_, index) =>
      focusParts[index]
        ? `${focusParts[index]}을 중심으로 설명합니다.`
        : fallback[index],
    ),
    conclusion: `${topic}의 핵심을 다시 짚고 자연스러운 다음 행동으로 마무리합니다.`,
  };
}

export function PostOutlineModal({ open, product, state, onClose, onConfirm }) {
  const [outline, setOutline] = useState(() => makeOutline(state, product));
  const [dragIndex, setDragIndex] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const dragIndexRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setOutline(makeOutline(state, product));
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [open, product, state, onClose]);

  useEffect(() => {
    if (dragIndex === null) return;
    const move = (event) => {
      event.preventDefault();
      setDragPreview((current) =>
        current ? { ...current, y: event.clientY - current.offsetY } : current,
      );
      const row = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest?.("[data-outline-body-index]");
      if (!row) return;
      const to = Number(row.dataset.outlineBodyIndex);
      const from = dragIndexRef.current;
      if (!Number.isInteger(to) || from === null || from === to) return;
      setOutline((current) => {
        if (to < 0 || to >= current.bodies.length) return current;
        const bodies = [...current.bodies];
        const [moved] = bodies.splice(from, 1);
        bodies.splice(to, 0, moved);
        return { ...current, bodies };
      });
      dragIndexRef.current = to;
      setDragIndex(to);
    };
    const end = () => {
      dragIndexRef.current = null;
      setDragIndex(null);
      setDragPreview(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragIndex]);

  if (!open) return null;
  const tone = TONES.find((item) => item.id === state.tone);

  const startBodyDrag = (index, event, row) => {
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    dragIndexRef.current = index;
    setDragIndex(index);
    setDragPreview({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      offsetY: event.clientY - rect.top,
      value: outline.bodies[index],
    });
  };

  return (
    <div
      className="outline-modal-scroll fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 px-4 py-8"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="outline-title"
        className="w-full max-w-[570px] rounded-[15px] border border-[#e5e8eb] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.25)] outline-none"
      >
        <header className="flex items-center justify-between border-b border-[#e5e8eb] px-[26px] py-[22px]">
          <h2 id="outline-title" className="text-[18px] font-bold text-black">
            뼈대잡기
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid size-9 place-items-center rounded-full text-[#8b95a1] hover:bg-[#f2f4f6] hover:text-[#333d4b]"
          >
            ×
          </button>
        </header>

        <CustomScrollArea className="max-h-[calc(100dvh-150px)] px-[26px] py-6 pr-[27px]">
          <dl className="space-y-5 text-[15px]">
            <div>
              <dt className="font-bold text-black">상품</dt>
              <dd className="mt-2 pl-2 text-[18px] font-bold text-[#287aff]">
                {product?.name}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-black">주제</dt>
              <dd className="mt-2 pl-2 leading-relaxed text-[#8e8e8e]">
                {state.topic}
              </dd>
            </div>
            {state.focusPoint?.trim() && (
              <div>
                <dt className="font-bold text-black">강조할 내용</dt>
                <dd className="mt-2 whitespace-pre-wrap pl-2 leading-relaxed text-[#8e8e8e]">
                  {state.focusPoint}
                </dd>
              </div>
            )}
            <div>
              <dt className="font-bold text-black">글 스타일</dt>
              <dd className="mt-2 pl-2 text-[#8e8e8e]">
                {tone ? `${tone.label} — ${tone.desc}` : "-"}
              </dd>
            </div>
          </dl>

          <div className="mt-7">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-black">글 구조 요약</h3>
              <span className="text-[15px] font-bold text-[#287aff]">
                {outline.bodies.length + 2}장
              </span>
            </div>
            <p className="mt-1 text-xs text-[#8b95a1]">
              내용을 수정하거나 본론을 끌어서 순서를 바꿀 수 있어요.
            </p>
            <div className="mt-4 space-y-[10px]">
              <OutlineRow
                label="서론"
                value={outline.intro}
                onChange={(intro) =>
                  setOutline((current) => ({ ...current, intro }))
                }
              />
              {outline.bodies.map((body, index) => (
                <OutlineRow
                  key={`${index}-${outline.bodies.length}`}
                  index={index}
                  label={`본론 ${index + 1}`}
                  value={body}
                  draggable
                  dragging={dragIndex === index}
                  onPointerDown={(event, row) =>
                    startBodyDrag(index, event, row)
                  }
                  onChange={(value) =>
                    setOutline((current) => ({
                      ...current,
                      bodies: current.bodies.map((item, itemIndex) =>
                        itemIndex === index ? value : item,
                      ),
                    }))
                  }
                />
              ))}
              <OutlineRow
                label="결론"
                value={outline.conclusion}
                onChange={(conclusion) =>
                  setOutline((current) => ({ ...current, conclusion }))
                }
              />
            </div>
          </div>

          <div className="mt-7">
            <h3 className="text-[15px] font-bold text-black">내보낼 채널</h3>
            <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
              {CHANNELS.map((channel) => {
                const selected = state.channels.includes(channel.id);
                return (
                  <li
                    key={channel.id}
                    className={`flex items-center gap-2.5 font-bold ${selected ? "text-black" : "text-[#c4c9cf]"}`}
                  >
                    <Icon
                      name={channel.icon}
                      className={`size-[26px] stroke-[1.7] ${selected ? "text-[#287aff]" : "text-[#c4c9cf]"}`}
                    />
                    <span>{channel.name}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-9 flex justify-center">
            <button
              type="button"
              onClick={() => onConfirm(outline)}
              className="h-[54px] min-w-[116px] rounded-full bg-[#287aff] px-8 text-[18px] font-bold text-white shadow-[0_0_2px_rgba(0,30,78,0.07)] hover:bg-[#1b64da]"
            >
              확인
            </button>
          </div>
        </CustomScrollArea>
      </section>
      {dragPreview && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] grid grid-cols-[66px_18px_minmax(0,1fr)] items-center gap-2 rounded-[12px] bg-white opacity-95 shadow-[0_14px_36px_rgba(0,0,0,0.24)] ring-2 ring-[#287aff]"
          style={{
            left: dragPreview.x,
            top: dragPreview.y,
            width: dragPreview.width,
          }}
        >
          <span className="pl-2 text-[15px] font-bold text-black">본론</span>
          <span className="grid w-[14px] grid-cols-2 gap-[3px] justify-self-center p-0.5">
            {Array.from({ length: 6 }, (_, index) => (
              <i key={index} className="size-[3px] rounded-full bg-[#287aff]" />
            ))}
          </span>
          <div className={`${fieldClass} min-h-[50px]`}>
            {dragPreview.value}
          </div>
        </div>
      )}
    </div>
  );
}

function OutlineRow({
  index,
  label,
  value,
  onChange,
  draggable = false,
  dragging = false,
  onPointerDown,
}) {
  const rowRef = useRef(null);

  return (
    <div
      ref={rowRef}
      data-outline-body-index={draggable ? index : undefined}
      className={`grid grid-cols-[66px_18px_minmax(0,1fr)] items-center gap-2 rounded-[12px] transition ${dragging ? "bg-[#e8f2fe] opacity-40 ring-2 ring-[#287aff]/35" : ""}`}
    >
      <span className="whitespace-nowrap text-[15px] font-bold text-black">
        {label}
      </span>
      {draggable ? (
        <button
          type="button"
          onPointerDown={(event) => onPointerDown?.(event, rowRef.current)}
          title="끌어서 순서 변경"
          aria-label={`${label} 순서 변경`}
          className="grid w-[14px] touch-none cursor-grab grid-cols-2 gap-[3px] justify-self-center rounded p-0.5 active:cursor-grabbing"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <i key={index} className="size-[3px] rounded-full bg-[#c4c9cf]" />
          ))}
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
      <div className="relative">
        <AutoHeightTextarea
          value={value}
          onChange={onChange}
          className={fieldClass}
        />
      </div>
    </div>
  );
}

function CustomScrollArea({ children, className = "" }) {
  const scrollRef = useRef(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => {
      const { clientHeight, scrollHeight, scrollTop } = element;
      const visible = scrollHeight > clientHeight + 1;
      const trackHeight = Math.max(0, clientHeight - 24);
      const height = visible
        ? Math.max(48, (clientHeight / scrollHeight) * trackHeight)
        : 0;
      const maxTop = Math.max(0, trackHeight - height);
      const top =
        visible && scrollHeight > clientHeight
          ? (scrollTop / (scrollHeight - clientHeight)) * maxTop
          : 0;
      setThumb({ top, height, visible });
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [children]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className={`outline-modal-scroll overflow-y-auto ${className}`}
      >
        <div>{children}</div>
      </div>
      {thumb.visible && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 right-2 top-3 w-[5px] rounded-full bg-[#f1f1f1]"
        >
          <span
            className="absolute left-0 w-[5px] rounded-full bg-[#050505]"
            style={{
              height: `${thumb.height}px`,
              transform: `translateY(${thumb.top}px)`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function AutoHeightTextarea({ value, onChange, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(50, textarea.scrollHeight)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
}
