"use client";

/**
 * 글 구조 요약 — 옛 `PostOutlineModal.jsx`(뼈대잡기 모달)를 같은 화면 안의 접이식
 * 패널로 옮겼다 (2026-09-08, 요청자 지시: "단계를 한 화면에서 끝내고 싶다").
 *
 * 모달이 보여주던 상품·주제·강조할 내용·글 스타일·내보낼 채널은 전부 바로 위
 * 「글 생성 조건 요약」 바(`GenerationSummary`)와 펼쳐진 조건 패널(`TopicSection`)에
 * 이미 있는 내용이라 여기서는 뺐다 — 같은 값을 두 번 보여주지 않는다. 이 패널은
 * **글 구조**(제목·서론·본론·결론)만 다룬다.
 *
 * ⚠️ 더 이상 "확인" 버튼으로 한 번에 커밋하지 않는다. `state.contentOutline` 을
 *    직접 읽고 쓰는 완전한 제어 컴포넌트다 — 필드를 고칠 때마다 바로 store 에 반영되고,
 *    패널을 접었다 펼쳐도 값이 그대로 남는다(모달처럼 열 때마다 다시 계산하지 않는다).
 * ⚠️ `state.contentOutline` 이 비어 있으면(새 주제를 막 확정한 직후) 이 컴포넌트가
 *    스스로 기본값을 만들어 채운다(`makeOutline`) — 페이지 쪽에서 미리 채워 줄 필요 없다.
 * ⚠️ 제목 추천(AI) 로직은 비동기라 store 를 직접 다시 읽어(`getState()`) 병합한다.
 *    prop 으로 받은 `state` 를 그대로 스프레드하면, 응답이 오는 사이 사용자가 다른
 *    필드를 고쳤을 때 그 수정을 덮어써 버린다.
 */
import { useEffect, useRef, useState } from "react";
import {
  cachedTitleSuggestions,
  fallbackTitles,
  getTitleSuggestions,
} from "../../../lib/titleSuggestions.js";
import { getState, setState } from "../../../store.js";
import { Icon } from "../Icon.jsx";

const fieldClass =
  "min-h-[50px] w-full resize-none overflow-hidden rounded-[12px] border border-[#e5e8eb] bg-white px-4 py-[14px] text-[15px] leading-[1.45] text-[#4e5968] shadow-[0_0_4px_rgba(0,30,78,0.07)] outline-none transition focus:border-[#287aff] focus:ring-2 focus:ring-[#287aff]/15";

function titleSuggestions(state, product) {
  return fallbackTitles(product, state?.topic);
}

/** 저장된 뼈대가 없을 때 쓸 기본값. 담당자가 나중에 하나씩 고쳐 쓰면 된다. */
export function makeOutline(state, product) {
  if (state?.contentOutline) {
    return {
      title: state.contentOutline.title || "",
      intro: state.contentOutline.intro || "",
      bodies: Array.isArray(state.contentOutline.bodies)
        ? [...state.contentOutline.bodies]
        : [],
      conclusion: state.contentOutline.conclusion || "",
      titleOptions: state.contentOutline.titleOptions || [],
    };
  }

  const focus = String(state.focusPoint || "").trim();
  const bodyCount = Math.max(1, Math.min(3, Number(state.cardCount || 3) - 2));
  const focusParts = focus
    .split(/[\n.!?]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const fallback = [
    "독자가 알아두어야 할 핵심 정보와 배경을 구체적으로 설명합니다.",
    `${product?.name || "선택한 상품"}과 주제가 연결되는 지점을 구체적으로 살펴봅니다.`,
    "실제 콘텐츠에 적용하는 방법과 놓치기 쉬운 부분을 짚습니다.",
  ];

  return {
    // 제목은 추천 목록이 준비되어도 자동으로 선택하지 않는다. 사용자가 제목을
    // 직접 골라야 AI 생성 버튼이 활성화된다.
    title: "",
    intro: "독자가 공감할 만한 상황을 제시하고 글에서 다룰 내용을 소개합니다.",
    bodies: Array.from({ length: bodyCount }, (_, index) =>
      focusParts[index]
        ? `${focusParts[index]}을 중심으로 설명합니다.`
        : fallback[index],
    ),
    conclusion:
      "앞서 다룬 핵심을 간결하게 정리하고 자연스러운 다음 행동을 제안합니다.",
    titleOptions: [],
  };
}

export function PostOutlineSection({ product, state, expanded, onToggle }) {
  const outline = state.contentOutline;
  const [suggestedTitles, setSuggestedTitles] = useState([]);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const dragIndexRef = useRef(null);

  function patchOutline(patch) {
    const current = getState().contentOutline || {};
    setState({ contentOutline: { ...current, ...patch } });
  }

  // 뼈대가 아직 없으면(막 조건을 확정한 직후) 기본값을 한 번 만들어 채운다.
  useEffect(() => {
    if (outline || !product) return;
    setState({ contentOutline: makeOutline(state, product) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- outline 이 생기면 이 효과는 다시 실행돼도 위 가드에서 멈춘다
  }, [outline, product?.id]);

  useEffect(() => {
    if (!product || !outline) return;
    const savedTitles = Array.isArray(outline.titleOptions)
      ? outline.titleOptions
          .map((title) => String(title || "").trim())
          .filter(Boolean)
      : [];
    const generatedTitles = savedTitles.length
      ? savedTitles
      : cachedTitleSuggestions(product, state);
    if (generatedTitles?.length) {
      setSuggestedTitles(generatedTitles);
      setTitlesLoading(false);
      setTitleError("");
      return;
    }
    const controller = new AbortController();
    const fallback = titleSuggestions(state, product);
    setSuggestedTitles([]);
    setTitlesLoading(true);
    setTitleError("");
    getTitleSuggestions(product, state, { signal: controller.signal })
      .then((titles) => {
        setSuggestedTitles(titles);
        const latest = getState().contentOutline || {};
        setState({
          contentOutline: {
            ...latest,
            title: latest.title || "",
            titleOptions: titles,
          },
        });
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        console.warn(
          "[titles] AI title generation failed; using fallback titles.",
          error,
        );
        setSuggestedTitles(fallback);
        setTitleError("AI 제목을 불러오지 못해 임시 제목을 표시했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setTitlesLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- outline 안의 다른 필드는 이 효과와 무관하다
  }, [
    product?.id,
    state.topic,
    state.focusPoint,
    outline?.title,
    outline?.titleOptions,
  ]);

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
      const current = getState().contentOutline;
      if (!current || to < 0 || to >= current.bodies.length) return;
      const bodies = [...current.bodies];
      const [moved] = bodies.splice(from, 1);
      bodies.splice(to, 0, moved);
      patchOutline({ bodies });
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
    <section
      aria-label="글 구조 요약"
      className={`overflow-hidden rounded-[15px] border ${expanded ? "bg-white border-[#e5e8eb]" : "bg-[#d6d6d6] border-[#d6d6d6]"}`}
    >
      <div className="flex items-center justify-between gap-4 px-8 py-[17px] max-sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="shrink-0 text-[15px] font-bold text-black">
            글 구조 요약
          </h3>
          {outline?.title && (
            <span
              className="min-w-0 truncate text-[14px] text-[#8e8e8e]"
              title={outline.title}
            >
              {outline.title}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="inline-flex h-[38px] shrink-0 items-center gap-[5px] text-[14px] font-medium text-[#4e5968] cursor-pointer"
        >
          <Icon
            name="chevronDown"
            className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded ? "접기" : "펼치기"}
        </button>
      </div>

      {expanded && outline && (
        <div className="border-t border-[#e5e8eb] px-8 pb-8 pt-6 max-sm:px-5">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-[#287aff]">
              {outline.bodies.length + 2}장
            </span>
            <p className="text-xs text-[#8b95a1]">
              내용을 수정하거나 본론을 끌어서 순서를 바꿀 수 있어요.
            </p>
          </div>
          <div className="mt-4 space-y-[10px]">
            <div className="grid grid-cols-[66px_18px_minmax(0,1fr)] items-start gap-2">
              <span className="pt-3.5 text-[15px] font-bold text-black">
                제목
              </span>
              <span aria-hidden="true" />
              <div>
                {titlesLoading && (
                  <div
                    className="flex min-h-10 items-center gap-2 text-[13px] font-semibold text-[#8b95a1]"
                    role="status"
                  >
                    <span className="size-4 animate-spin rounded-full border-2 border-[#d9e7ff] border-t-[#287aff]" />
                    상품과 주제를 확인해 제목을 만들고 있어요.
                  </div>
                )}
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="추천 제목 선택"
                >
                  {suggestedTitles.map((title) => {
                    const selected = outline.title === title;
                    return (
                      <button
                        key={title}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => patchOutline({ title })}
                        className={`rounded-full border px-3.5 py-2 text-left text-[13px] font-semibold leading-snug transition ${
                          selected
                            ? "border-[#287aff] bg-[#e8f2fe] text-[#287aff]"
                            : "border-[#e5e8eb] bg-white text-[#4e5968] hover:border-[#287aff]/50 hover:bg-[#f7f9fc]"
                        }`}
                      >
                        {title}
                      </button>
                    );
                  })}
                </div>
                {titleError && (
                  <p className="mt-2 text-xs leading-relaxed text-[#e5484d]">
                    {titleError}
                  </p>
                )}
                <p className="mt-2 text-xs leading-relaxed text-[#8b95a1]">
                  선택한 제목과 주제를 바탕으로 카드뉴스 표지 문구를 만듭니다.
                </p>
              </div>
            </div>
            <OutlineRow
              label="서론"
              value={outline.intro}
              onChange={(intro) => patchOutline({ intro })}
            />
            {outline.bodies.map((body, index) => (
              <OutlineRow
                key={`${index}-${outline.bodies.length}`}
                index={index}
                label={`본론 ${index + 1}`}
                value={body}
                draggable
                dragging={dragIndex === index}
                onPointerDown={(event, row) => startBodyDrag(index, event, row)}
                onChange={(value) =>
                  patchOutline({
                    bodies: outline.bodies.map((item, itemIndex) =>
                      itemIndex === index ? value : item,
                    ),
                  })
                }
              />
            ))}
            <OutlineRow
              label="결론"
              value={outline.conclusion}
              onChange={(conclusion) => patchOutline({ conclusion })}
            />
          </div>
        </div>
      )}

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
    </section>
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
