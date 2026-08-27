"use client";

/**
 * STEP 3 — 카드뉴스 템플릿 (1단계 마이그레이션)
 *
 * 옛 pages/template.js 의 캔버스 편집기를 Next.js 로 옮긴 것이다. 이번 단계에서 옮긴 것:
 * 템플릿 3종 선택, 카드 탭, 캔버스 미리보기, 슬롯별 문구 편집, 색상·마크·종이 선택,
 * 금지표현/글자잘림 경고, PNG 저장, 보관함 저장 + 자동저장, 오브젝트 자유 배치(드래그·리사이즈,
 * `CanvasPreview.jsx`) 와 되돌리기/다시실행 히스토리.
 * ⚠️ 직관형(D, `promptOnly`)은 이미지 프롬프트 생성 화면이 아직 없어 안내만 보여준다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getProduct, loadProducts } from "../../lib/products.js";
import { getConcept, CONCEPTS } from "../../lib/concepts.js";
import { slotsFor, roleOf, objectsFor } from "../../lib/templates.js";
import { buildDeck, TONE_LABEL } from "../../lib/copywriter.js";
import { outlineKeyOf } from "../../lib/outline.js";
import {
  getImage,
  putImage,
  deleteImage,
  imageKey,
} from "../../lib/imagestore.js";
import {
  renderCard,
  loadImage,
  downloadCanvas,
  ensureFonts,
  lastBoxes,
  lastSizes,
  W,
  H,
} from "../../lib/cardrender.js";
import { buildPrompt } from "../../lib/imageprompt.js";
import { saveToLibrary, hasLibraryChanges } from "../../lib/librarystore.js";
import { getState, setState, subscribe, STEPS } from "../../store.js";
import { toast } from "../../components/toast.js";
import { LoadingScreen } from "../_components/LoadingScreen.jsx";
import { Icon } from "../_components/Icon.jsx";
import { TextStepper } from "../_components/text/TextStepper.jsx";
import {
  reconcileCard,
  cloneTexts,
  imageCaptionFor,
  deckFromBlog,
  withFollowCard,
} from "./_lib/deckBuilder.js";
import { ConceptPicker } from "./_components/ConceptPicker.jsx";
import { CardTabs } from "./_components/CardTabs.jsx";
import { CanvasPreview } from "./_components/CanvasPreview.jsx";
import { LayoutPanel } from "./_components/LayoutPanel.jsx";
import { CardForm } from "./_components/CardForm.jsx";
import { StylePanel } from "./_components/StylePanel.jsx";
import { ImagePanel } from "./_components/ImagePanel.jsx";
import { SaveActions } from "./_components/SaveActions.jsx";

const IMAGE_ROLE = {
  note: "아이콘 이미지",
  magazine: "배경 이미지",
  card: "배경 이미지",
};

const usesImage = (conceptId, kind) =>
  !(conceptId === "card" && roleOf("card", kind) === "outro");

function isFieldEdited(card, index, conceptId, kind) {
  const ids = slotsFor(conceptId, kind).map((s) => s.id);
  return ids.some(
    (id) => (card.texts[index]?.[id] ?? "") !== (card.base[index]?.[id] ?? ""),
  );
}

const fileName = (s, i) =>
  `${s.productId}-${s.concept}-${String(i + 1).padStart(2, "0")}.png`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EDITOR_STATE_KEYS = [
  "concept",
  "accent",
  "mark",
  "cardTheme",
  "noteSymbol",
  "notePaper",
  "noteInk",
  "noteGrain",
  "card",
];

const editorSnapshot = (s) =>
  Object.fromEntries(
    EDITOR_STATE_KEYS.map((key) => [
      key,
      s[key] == null ? s[key] : structuredClone(s[key]),
    ]),
  );

export default function TemplatePage() {
  const router = useRouter();
  const [state, setViewState] = useState(null);
  const [productsReady, setProductsReady] = useState(false);
  const [active, setActive] = useState(0);
  const [bitmaps, setBitmaps] = useState([]);
  const [clippedSlots, setClippedSlots] = useState([]);
  const [savingAll, setSavingAll] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [canSaveLibrary, setCanSaveLibrary] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [selectedObj, setSelectedObj] = useState(null);
  const lastReconciled = useRef("");
  const history = useRef({
    past: [],
    current: null,
    future: [],
    initial: null,
  });
  const applyingHistory = useRef(false);
  const historyPostId = useRef(null);

  useEffect(() => {
    setViewState(getState());
    const unsubscribe = subscribe(setViewState);
    loadProducts().finally(() => setProductsReady(true));
    return unsubscribe;
  }, []);

  const product = state && productsReady ? getProduct(state.productId) : null;
  const concept = state ? getConcept(state.concept) : null;

  const hasDraft = state
    ? Object.values(state.drafts || {}).some((v) => String(v || "").trim())
    : false;

  // 상품·주제가 없거나 초안이 없으면 여기 있을 이유가 없다 (옛 guard()/render() 상단 체크)
  useEffect(() => {
    if (!state || !productsReady) return;
    if (!getProduct(state.productId) || !state.topic?.trim()) {
      router.replace("/");
      return;
    }
    if (!hasDraft) {
      toast("현재 주제로 AI 글을 먼저 생성해 주세요.");
      router.replace("/text");
    }
  }, [state, productsReady, hasDraft, router]);

  const deck = useMemo(() => {
    if (!state || !product) return [];
    const core =
      state.outline?.key === outlineKeyOf(state) ? state.outline.core : null;
    let d = buildDeck({
      product,
      topic: state.topic.trim(),
      tone: state.tone,
      variant: state.image?.variant ?? 0,
      cardCount: state.cardCount,
      core,
      allowRuleFallback: !core,
    });
    d = deckFromBlog(d, state);
    d = withFollowCard(d, state.concept, product);
    return d;
  }, [state, product]);

  useEffect(() => {
    if (deck.length && active >= deck.length) setActive(0);
  }, [deck.length, active]);

  // 카드를 옮기거나 템플릿을 바꾸면 이전 카드에서 고른 오브젝트는 뜻을 잃는다 (옛 syncOverlay 의 known 검사)
  useEffect(() => {
    setSelectedObj(null);
  }, [active, state?.concept]);

  // 자유 배치 손잡이 목록 — 기본 오브젝트(옛 objectsFor) + 이 카드에 추가한 텍스트 상자
  const objects = useMemo(() => {
    if (!state?.card || !deck.length || !deck[active]) return [];
    const builtIn = objectsFor(state.concept, deck[active].kind);
    const extras = (state.card.extraTexts?.[active] || []).map((item, n) => ({
      id: `extra-${item.id}`,
      type: "text",
      label: `추가 텍스트 ${n + 1}`,
    }));
    return [...builtIn, ...extras];
  }, [state, deck, active]);

  // 문구 상태(state.card)를 지금 템플릿·조건에 맞춰 다시 세운다 (옛 ensureTexts)
  useEffect(() => {
    if (!state || !product || !deck.length) return;
    const sig = `${product.id}|${state.concept}|${deck.length}`;
    if (lastReconciled.current === sig) return;
    lastReconciled.current = sig;
    const next = reconcileCard(getState(), deck, product);
    if (next) setState({ card: next });
  }, [state, product, deck]);

  // 카드별 배경/아이콘 이미지를 IndexedDB 에서 불러온다 (옛 loadBitmaps)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFonts();
      if (!state || !product || !deck.length) return;
      const next = new Array(deck.length).fill(null);
      for (let i = 0; i < deck.length; i++) {
        const blob = await getImage(
          imageKey(state.productId, state.concept, i, state.postId),
        );
        if (blob) next[i] = await loadImage(blob).catch(() => null);
      }
      if (!cancelled) setBitmaps(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [state?.productId, state?.concept, state?.postId, deck.length, product]);

  useEffect(() => {
    setCanSaveLibrary(hasLibraryChanges());
  }, [state]);

  useEffect(() => {
    if (!state?.card) return;

    const postKey = `${state.postId}|${state.productId}`;
    const next = editorSnapshot(state);
    const nextJson = JSON.stringify(next);

    if (historyPostId.current !== postKey) {
      historyPostId.current = postKey;
      history.current = { past: [], current: next, future: [], initial: next };
      setHistoryRevision((value) => value + 1);
      return;
    }

    const entry = history.current;
    if (JSON.stringify(entry.current) === nextJson) {
      applyingHistory.current = false;
      return;
    }

    if (applyingHistory.current) {
      applyingHistory.current = false;
      entry.current = next;
    } else {
      if (entry.current) entry.past.push(entry.current);
      entry.current = next;
      entry.future = [];
      if (entry.past.length > 100) entry.past.shift();
    }
    setHistoryRevision((value) => value + 1);
  }, [state]);

  function applyHistorySnapshot(snapshot) {
    applyingHistory.current = true;
    setState(editorSnapshot(snapshot));
  }

  function handleUndo() {
    const entry = history.current;
    const previous = entry.past.pop();
    if (!previous) return;
    entry.future.unshift(entry.current);
    entry.current = previous;
    applyHistorySnapshot(previous);
    setHistoryRevision((value) => value + 1);
  }

  function handleRedo() {
    const entry = history.current;
    const next = entry.future.shift();
    if (!next) return;
    entry.past.push(entry.current);
    entry.current = next;
    applyHistorySnapshot(next);
    setHistoryRevision((value) => value + 1);
  }

  function handleResetInitial() {
    const entry = history.current;
    if (
      !entry.initial ||
      JSON.stringify(entry.current) === JSON.stringify(entry.initial)
    )
      return;
    entry.past.push(entry.current);
    entry.current = entry.initial;
    entry.future = [];
    applyHistorySnapshot(entry.initial);
    setActive(0);
    setHistoryRevision((value) => value + 1);
  }

  const buildRenderOpts = useCallback(
    (s, i) => ({
      conceptId: s.concept,
      kind: deck[i]?.kind,
      image: bitmaps[i] || null,
      accent: s.accent,
      cardTheme: s.cardTheme,
      mark: s.mark,
      noteSymbol: s.noteSymbol,
      notePaper: s.notePaper,
      noteGrain: s.noteGrain,
      noteInk: s.noteInk,
      layout: s.card?.layout?.[i] || {},
      extraTexts: s.card?.extraTexts?.[i] || [],
    }),
    [deck, bitmaps],
  );

  const handleClipped = useCallback((slots) => setClippedSlots(slots), []);

  function handleConceptChange(id) {
    setState({ concept: id });
    setActive(0);
    setSelectedObj(null);
    toast(`${getConcept(id).name} 템플릿으로 바꿨습니다.`);
  }

  function handleFieldChange(slotId, value) {
    const s = getState();
    const texts = cloneTexts(s.card.texts);
    texts[active] = { ...texts[active], [slotId]: value };
    setState({ card: { ...s.card, texts } });
  }

  function handleResetOne() {
    const s = getState();
    const texts = cloneTexts(s.card.texts);
    texts[active] = { ...s.card.base[active] };
    setState({ card: { ...s.card, texts } });
    toast(`${active + 1}번 카드를 추천 문구로 되돌렸습니다.`);
  }

  function handleAddTextBox() {
    const s = getState();
    const extraTexts = (s.card.extraTexts || deck.map(() => [])).map((items) =>
      Array.isArray(items) ? items.map((item) => ({ ...item })) : [],
    );
    const items = extraTexts[active] || [];
    const newItem = {
      id: `${Date.now()}-${items.length}`,
      text: "텍스트를 입력하세요",
      x: 0.1,
      y: Math.min(0.72, 0.42 + items.length * 0.08),
      w: 0.8,
      h: 0.14,
      fontSize: 40,
      fontWeight: 400,
      textAlign: "left",
      color: state.concept === "note" ? "#191F28" : "#FFFFFF",
    };
    items.push(newItem);
    extraTexts[active] = items;
    setState({ card: { ...s.card, extraTexts } });
    // 방금 만든 상자를 바로 선택한다 — CardForm 이 selectedObj 를 보고
    // 해당 칸으로 화면을 스크롤하고 강조 표시한다.
    setSelectedObj(`extra-${newItem.id}`);
    toast(`${active + 1}번 카드에 텍스트 상자를 추가했습니다.`);
  }

  function handleExtraTextChange(id, patch) {
    const s = getState();
    const extraTexts = (s.card.extraTexts || deck.map(() => [])).map((items) =>
      Array.isArray(items) ? items.map((item) => ({ ...item })) : [],
    );
    extraTexts[active] = (extraTexts[active] || []).map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    setState({ card: { ...s.card, extraTexts } });
  }

  function handleDeleteExtraText(id) {
    const s = getState();
    const extraTexts = (s.card.extraTexts || deck.map(() => [])).map((items) =>
      Array.isArray(items) ? items.map((item) => ({ ...item })) : [],
    );
    extraTexts[active] = (extraTexts[active] || []).filter(
      (item) => item.id !== id,
    );
    const layout = (s.card.layout || deck.map(() => ({}))).map((items) => ({
      ...(items || {}),
    }));
    if (layout[active]) delete layout[active][`extra-${id}`];
    setState({ card: { ...s.card, extraTexts, layout } });
    if (selectedObj === `extra-${id}`) setSelectedObj(null);
  }

  function handleStyleChange(patch) {
    setState(patch);
  }

  /**
   * 오브젝트(문구·이미지) 배치를 확정 저장한다. 드래그가 끝났을 때도, 숫자 입력으로
   * 고쳤을 때도 여기 하나를 거친다. 옛 pages/template.js 의 `commitLayout()`.
   */
  function handleCommitLayout(objId, box) {
    const s = getState();
    const layout = deck.map((_, i) => ({ ...(s.card.layout?.[i] || {}) }));
    const obj = objects.find((o) => o.id === objId);
    const previous = layout[active][objId] || {};
    let nextBox = { ...previous, ...box };

    // 위치·크기가 하나도 없는 오버라이드를 만들면 안 된다 — 렌더러가 NaN 좌표로 튄다.
    const drawn = lastBoxes()[objId];
    if (drawn && nextBox.x === undefined) {
      nextBox = {
        x: drawn.x / W,
        y: drawn.y / H,
        w: drawn.w / W,
        h: drawn.h / H,
        ...nextBox,
      };
    }

    // 자동 배치 텍스트를 처음 옮기는 순간에도 현재 보이던 서체를 그대로 이어받는다.
    if (obj?.type === "text" && !nextBox.fontSize) {
      const defaultSizes = { brand: 36, eyebrow: 30, title: 82, footer: 30 };
      const defaultWeights = {
        brand: 900,
        eyebrow: 700,
        title: 900,
        footer: 500,
      };
      nextBox.fontSize =
        lastSizes()[objId]?.size ||
        defaultSizes[objId] ||
        (objId.startsWith("extra-") ? 40 : 30);
      nextBox.fontWeight =
        Number(nextBox.fontWeight) ||
        defaultWeights[objId] ||
        (objId.startsWith("extra-") ? 400 : 500);
    }

    layout[active] = { ...layout[active], [objId]: nextBox };
    setState({ card: { ...s.card, layout } });
  }

  async function applyImage(index, blob, source) {
    const s = getState();
    if (blob) {
      await putImage(imageKey(s.productId, s.concept, index, s.postId), blob);
      const previous = getState().images[index] || {};
      setState({
        images: {
          ...getState().images,
          [index]: { ...previous, source, at: Date.now() },
        },
      });
      const img = await loadImage(blob).catch(() => null);
      setBitmaps((prev) => {
        const next = prev.slice();
        next[index] = img;
        return next;
      });
    } else {
      await deleteImage(imageKey(s.productId, s.concept, index, s.postId));
      const images = { ...s.images };
      delete images[index];
      setState({ images });
      setBitmaps((prev) => {
        const next = prev.slice();
        next[index] = null;
        return next;
      });
    }
  }

  async function handleUpload(file) {
    if (!file.type.startsWith("image/")) {
      toast("이미지 파일만 올릴 수 있습니다.");
      return;
    }
    await applyImage(active, file, "upload");
    toast("이미지를 올렸습니다.");
  }

  async function handleDeleteImage() {
    await applyImage(active, null);
    toast("이미지를 지웠습니다.");
  }

  async function handleCopyPrompt() {
    const s = getState();
    const text = buildPrompt(deck[active], s.concept, {
      index: active,
      title: s.card?.texts?.[active]?.title || deck[active].title,
      subject: imageCaptionFor(s, active),
    });
    try {
      await navigator.clipboard.writeText(text);
      toast(`${active + 1}번 프롬프트를 복사했습니다.`);
    } catch {
      toast("복사하지 못했습니다. 내용을 직접 선택해 주세요.");
    }
  }

  async function handleSaveOne() {
    const s = getState();
    const off = document.createElement("canvas");
    renderCard(off, s.card.texts[active], buildRenderOpts(s, active));
    await downloadCanvas(off, fileName(s, active));
    toast(`${active + 1}번 카드를 저장했습니다.`);
  }

  async function handleSaveAll() {
    setSavingAll(true);
    try {
      const s = getState();
      const off = document.createElement("canvas");
      for (let i = 0; i < deck.length; i++) {
        renderCard(off, s.card.texts[i], buildRenderOpts(s, i));
        await downloadCanvas(off, fileName(s, i));
        if (i < deck.length - 1) await sleep(350);
      }
      toast(`${deck.length}장을 모두 저장했습니다.`);
    } finally {
      setSavingAll(false);
    }
  }

  async function makeThumb(s) {
    try {
      const full = document.createElement("canvas");
      renderCard(full, s.card.texts[0], buildRenderOpts(s, 0));
      const small = document.createElement("canvas");
      small.width = 216;
      small.height = 270;
      small.getContext("2d").drawImage(full, 0, 0, 216, 270);
      return await new Promise((resolve) =>
        small.toBlob(resolve, "image/jpeg", 0.72),
      );
    } catch {
      return null;
    }
  }

  const saveToArchive = useCallback(
    async ({ automatic = false } = {}) => {
      if (!hasLibraryChanges()) {
        setCanSaveLibrary(false);
        return;
      }
      setLibraryBusy(true);
      try {
        const s = getState();
        const thumb = await makeThumb(s);
        const result = await saveToLibrary(s, thumb);
        if (!result.ok) {
          toast(result.error, 6000);
          return;
        }
        toast(automatic ? "자동 저장했습니다." : "저장했습니다.");
      } finally {
        setLibraryBusy(false);
        setCanSaveLibrary(hasLibraryChanges());
      }
    },
    [buildRenderOpts],
  );

  const saveToArchiveRef = useRef(saveToArchive);
  saveToArchiveRef.current = saveToArchive;

  useEffect(() => {
    const id = setInterval(() => {
      if (hasLibraryChanges()) saveToArchiveRef.current({ automatic: true });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  if (
    !state ||
    !productsReady ||
    !product ||
    !concept ||
    !deck.length ||
    !state.card
  ) {
    return <LoadingScreen />;
  }

  if (concept.promptOnly) {
    return (
      <main className="min-h-dvh bg-[#1a1a1a] pb-[140px] pt-[54px] text-white">
        <div className="mx-auto max-w-[560px] px-5 text-center">
          <h1 className="text-[24px] font-bold">직관형은 곧 지원됩니다</h1>
          <p className="mt-3 text-white/60">
            직관형(D) 이미지 프롬프트 생성 화면은 아직 마이그레이션 중입니다.
            다른 템플릿을 골라 주세요.
          </p>
          <button
            type="button"
            onClick={() => setState({ concept: "magazine" })}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-[#287aff] bg-[#287aff] px-5 py-2.5 text-[15px] font-bold text-white transition hover:border-[#1b64da] hover:bg-[#1b64da]"
          >
            매거진형으로 전환
          </button>
        </div>
      </main>
    );
  }

  const card = deck[active];
  const texts = state.card.texts[active] || {};
  const slots = slotsFor(state.concept, card.kind);
  const edited = isFieldEdited(state.card, active, state.concept, card.kind);
  const previewOpts = buildRenderOpts(state, active);
  const selectedLayoutObj = objects.find((o) => o.id === selectedObj) || null;
  const clippedLabels = [...new Set(clippedSlots)].map(
    (id) => slots.find((s) => s.id === id)?.label || id,
  );
  const historyEntry = history.current;
  const canUndo = historyRevision >= 0 && historyEntry.past.length > 0;
  const canRedo = historyEntry.future.length > 0;
  const canResetInitial = Boolean(
    historyEntry.initial &&
    JSON.stringify(historyEntry.current) !==
      JSON.stringify(historyEntry.initial),
  );

  return (
    <main className="min-h-dvh bg-[#1a1a1a] pb-[40px] text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <div className="flex min-h-[1050px] items-stretch rounded-[15px] bg-white/10 max-[860px]:min-h-0 max-[860px]:flex-col max-[860px]:overflow-clip">
          <TextStepper steps={STEPS} activeIndex={2} />
          <div className="min-w-0 flex-1 px-[clamp(24px,calc((39/1920)*100vw),39px)] py-14">
            <header className="mb-6">
              <p className="text-[25px] font-bold leading-[22.4px] text-white">
                글에 맞는 카드뉴스를 생성해보세요.
              </p>
            </header>

            <section
              aria-label="글 생성 조건 요약"
              className="mb-[30px] flex min-h-[66px] items-center gap-6 overflow-hidden rounded-[15px] border border-[#e5e8eb] bg-white px-8 py-[17px] max-[1100px]:flex-wrap max-[1100px]:py-4 max-sm:px-5"
            >
              <dl className="grid min-w-0 flex-1 grid-cols-[minmax(150px,0.7fr)_minmax(220px,1fr)_minmax(220px,1.15fr)_minmax(220px,1.15fr)] items-center gap-x-8 gap-y-3 max-[1380px]:grid-cols-2 max-[700px]:grid-cols-1">
                {[
                  { label: "상품", value: product.name },
                  { label: "주제", value: state.topic },
                  ...(state.focusPoint?.trim()
                    ? [{ label: "강조 할 내용", value: state.focusPoint }]
                    : []),
                  {
                    label: "글 스타일",
                    value: TONE_LABEL[state.tone] || state.tone,
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex min-w-0 items-center gap-[15px] text-[15px] leading-[1.3]"
                  >
                    <dt className="shrink-0 whitespace-nowrap font-bold text-black">
                      {label}
                    </dt>
                    <dd
                      className="min-w-0 truncate font-normal text-[#8e8e8e]"
                      title={value || "-"}
                    >
                      {value || "-"}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="ml-auto flex shrink-0 items-center gap-[10px]">
                <button
                  type="button"
                  onClick={() => router.push("/text")}
                  aria-label="글귀 단계로 돌아가 글 수정하기"
                  className="inline-flex h-[42px] items-center justify-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] text-[15px] font-medium leading-[22.4px] text-[#4e5968] transition hover:bg-[#f7f8fa]"
                >
                  <Icon name="arrowLeft" className="size-[18px]" />글 수정
                </button>
                <button
                  type="button"
                  onClick={() => saveToArchive()}
                  disabled={libraryBusy || !canSaveLibrary}
                  aria-label="지금 게시물을 마이페이지에 저장하기"
                  aria-busy={libraryBusy}
                  className="inline-flex h-[42px] items-center justify-center gap-[5px] rounded-full border border-[#287aff] bg-[#287aff] px-[19px] text-[15px] font-bold leading-[22.4px] text-white transition hover:border-[#1b64da] hover:bg-[#1b64da] disabled:opacity-40"
                >
                  <Icon name="archive" className="size-[18px]" />
                  저장
                </button>
              </div>
            </section>

            <ConceptPicker
              concepts={CONCEPTS}
              value={state.concept}
              onChange={handleConceptChange}
            />

            <div className="sticky top-[60px] z-30 -mx-3 mb-[18px] mt-2 flex flex-wrap items-center justify-between gap-3 px-3 py-3">
              <CardTabs deck={deck} active={active} onSelect={setActive} />
            </div>

            <div className="grid grid-cols-[minmax(0,536px)_1fr] gap-x-10 max-[900px]:grid-cols-1">
              <div>
                <div className="min-[901px]:sticky min-[901px]:top-[142px]">
                  <CanvasPreview
                    texts={texts}
                    opts={previewOpts}
                    cardIndex={active}
                    objects={objects}
                    selectedObj={selectedObj}
                    onSelectObj={setSelectedObj}
                    onCommitLayout={handleCommitLayout}
                    onClipped={handleClipped}
                  />
                  <div
                    className="mt-2.5 flex flex-wrap items-center justify-center gap-2 min-[901px]:absolute min-[901px]:top-full min-[901px]:w-full"
                    aria-label="편집 기록"
                  >
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/20 px-4 text-[14px] font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Icon name="undo" className="size-4" />
                      되돌리기
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/20 px-4 text-[14px] font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Icon name="redo" className="size-4" />
                      다시 실행
                    </button>
                    <button
                      type="button"
                      onClick={handleResetInitial}
                      disabled={!canResetInitial}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/20 px-4 text-[14px] font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Icon name="refresh" className="size-4" />
                      처음 상태로
                    </button>
                  </div>
                  {clippedLabels.length > 0 && (
                    <div
                      className="mt-2 flex items-start gap-2 rounded-[12px] border border-[#ffd6d6] bg-[#fff5f5] p-3 min-[901px]:absolute min-[901px]:top-[calc(100%+68px)] min-[901px]:w-full"
                      role="alert"
                    >
                      <Icon
                        name="alert"
                        className="mt-0.5 size-4 shrink-0 text-[#e11d48]"
                      />
                      <div className="text-[13px] leading-[1.5] text-[#c81e3a]">
                        <strong className="block font-bold">
                          글이 카드에 다 들어가지 않아 잘렸습니다
                        </strong>
                        <p>
                          {clippedLabels.join(" · ")} 를 줄여 주세요. 지금은
                          뒷부분이 카드에 나오지 않습니다.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6 rounded-[15px] border border-[#e5e8eb] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative flex items-center gap-2">
                    <h2 className="text-[18px] font-bold leading-[1.3] text-black">
                      디테일 수정
                    </h2>
                    <details>
                      <summary
                        aria-label="미리보기 편집 도움말"
                        className="inline-flex size-5 cursor-pointer list-none items-center justify-center rounded-full border border-[#8e8e8e] text-[13px] font-medium leading-none text-[#5f6b7a] transition hover:border-[#287aff] hover:text-[#287aff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287aff] [&::-webkit-details-marker]:hidden"
                      >
                        <span aria-hidden="true">?</span>
                      </summary>
                      <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-[min(360px,calc(100vw-64px))] rounded-[12px] border border-[#e5e8eb] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                        <ul className="list-disc space-y-1.5 pl-4 text-[13px] font-normal leading-[1.55] tracking-[-0.26px] text-[#4e5968] marker:text-[#8e8e8e]">
                          <li>
                            미리보기 위 점선 상자를 드래그하면 위치·크기를 바꿀
                            수 있습니다.
                          </li>
                          <li>
                            상자를 누르면 이름이 잠깐 떴다 사라지고, 아래에서
                            숫자·글자 크기로도 조정할 수 있어요.
                          </li>
                          <li>
                            오른쪽 입력칸처럼 미리보기 밖을 누르면 점선이
                            사라지고, 미리보기를 다시 누르면 나타납니다.
                          </li>
                        </ul>
                      </div>
                    </details>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleResetOne}
                      disabled={!edited}
                      aria-label="이 카드 문구를 추천 문구로 되돌리기"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e8eb] bg-white px-[18px] py-[10px] text-[15px] font-bold text-[#5F6B7A] transition hover:bg-[#f7f8fa] disabled:opacity-40"
                    >
                      <Icon name="refresh" className="size-4" />
                      추천 문구로
                    </button>
                    <button
                      type="button"
                      onClick={handleAddTextBox}
                      aria-label="현재 카드에 텍스트 상자 추가"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e8eb] bg-white px-[18px] py-[10px] text-[15px] font-bold text-[#5F6B7A] transition hover:bg-[#f7f8fa]"
                    >
                      <span
                        aria-hidden="true"
                        className="text-[17px] font-medium leading-none"
                      >
                        +
                      </span>
                      텍스트 상자 추가
                    </button>
                  </div>
                </div>

                <CardForm
                  conceptId={state.concept}
                  kind={card.kind}
                  slots={slots}
                  text={texts}
                  extraTexts={state.card?.extraTexts?.[active] || []}
                  selectedObj={selectedObj}
                  onFieldChange={handleFieldChange}
                  onExtraTextChange={handleExtraTextChange}
                  onDeleteExtraText={handleDeleteExtraText}
                />

                {selectedLayoutObj?.type === "text" && (
                  <LayoutPanel
                    objId={selectedObj}
                    label={selectedLayoutObj.label}
                    saved={state.card?.layout?.[active]?.[selectedObj] || {}}
                    onChange={(next) => handleCommitLayout(selectedObj, next)}
                  />
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
                />

                <ImagePanel
                  label={IMAGE_ROLE[concept.id] || IMAGE_ROLE.magazine}
                  disabled={!usesImage(state.concept, card.kind)}
                  hasImage={Boolean(state.images?.[active])}
                  source={state.images?.[active]?.source || null}
                  prompt={buildPrompt(card, state.concept, {
                    index: active,
                    title: texts.title || card.title,
                    subject: imageCaptionFor(state, active),
                  })}
                  cardIndex={active}
                  onUpload={handleUpload}
                  onDelete={handleDeleteImage}
                  onCopy={handleCopyPrompt}
                />

                <SaveActions
                  cardCount={deck.length}
                  savingAll={savingAll}
                  onSaveOne={handleSaveOne}
                  onSaveAll={handleSaveAll}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        id="toast-root"
        className="toast-root"
        role="status"
        aria-live="polite"
      />
    </main>
  );
}
