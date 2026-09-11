"use client";

/**
 * 블로그 미리보기의 카드뉴스 이미지 자리를 눌렀을 때 뜨는 카드 한 장 편집 모달
 * (2026-09-08, 요청자 지시). `app/template/page.jsx` 의 편집 기능 중 이 카드 한 장에
 * 필요한 것만 들고 온다 — 캔버스 미리보기(드래그·리사이즈) · 색상 · 배경 이미지.
 *
 * ⚠️ **「디테일 수정」 폼(`CardForm.jsx`)은 여기 없다.** 요청자 지시대로 문구는
 *    미리보기 위 글자 상자를 **더블클릭해서 직접 고친다** (`CanvasPreview.jsx` 의
 *    `onEditText`). 미리보기 위에서 못 고치는 것만(색상·배경 이미지 파일) 오른쪽
 *    별도 섹션에 남긴다 — `StylePanel`·`ImagePanel` 을 그대로 재사용한다.
 * ⚠️ 여기서 고친 값은 전부 `state.card` 로 들어가 전역 스토어에 그대로 저장된다.
 *    되돌리기·PNG 저장·Instagram 게시·텍스트 상자 추가 같은 나머지 기능은
 *    `/template` 전체 편집 화면에만 있다 — 아래 "전체 편집" 링크로 넘어간다.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getConcept,
  getCardTheme,
  getNoteInk,
  DEFAULT_MAGAZINE_TEMPLATE,
  MAGAZINE_TEMPLATES,
} from "../../../lib/concepts.js";
import { objectsFor, roleOf, slotIdForObject } from "../../../lib/templates.js";
import { buildPrompt } from "../../../lib/imageprompt.js";
import { buildAdPrompts } from "../../../lib/adprompt.js";
import {
  getImage,
  putImage,
  deleteImage,
  imageKey,
} from "../../../lib/imagestore.js";
import {
  loadImage,
  ensureFonts,
  lastBoxes,
  lastSizes,
  W,
  H,
} from "../../../lib/cardrender.js";
import {
  reconcileCard,
  cloneTexts,
  imageCaptionFor,
} from "../../template/_lib/deckBuilder.js";
import { getState, setState, subscribe } from "../../../store.js";
import { toast } from "../../../components/toast.js";
import { Icon } from "../Icon.jsx";
import { CanvasPreview } from "../../template/_components/CanvasPreview.jsx";
import { StylePanel } from "../../template/_components/StylePanel.jsx";
import { LayoutPanel } from "../../template/_components/LayoutPanel.jsx";
import { ImagePanel } from "../../template/_components/ImagePanel.jsx";
import { AdPromptPanel } from "../../template/_components/AdPromptPanel.jsx";

export function CardEditModal({
  product,
  cardIndex,
  deck,
  previewCard,
  onClose,
}) {
  const router = useRouter();
  const [state, setViewState] = useState(getState());
  const [bitmap, setBitmap] = useState(null);
  const [selectedObj, setSelectedObj] = useState(null);
  const [textSelection, setTextSelection] = useState(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const historyRef = useRef({ undo: [], redo: [] });
  onCloseRef.current = onClose;

  const open =
    cardIndex != null && Boolean(deck?.[cardIndex]) && Boolean(product);

  useEffect(() => subscribe(setViewState), []);

  // state.card 를 이 카드뉴스 유형에 맞게 다시 세운다 — 모달을 처음 열 때 아직
  // 이 컨셉으로 손댄 적이 없으면 state.card 가 비어 있거나 다른 컨셉 것일 수 있다.
  useEffect(() => {
    if (!open) return;
    const current = getState();
    // 카드 썸네일은 `previewCard`의 문구·배치·추가 텍스트로 이미 그려졌다.
    // 같은 스냅샷을 먼저 설치해야 모달이 보이는 카드와 정확히 같은 상태에서 시작한다.
    if (
      previewCard?.key === current.card?.key &&
      previewCard?.concept === current.concept &&
      JSON.stringify(previewCard) !== JSON.stringify(current.card)
    ) {
      setState({ card: previewCard });
      return;
    }
    const next = reconcileCard(current, deck, product);
    if (next) setState({ card: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deck·product 참조만 본다
  }, [open, deck, product]);

  useEffect(() => {
    if (!open) {
      setBitmap(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      await ensureFonts();
      const blob = await getImage(
        imageKey(state.productId, state.concept, cardIndex, state.postId),
      );
      const img = blob ? await loadImage(blob).catch(() => null) : null;
      if (!cancelled) setBitmap(img);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 이미지가 바뀐 카드만 다시 읽는다
  }, [
    open,
    state.productId,
    state.concept,
    state.postId,
    cardIndex,
    state.images?.[cardIndex],
  ]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const scrollY = window.scrollY;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const onKeyDown = (event) =>
      event.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKeyDown);
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
      previous?.focus?.();
    };
  // onClose is often recreated by the preview parent on each store update.
  // Keeping it out of this lifecycle prevents an input edit from restoring
  // focus to the opener and then focusing the dialog again.
  }, [open]);

  useEffect(() => {
    setSelectedObj(null);
    setTextSelection(null);
  }, [cardIndex]);

  useEffect(() => {
    if (!open) return;
    historyRef.current = { undo: [], redo: [] };
    setHistoryRevision((revision) => revision + 1);
  }, [open, cardIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z")
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea") || target.isContentEditable)
      )
        return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, cardIndex]);

  if (!open) return null;

  const concept = getConcept(state.concept);
  if (concept?.promptOnly) {
    const item = buildAdPrompts({
      product,
      topic: state.topic,
      deck,
      conceptIds: state.adConcepts || [state.adConcept],
      copyOverrides: state.adCopyOverrides,
    })[cardIndex];
    if (!item) return null;
    const changeAdCopy = (patch) => {
      const current = getState();
      const all = current.adCopyOverrides || {};
      setState({
        adCopyOverrides: {
          ...all,
          [cardIndex]: { ...all[cardIndex], ...patch },
        },
      });
    };
    const resetAdCopy = () => {
      const current = getState();
      const all = { ...(current.adCopyOverrides || {}) };
      delete all[cardIndex];
      setState({ adCopyOverrides: all });
      toast("추천 문구로 되돌렸습니다.");
    };
    const regenerateAdPrompt = () =>
      toast("수정한 문구로 이미지 프롬프트를 다시 만들었습니다.");
    const copyPrompt = async (promptItem) => {
      try {
        await navigator.clipboard.writeText(promptItem.prompt);
        toast(`${cardIndex + 1}번 광고 프롬프트를 복사했습니다.`);
      } catch {
        toast("프롬프트를 복사하지 못했습니다.");
      }
    };
    const uploadAdImage = async (file) => {
      if (!file.type.startsWith("image/"))
        return toast("이미지 파일만 올릴 수 있습니다.");
      const current = getState();
      await putImage(
        imageKey(current.productId, current.concept, cardIndex, current.postId),
        file,
      );
      setState({
        images: {
          ...current.images,
          [cardIndex]: {
            concept: current.concept,
            source: "upload",
            at: Date.now(),
          },
        },
      });
      toast(`${cardIndex + 1}번 광고 이미지를 올렸습니다.`);
    };
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/60 p-4"
        onMouseDown={(event) =>
          event.target === event.currentTarget && onClose()
        }
      >
        <section
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="card-edit-title"
          className="flex max-h-[calc(100dvh-32px)] w-full max-w-[900px] flex-col overflow-hidden rounded-[15px] border border-[#e5e8eb] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.25)] outline-none"
        >
          <header className="flex items-center justify-between border-b border-[#e5e8eb] px-6 py-4">
            <h2
              id="card-edit-title"
              className="text-[17px] font-bold text-black"
            >
              {cardIndex + 1}번 광고형 이미지 · {item.concept.name}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="grid size-9 place-items-center rounded-full text-[#8b95a1] transition hover:bg-[#f2f4f6] hover:text-[#333d4b]"
            >
              <Icon name="close" className="size-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <AdPromptPanel
              item={item}
              tools={[
                { name: "ChatGPT", url: "https://chatgpt.com/" },
                { name: "Gemini", url: "https://gemini.google.com/app" },
              ]}
              onCopy={copyPrompt}
              onUpload={uploadAdImage}
              editable
              onChange={changeAdCopy}
              onRegenerate={regenerateAdPrompt}
              onReset={resetAdCopy}
            />
          </div>
          <footer className="flex justify-end border-t border-[#e5e8eb] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-[42px] items-center justify-center rounded-full border border-[#287aff] bg-[#287aff] px-6 text-[14px] font-bold text-white"
            >
              닫기
            </button>
          </footer>
        </section>
      </div>
    );
  }
  const cardReady =
    state.card &&
    state.card.concept === state.concept &&
    (!previewCard ||
      JSON.stringify(state.card) === JSON.stringify(previewCard));

  if (!cardReady) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
        <p className="text-[15px] font-medium text-white/80">
          카드를 불러오는 중입니다…
        </p>
      </div>
    );
  }

  const card = deck[cardIndex];
  const texts = state.card.texts[cardIndex] || {};
  const extraTexts = state.card.extraTexts?.[cardIndex] || [];
  const magazineTemplate = state.magazineTemplate || DEFAULT_MAGAZINE_TEMPLATE;
  const layoutKey = (objId, source = state) =>
    source.concept === "magazine"
      ? `${objId}:${source.magazineTemplate || DEFAULT_MAGAZINE_TEMPLATE}`
      : objId;
  const rawLayout = state.card.layout?.[cardIndex] || {};
  // The renderer consumes plain object ids. Only expose overrides belonging to
  // the selected magazine style, keeping each style's positioning independent.
  const activeLayout =
    state.concept === "magazine"
      ? Object.fromEntries(
          Object.keys(rawLayout)
            .filter((key) => key.endsWith(`:${magazineTemplate}`))
            .map((key) => [key.slice(0, -(magazineTemplate.length + 1)), rawLayout[key]]),
        )
      : rawLayout;

  function snapshot(source = getState()) {
    return structuredClone({
      card: source.card,
      accent: source.accent,
      mark: source.mark,
      cardTheme: source.cardTheme,
      noteSymbol: source.noteSymbol,
      notePaper: source.notePaper,
      noteInk: source.noteInk,
      noteGrain: source.noteGrain,
      magazineTemplate: source.magazineTemplate,
    });
  }

  function commit(patch) {
    historyRef.current.undo.push(snapshot());
    historyRef.current.redo = [];
    setHistoryRevision((revision) => revision + 1);
    setState(patch);
  }

  function undo() {
    const entry = historyRef.current.undo.pop();
    if (!entry) return;
    historyRef.current.redo.push(snapshot());
    setState(entry);
    setSelectedObj(null);
    setTextSelection(null);
    setHistoryRevision((revision) => revision + 1);
  }

  function redo() {
    const entry = historyRef.current.redo.pop();
    if (!entry) return;
    historyRef.current.undo.push(snapshot());
    setState(entry);
    setSelectedObj(null);
    setTextSelection(null);
    setHistoryRevision((revision) => revision + 1);
  }
  const objects = [
    ...objectsFor(state.concept, card.kind, state.magazineTemplate),
    ...extraTexts.map((item, n) => ({
      id: `extra-${item.id}`,
      type: "text",
      label: `추가 텍스트 ${n + 1}`,
    })),
  ];
  const canUseImage = roleOf(state.concept, card.kind) !== "outro";
  const imageLabel = state.concept === "note" ? "카드 이미지" : "배경 이미지";

  function handleFieldChange(slotId, value) {
    const s = getState();
    const nextTexts = cloneTexts(s.card.texts);
    nextTexts[cardIndex] = { ...nextTexts[cardIndex], [slotId]: value };
    commit({ card: { ...s.card, texts: nextTexts } });
  }

  function handleEditText(objId, value) {
    const current = getState();
    const oldText = objId.startsWith("extra-")
      ? current.card.extraTexts?.[cardIndex]?.find(
          (item) => String(item.id) === objId.slice(6),
        )?.text || ""
      : current.card.texts[cardIndex]?.[
          slotIdForObject(state.concept, card.kind, objId)
        ] || "";
    const saved = current.card.layout?.[cardIndex]?.[layoutKey(objId, current)];
    if (oldText !== value && saved?.colorRanges?.length) {
      let start = 0;
      while (
        start < oldText.length &&
        start < value.length &&
        oldText[start] === value[start]
      )
        start++;
      let oldEnd = oldText.length,
        newEnd = value.length;
      while (
        oldEnd > start &&
        newEnd > start &&
        oldText[oldEnd - 1] === value[newEnd - 1]
      ) {
        oldEnd--;
        newEnd--;
      }
      const delta = newEnd - oldEnd;
      const colorRanges = saved.colorRanges.flatMap((range) => {
        const parts = [];
        if (range.start < start)
          parts.push({ ...range, end: Math.min(range.end, start) });
        if (range.end > oldEnd)
          parts.push({
            ...range,
            start: Math.max(range.start, oldEnd) + delta,
            end: range.end + delta,
          });
        return parts;
      });
      handleCommitLayout(objId, { colorRanges });
    }
    if (objId.startsWith("extra-")) {
      const id = objId.slice("extra-".length);
      const s = getState();
      const nextExtraTexts = (s.card.extraTexts || deck.map(() => [])).map(
        (items) =>
          Array.isArray(items) ? items.map((item) => ({ ...item })) : [],
      );
      nextExtraTexts[cardIndex] = (nextExtraTexts[cardIndex] || []).map(
        (item) => (item.id === id ? { ...item, text: value } : item),
      );
      commit({ card: { ...s.card, extraTexts: nextExtraTexts } });
      return;
    }
    handleFieldChange(slotIdForObject(state.concept, card.kind, objId), value);
  }

  function handleCommitLayout(objId, box) {
    const s = getState();
    const layout = deck.map((_, i) => ({ ...(s.card.layout?.[i] || {}) }));
    const obj = objects.find((o) => o.id === objId);
    const key = layoutKey(objId, s);
    const previous = layout[cardIndex][key] || {};
    const drawn = lastBoxes()[objId];
    const nextBox = {
      ...(drawn
        ? { x: drawn.x / W, y: drawn.y / H, w: drawn.w / W, h: drawn.h / H }
        : {}),
      ...previous,
      ...box,
    };
    if (obj?.type === "text" && !nextBox.fontSize) {
      const measured =
        lastSizes()[slotIdForObject(state.concept, card.kind, objId)];
      nextBox.fontSize = measured?.size || 40;
      nextBox.fontWeight =
        Number(nextBox.fontWeight) || measured?.weight || 400;
    }
    layout[cardIndex] = { ...layout[cardIndex], [key]: nextBox };
    commit({ card: { ...s.card, layout } });
  }

  function handleStyleChange(patch) {
    commit(patch);
  }

  function handleAddTextBox() {
    const s = getState();
    const extraTexts = deck.map((_, i) => [...(s.card.extraTexts?.[i] || [])]);
    const id = crypto.randomUUID();
    extraTexts[cardIndex].push({
      id,
      text: "텍스트를 입력하세요",
      x: 0.1,
      y: 0.42,
      w: 0.8,
      h: 0.14,
      fontSize: 40,
      fontWeight: 400,
      textAlign: "left",
      color: state.concept === "note" ? "#191F28" : "#FFFFFF",
    });
    commit({ card: { ...s.card, extraTexts } });
    setSelectedObj(`extra-${id}`);
    setTextSelection(null);
  }

  function handleDeleteTextBox() {
    if (!selectedObj) return;
    const s = getState();

    // Built-in text objects belong to the template, so removing their text is
    // the safe per-card equivalent of deleting the box. Custom boxes can be
    // removed from the card data entirely.
    if (!selectedObj.startsWith("extra-")) {
      handleEditText(selectedObj, "");
      setSelectedObj(null);
      setTextSelection(null);
      toast("텍스트 상자를 삭제했습니다.");
      return;
    }

    const id = selectedObj.slice("extra-".length);
    const extraTexts = deck.map((_, index) =>
      (s.card.extraTexts?.[index] || []).filter(
        (item) => String(item.id) !== id,
      ),
    );
    const layout = deck.map((_, index) => ({
      ...(s.card.layout?.[index] || {}),
    }));
    delete layout[cardIndex][layoutKey(selectedObj, s)];
    commit({ card: { ...s.card, extraTexts, layout } });
    setSelectedObj(null);
    setTextSelection(null);
    toast("텍스트 상자를 삭제했습니다.");
  }

  function applyTextColor() {
    if (
      !textSelection ||
      textSelection.objId !== selectedObj ||
      textSelection.start === textSelection.end
    )
      return;
    document.activeElement?.blur();
    handleEditText(selectedObj, textSelection.text);
    const saved =
      getState().card.layout?.[cardIndex]?.[layoutKey(selectedObj)] || {};
    const color =
      state.concept === "card"
        ? getCardTheme(state.cardTheme).hex
        : state.concept === "note"
          ? getNoteInk(state.noteInk).hex
          : state.accent || "#B9F73E";
    handleCommitLayout(selectedObj, {
      colorRanges: [
        ...(saved.colorRanges || []),
        {
          start: textSelection.start,
          end: textSelection.end,
          color,
        },
      ],
    });
  }

  async function applyImage(blob, source) {
    const s = getState();
    if (blob) {
      await putImage(
        imageKey(s.productId, s.concept, cardIndex, s.postId),
        blob,
      );
      const previous = getState().images[cardIndex] || {};
      setState({
        images: {
          ...getState().images,
          [cardIndex]: {
            ...previous,
            concept: s.concept,
            source,
            at: Date.now(),
          },
        },
      });
      setBitmap(await loadImage(blob).catch(() => null));
    } else {
      await deleteImage(imageKey(s.productId, s.concept, cardIndex, s.postId));
      const images = { ...s.images };
      delete images[cardIndex];
      setState({ images });
      setBitmap(null);
    }
  }

  async function handleUpload(file) {
    if (!file.type.startsWith("image/")) {
      toast("이미지 파일만 올릴 수 있습니다.");
      return;
    }
    await applyImage(file, "upload");
    toast("이미지를 올렸습니다.");
  }

  async function handleDeleteImage() {
    await applyImage(null);
    toast("이미지를 지웠습니다.");
  }

  async function handleCopyPrompt() {
    const text = buildPrompt(card, state.concept, {
      index: cardIndex,
      title: texts.title || card.title,
      subject: imageCaptionFor(state, cardIndex),
    });
    try {
      await navigator.clipboard.writeText(text);
      toast(`${cardIndex + 1}번 프롬프트를 복사했습니다.`);
    } catch {
      toast("복사하지 못했습니다. 내용을 직접 선택해 주세요.");
    }
  }

  const previewOpts = {
    conceptId: state.concept,
    kind: card.kind,
    image: bitmap,
    accent: state.accent,
    cardTheme: state.cardTheme,
    mark: state.mark,
    noteSymbol: state.noteSymbol,
    notePaper: state.notePaper,
    noteInk: state.noteInk,
    noteGrain: state.noteGrain,
    magazineTemplate: state.magazineTemplate,
    layout: activeLayout,
    extraTexts,
  };
  const imageStatus = state.images?.[cardIndex];
  const hasCurrentConceptImage = imageStatus?.concept === state.concept;
  const isMagazineCover = state.concept === "magazine" && cardIndex === 0;

  function handleMagazineTemplateChange(id) {
    setState({ magazineTemplate: id });
    setSelectedObj(null);
    setTextSelection(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/60 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-edit-title"
        className="flex max-h-[calc(100dvh-32px)] w-full max-w-[900px] flex-col overflow-hidden rounded-[15px] border border-[#e5e8eb] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.25)] outline-none"
      >
        <header className="flex items-center justify-between border-b border-[#e5e8eb] px-6 py-4">
          <h2 id="card-edit-title" className="text-[17px] font-bold text-black">
            {cardIndex + 1}번 카드 편집 · {concept?.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid size-9 place-items-center rounded-full text-[#8b95a1] transition hover:bg-[#f2f4f6] hover:text-[#333d4b]"
          >
            <Icon name="close" className="size-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px] gap-7 overflow-y-auto p-6 max-[720px]:grid-cols-1">
          <div>
            <CanvasPreview
              texts={texts}
              opts={previewOpts}
              cardIndex={cardIndex}
              objects={objects}
              selectedObj={selectedObj}
              onSelectObj={setSelectedObj}
              onCommitLayout={handleCommitLayout}
              onEditText={handleEditText}
              onTextSelection={setTextSelection}
            />
            <p className="mt-3 text-[13px] leading-[1.5] text-[#8b95a1]">
              글자 상자를 더블클릭하면 그 자리에서 바로 고칠 수 있어요.
              위치·크기는 드래그하거나 선택 후 방향키로 옮기세요.
            </p>
          </div>

          <div className="space-y-6">
            {isMagazineCover && (
              <section aria-labelledby="magazine-style-heading">
                <h3
                  id="magazine-style-heading"
                  className="mb-3 text-[15px] font-bold text-[#333d4b]"
                >
                  표지 스타일
                </h3>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="매거진형 표지 스타일 선택">
                  {MAGAZINE_TEMPLATES.map((template, index) => {
                    const selected =
                      template.id ===
                      (state.magazineTemplate || DEFAULT_MAGAZINE_TEMPLATE);
                    return (
                      <button
                        key={template.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => handleMagazineTemplateChange(template.id)}
                        className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                          selected
                            ? "border-[#287aff] bg-[#287aff] text-white"
                            : "border-[#e5e8eb] bg-white text-[#5f6b7a] hover:bg-[#f7f8fa]"
                        }`}
                      >
                        스타일 {index + 1}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            <StylePanel
              concept={concept}
              values={{
                accent: state.accent,
                mark: state.mark,
                cardTheme: state.cardTheme,
                noteSymbol: state.noteSymbol,
                notePaper: state.notePaper,
                noteInk: state.noteInk,
                noteGrain: state.noteGrain,
              }}
              onChange={handleStyleChange}
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddTextBox}
                  className="min-w-0 flex-1 rounded-lg border border-[#287aff] px-3 py-2 text-sm font-bold text-[#287aff]"
                >
                  + 텍스트 상자 추가
                </button>
                {objects.find((object) => object.id === selectedObj)?.type ===
                  "text" && (
                  <button
                    type="button"
                    onClick={handleDeleteTextBox}
                    className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#fecaca] text-[#dc2626] transition hover:bg-[#fff1f2]"
                    aria-label="선택한 텍스트 상자 삭제"
                    title="선택한 텍스트 상자 삭제"
                  >
                    <Icon name="trash" className="size-4" />
                  </button>
                )}
              </div>
              {objects.find((o) => o.id === selectedObj)?.type === "text" && (
                <>
                  <LayoutPanel
                    key={selectedObj}
                    objId={selectedObj}
                    measured={
                      lastSizes()[
                        slotIdForObject(state.concept, card.kind, selectedObj)
                      ]
                    }
                    label={objects.find((o) => o.id === selectedObj)?.label}
                    saved={
                      state.card.layout?.[cardIndex]?.[layoutKey(selectedObj)] ||
                      {}
                    }
                    onChange={(patch) => handleCommitLayout(selectedObj, patch)}
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={applyTextColor}
                    disabled={
                      !textSelection ||
                      textSelection.objId !== selectedObj ||
                      textSelection.start === textSelection.end
                    }
                    className="w-full rounded-lg bg-[#287aff] px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    선택한 글자에 색상 적용
                  </button>
                  <p className="text-xs text-[#5f6b7a]">
                    상자를 더블클릭하고 글자를 드래그한 뒤, 아래에서 색상을 골라
                    적용하세요.
                  </p>
                </>
              )}
            </StylePanel>

            <ImagePanel
              label={imageLabel}
              disabled={!canUseImage}
              hasImage={hasCurrentConceptImage}
              source={hasCurrentConceptImage ? imageStatus.source : null}
              prompt={buildPrompt(card, state.concept, {
                index: cardIndex,
                title: texts.title || card.title,
                subject: imageCaptionFor(state, cardIndex),
              })}
              cardIndex={cardIndex}
              recommendChatGPT={state.concept === "note"}
              onUpload={handleUpload}
              onDelete={handleDeleteImage}
              onCopy={handleCopyPrompt}
            />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[#e5e8eb] px-6 py-4">
          {/* <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/template");
            }}
            className="text-[13px] font-bold text-[#5f6b7a] underline decoration-[#c4c9cf] underline-offset-4 transition hover:text-[#287aff]"
          >
            카드뉴스 제작 단계에서 전체 편집하기
          </button> */}
          <div className="mr-auto flex items-center gap-2" aria-label="편집 실행 취소 및 다시 실행">
            <button
              type="button"
              onClick={undo}
              disabled={!historyRef.current.undo.length}
              title="실행 취소 (Ctrl+Z)"
              className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-[13px] font-bold text-[#5f6b7a] transition hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↶ 실행 취소
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!historyRef.current.redo.length}
              title="다시 실행 (Ctrl+Shift+Z)"
              className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-[13px] font-bold text-[#5f6b7a] transition hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↷ 다시 실행
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[42px] items-center justify-center rounded-full border border-[#287aff] bg-[#287aff] px-6 text-[14px] font-bold text-white transition hover:border-[#1b64da] hover:bg-[#1b64da]"
          >
            닫기
          </button>
        </footer>
      </section>
    </div>
  );
}
