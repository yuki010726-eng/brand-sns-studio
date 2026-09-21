"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CHANNELS } from "../../data/channels.js";
import { derivePosts, extractProposalContext, generateWithAI } from "../../lib/copyai.js";
import { getOrCreateProposalContext } from "../../lib/proposalContext.js";
import { getTopicSuggestions } from "../../lib/topicSuggestions.js";
import { readTopicSuggestions, saveTopicSuggestions } from "../../lib/topicSuggestionStore.js";
import { reviewCompliance } from "../../lib/compliance.js";
import { copyChatContextKey, getMemorySummary } from "../../lib/copymemory.js";
import { getConcept } from "../../lib/concepts.js";
import { reportMissingData } from "../../lib/missingdata.js";
import { TONE_LABEL } from "../../lib/copywriter.js";
import { readContentCache, writeContentCache } from "../../lib/contentCache.js";
import {
  getTitleSuggestions,
  titleSuggestionKey,
} from "../../lib/titleSuggestions.js";
import {
  clearLibraryEdit,
  getLibrary,
  getLibraryEditId,
  loadFromLibrary,
  postKeyOf,
  saveToLibrary,
} from "../../lib/librarystore.js";
import { loadLocalConfig } from "../../lib/localconfig.js";
import {
  getProduct,
  loadProducts,
  loadRandomTopicPresets,
} from "../../lib/products.js";
import { choiceModal, confirmModal } from "../../components/modal.js";
import {
  aiRunsKeyOf,
  draftKeyOf,
  getState,
  newPostId,
  setState,
  subscribe,
} from "../../store.js";
import { toast } from "../../components/toast.js";
import { LoadingScreen } from "../_components/LoadingScreen.jsx";
import { Icon } from "../_components/Icon.jsx";
import { ContentsTab } from "../_components/ContentsTab.jsx";
import { ProductSection } from "../_components/home/ProductSection.jsx";
import { TitleSuggestionSection } from "../_components/home/TitleSuggestionSection.jsx";
import {
  hasRequiredConditions,
  hasTemplateSelectionConditions,
  TopicSection,
} from "../_components/home/TopicSection.jsx";
import { TemplateSection } from "../_components/home/TemplateSection.jsx";
import { ImagePostSetup } from "../template/_components/ImagePostSetup.jsx";
import { AiRunSelector } from "../_components/text/AiRunSelector.jsx";
import { BlogConceptSelector } from "../_components/text/BlogConceptSelector.jsx";
import {
  INSTAGRAM_FORMATS,
  InstagramFormatSelector,
} from "../_components/text/InstagramFormatSelector.jsx";
import { ChannelTabs } from "../_components/text/ChannelTabs.jsx";
import { MissingDataModal } from "../_components/text/MissingDataModal.jsx";
// import { CopyActions } from "../_components/text/CopyActions.jsx";
import { CopyEditor } from "../_components/text/CopyEditor.jsx";
import { GenerationSummary } from "./_components/GenerationSummary.jsx";
import { TextPageHeader } from "./_components/TextPageHeader.jsx";
import {
  EMPTY_OUTPUT,
  aiRunsForChannel,
  blogHeadingsFromRuns,
  ensureOutline,
  instagramDraftOf,
  nextDraftState,
} from "./_lib/draftState.js";

// Every current output template consumes the generated card copy, including
// the blog-style and direct-response ad layouts.
const CARD_COPY_CONCEPT_IDS = new Set([
  "card",
  "note",
  "magazine",
  "blog",
  "intuitive",
]);

function needsCardCopy(state) {
  const conceptIds = Array.isArray(state?.concepts)
    ? state.concepts
    : [state?.concept];
  return conceptIds.some((id) => CARD_COPY_CONCEPT_IDS.has(id));
}

/** The template checkboxes are a distinct AI-run condition, while all runs
 * must stay in one aiRuns list so the 시안 1/2 selector never disappears. */
function conceptSelectionOf(value) {
  const ids = Array.isArray(value?.concepts) ? value.concepts : [value?.concept];
  return [...new Set(ids.filter(Boolean))].sort();
}

function hasSameTemplateSelection(run, state) {
  const saved = conceptSelectionOf(run?.conditions);
  const current = conceptSelectionOf(state);
  return saved.length === current.length && saved.every((id, index) => id === current[index]);
}

// `template/text-image` is the post-result URL. It reuses this preview, but
// must not reopen the condition form immediately after post generation.
export function CopyPage({ resultOnly = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Query URLs remain supported for old bookmarks; all in-app navigation uses
  // the pathname routes below.
  const editMode =
    pathname.endsWith("/image") ||
    (pathname === "/text" && searchParams.get("edit") === "2")
      ? "2"
      : "1";
  const openedFromLibrary = searchParams.get("fromLibrary") === "1";
  const topicRef = useRef(null);
  const [state, setViewState] = useState(null);
  const [activeId, setActiveId] = useState("");
  const [readMode, setReadMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(null);
  const [productsReady, setProductsReady] = useState(false);
  // AI가 "확인된 상품 사실에 없습니다" 류의 문장을 정직하게 썼을 때 멈추고 띄우는 모달의 상태.
  // null이면 닫혀 있다. lib/missingdata.js 참고.
  const [missingData, setMissingData] = useState(null);
  const generationController = useRef(null);
  const pausedRef = useRef(false);
  const pauseWaiters = useRef([]);

  // ── 상품·주제 선택 (펼친 조건 요약 바) — 옛 app/page.jsx 를 그대로 옮겼다 ──
  const [products, setProducts] = useState([]);
  const [presets, setPresets] = useState([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  // 「글 구조 요약」 패널의 펼침 상태 — 「게시물 생성하기」를 누르면 펼친 채로
  // 넘어온다. 옛 뼈대잡기 모달을 대체한 패널(PostOutlineSection.jsx)이 접힘/펼침을
  // 직접 그린다. 여기서는 언제 펼쳐 보여줄지만 정한다.
  const [titlesLoading, setTitlesLoading] = useState(false);
  // 조건이 아직 안 갖춰졌으면(막 새 게시물을 시작했으면) 강제로 펼쳐서 보여준다 —
  // 그래서 `panelExpanded` 는 이 값과 `hasConditions` 를 함께 본다(아래).
  const [expanded, setExpanded] = useState(false);
  const expandInitialized = useRef(false);
  // 「1. 상품을 선택해주세요」 카드의 접힘/펼침 — 조건 패널이 펼쳐져 있는 동안에만
  // 의미가 있고, 기본은 펼친 채로 시작한다(기존 화면과 동일).
  // 「게시물 생성하기」를 눌러 조건 요약 바가 접히는 순간, 그 접힌 바 맨 위로
  // 화면을 이동시킨다 — 아래 `expanded` 감시 effect 가 이 ref 를 스크롤 대상으로 쓴다.
  const summaryTopRef = useRef(null);
  const wasExpandedRef = useRef(expanded);

  useEffect(() => {
    setViewState(getState());
    const unsubscribe = subscribe(setViewState);
    Promise.all([loadLocalConfig(), loadProducts()])
      .then(([, items]) => setProducts([...items]))
      .catch(() => toast("상품 정보를 불러오지 못했습니다."))
      .finally(() => setProductsReady(true));
    return unsubscribe;
  }, []);

  useEffect(() => () => generationController.current?.abort(), []);

  // 처음 이 페이지에 들어왔을 때 조건이 비어 있으면(상품·주제 미선택) 조건 요약
  // 바를 펼친 채로 시작한다. 이후에는 사용자가 직접 펼치고/접는다.
  // `?edit=1` 로 들어오면(마이페이지의 「상품·주제 선택하기」 등) 조건이 이미 있어도
  // 펼친 채로 시작한다 — 그 링크의 목적 자체가 "조건을 고치러 왔다"이기 때문이다.
  // ⚠️ `useSearchParams()` 대신 `window.location.search` 를 직접 읽는다 — Next.js
  //    는 `useSearchParams()` 를 쓰는 페이지에 Suspense 경계를 요구해서 빌드가 깨진다.
  useEffect(() => {
    if (!state || expandInitialized.current) return;
    expandInitialized.current = true;
    // `/text/text-image` is the explicit "open post setup" route.  The
    // result route (`/template/text-image`) renders this same component with
    // `resultOnly`, so keeping the route in this decision is important: the
    // two screens must not accidentally inherit each other's open state.
    const wantsEdit =
      pathname === "/text/text-image" ||
      (editMode === "1" && !resultOnly);
    if (
      (!openedFromLibrary && wantsEdit) ||
      !(state.productId && String(state.topic || "").trim())
    ) {
      setExpanded(true);
    }
  }, [state, editMode, openedFromLibrary, pathname, resultOnly]);

  // 조건 요약 바가 펼침→접힘으로 바뀌는 순간(「게시물 생성하기」를 눌렀을 때 등)에만
  // 그 접힌 바 맨 위로 화면을 이동한다 — 사용자가 직접 펼칠 때는 스크롤을 건드리지 않는다.
  useEffect(() => {
    if (wasExpandedRef.current && !expanded) {
      requestAnimationFrame(() => {
        summaryTopRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
    wasExpandedRef.current = expanded;
  }, [expanded]);

  async function refreshPresets(productId = state?.productId, options) {
    if (!productId) {
      setPresets([]);
      return;
    }
    setPresetsLoading(true);
    try {
      const currentProduct = products.find((item) => item.id === productId);
      if (options?.force && currentProduct) {
        const { context } = await getOrCreateProposalContext(
          currentProduct,
          extractProposalContext,
        );
        const generated = await getTopicSuggestions(currentProduct, [], {
          forceRefresh: true,
          facts: context,
        });
        setPresets(generated);
        await saveTopicSuggestions(currentProduct, generated);
        return;
      }
      if (currentProduct) {
        const saved = await readTopicSuggestions(currentProduct);
        if (saved?.length) {
          setPresets(saved.slice(0, 4));
          return;
        }
      }
      setPresets(await loadRandomTopicPresets(productId, options));
    } catch (error) {
      console.error("[topics] 추천 주제 조회에 실패했습니다.", error);
      const fallback =
        products.find((item) => item.id === productId)?.topicPresets || [];
      setPresets(fallback.slice(0, 4));
      toast("추천 주제를 불러오지 못했습니다.");
    } finally {
      setPresetsLoading(false);
    }
  }

  useEffect(() => {
    refreshPresets(state?.productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshPresets 는 매 렌더 새로 만들어진다
  }, [state?.productId, products]);

  function selectProduct(id) {
    setState({
      productId: id,
      topic: "",
      focusPoint: "",
      tone: "",
      customStyleUrl: "",
      customStyleGuide: "",
      customStyleGuideUrl: "",
      customStyleSaveRequested: false,
      cardCount: 0,
      concept: "",
      concepts: [],
      channels: [],
      libraryTitle: "",
      contentOutline: null,
    });
    requestAnimationFrame(() =>
      topicRef.current?.focus({ preventScroll: true }),
    );
  }

  function toggleChannel(id) {
    const channels = state.channels.includes(id)
      ? state.channels.filter((item) => item !== id)
      : [...state.channels, id];
    // 채널에 맞는 템플릿은 조건을 처음 채울 때의 기본값이다. 블로그와
    // 인스타그램을 함께 고르면 두 템플릿도 함께 선택한다.
    const concepts = [
      ...(channels.includes("blog") ? ["blog"] : []),
      ...(channels.includes("instagram") ? ["card"] : []),
    ];
    setState({
      channels,
      ...(concepts.length ? { concept: concepts[0], concepts } : {}),
    });
  }

  function clearTopic() {
    setState({
      topic: "",
      focusPoint: "",
      tone: "",
      customStyleUrl: "",
      customStyleGuide: "",
      customStyleGuideUrl: "",
      customStyleSaveRequested: false,
      cardCount: 0,
      concept: "",
      concepts: [],
      channels: [],
      libraryTitle: "",
      contentOutline: null,
    });
    topicRef.current?.focus();
    toast("주제를 비웠습니다.");
  }

  /**
   * TopicSection 의 「게시물 생성하기」를 눌렀을 때 — 옛 `app/page.jsx` 의
   * `goToCopy()` 를 그대로 옮겼다. 예전에는 여기서 뼈대잡기 모달을 띄우고 모달의
   * 「확인」에서 이 로직을 실행했는데, 지금은 모달이 없어졌으므로(글 구조 요약이
   * `PostOutlineSection` 이 되어 조건 요약 바 아래 상시 펼쳐진다) 검증을 마치는 즉시
   * 이어서 실행한다. `contentOutline`(제목·서론·본론·결론) 은 더 이상 여기서 만들지
   * 않는다 — `PostOutlineSection` 이 펼쳐지면 스스로 기본값을 채운다.
   */
  async function startGeneration() {
    if (
      !state.productId ||
      state.topic.trim().length < 2 ||
      !state.tone ||
      Number(state.cardCount) <= 0 ||
      !state.channels.length ||
      !hasRequiredConditions(state)
    ) {
      toast(
        "주제, 글 스타일, 카드뉴스 장수, 내보낼 채널과 템플릿을 모두 선택해 주세요.",
      );
      topicRef.current?.focus();
      return;
    }
    const initial = getState();
    if (!String(initial.contentOutline?.title || "").trim()) {
      const titleKey = titleSuggestionKey(
        getProduct(initial.productId),
        initial,
      );
      const cachedTitles =
        Array.isArray(initial.contentOutline?.titleOptions) &&
        initial.contentOutline.titleOptionsKey === titleKey
          ? initial.contentOutline.titleOptions
          : null;
      // 제목 추천 응답을 기다리지 않고 먼저 결과 화면으로 전환한다.
      // 추천 중인 동안에는 아래의 titlesLoading UI가 즉시 표시된다.
      setExpanded(false);
      if (!cachedTitles?.length) {
        setTitlesLoading(true);
        try {
          const titles = await getTitleSuggestions(
            getProduct(initial.productId),
            initial,
          );
          const latest = getState();
          setState({
            contentOutline: {
              ...(latest.contentOutline || {}),
              title: "",
              titleOptions: titles,
              titleOptionsKey: titleKey,
            },
          });
        } catch (error) {
          console.error("[titles] title recommendation failed", error);
          toast("제목을 추천하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        } finally {
          setTitlesLoading(false);
        }
      }
      return;
    }
    const current = initial;
    const editingId = getLibraryEditId();
    const editingItem = editingId
      ? getLibrary().find((item) => item.id === editingId)
      : null;
    if (editingItem && editingItem.postKey !== postKeyOf(current)) {
      const makeNew = await confirmModal("새 게시물을 만들까요?", {
        title: "다른 주제를 선택했습니다",
        okLabel: "만들기",
        cancelLabel: "취소",
      });
      if (!makeNew) return;
      clearLibraryEdit();
      setState({
        ...EMPTY_OUTPUT,
        postId: newPostId(),
        aiRuns: { key: "", list: [] },
      });
    }
    const nextState = getState();
    // A proposal-derived result can be reused from the image editor even when
    // the user did not save this work to the library.
    const cachedContent = readContentCache(nextState.productId, nextState.topic);
    // 같은 주제로 이미 시안이 있는데 템플릿 선택만 달라졌다면 이 캐시 분기를 타면 안 된다.
    // 여기서 결과 화면으로 넘겨 버리면 아래의 `pendingTemplateSelection` 이 저장되지 않아
    // 결과 화면이 템플릿 선택을 직전 시안의 것으로 되돌리고, 새 시안에도 그 템플릿만 남는다.
    const priorRuns =
      nextState.aiRuns?.key === aiRunsKeyOf(nextState)
        ? nextState.aiRuns?.list || []
        : [];
    const templatesChangedForNewRun =
      priorRuns.length > 0 &&
      !hasSameTemplateSelection(priorRuns.at(-1), nextState);
    if (
      !templatesChangedForNewRun &&
      cachedContent?.drafts?.blog &&
      cachedContent?.cardCopy?.cards?.length
    ) {
      setState({
        drafts: { ...nextState.drafts, ...cachedContent.drafts },
        generated: { ...nextState.generated, ...(cachedContent.generated || cachedContent.drafts) },
        outline: cachedContent.outline || nextState.outline,
        cardCopy: cachedContent.cardCopy,
        card: null,
      });
      setExpanded(false);
      toast("같은 상품·주제의 저장된 제안서 분석 결과를 불러왔습니다.");
      router.push("/template/text-image");
      return;
    }
    const existing = getLibrary().find(
      (item) => item.postKey === postKeyOf(nextState),
    );
    const isEditingExisting = existing?.id === getLibraryEditId();
    if (existing && !isEditingExisting) {
      const choice = await choiceModal("보관함에 저장되어있는 주제입니다.", {
        title: "보관함에 저장된 주제",
        choices: [{ value: "load", label: "불러오기", primary: true }],
      });
      if (choice !== "load") return;
      const result = await loadFromLibrary(existing.id);
      if (!result.ok) return toast(result.error);
      setExpanded(false);
      router.push("/template/text-image");
      return;
    }
    if (!isEditingExisting) clearLibraryEdit();
    const latest = getState();
    const conditionsUnchanged = latest.aiRuns?.key === aiRunsKeyOf(latest);

    // 기존 시안이 있는 글의 조건이 실제로 달라지지 않았다면 drafts,
    // generated, card 등을 초기화하지 않는다. 선택했던 시안도 유지된다.
    const latestRun = latest.aiRuns?.list?.at(-1);
    // Do not silently reopen 시안 1 after the user changes template
    // checkboxes. The new selection needs its own immutable run snapshot,
    // but remains alongside previous runs in the same selector.
    const templatesUnchanged = hasSameTemplateSelection(latestRun, latest);
    if (
      conditionsUnchanged &&
      templatesUnchanged &&
      (latest.aiRuns?.list || []).length > 0
    ) {
      setExpanded(false);
      router.push("/template/text-image");
      return;
    }

    // A changed template selection prepares the *next* AI run; it must not
    // repaint the run currently on screen before the user presses AI 생성.
    // Keep the existing result alive and project its immutable template
    // snapshot back onto the preview while the new settings wait in the
    // condition panel / next generation request.
    const existingRuns = latest.aiRuns?.list || [];
    if (existingRuns.length) {
      const previewChannelId = latest.channels?.[0];
      const channelRuns = existingRuns.filter((run) =>
        Object.hasOwn(run.drafts || {}, previewChannelId),
      );
      const activeIndex =
        typeof latest.activeAiRun === "object"
          ? latest.activeAiRun?.[previewChannelId]
          : latest.activeAiRun;
      const previewRun = channelRuns[activeIndex] || latestRun;
      const runConcept = previewRun?.conditions?.concept;
      const runConcepts = Array.isArray(previewRun?.conditions?.concepts)
        ? previewRun.conditions.concepts.filter(Boolean)
        : runConcept
          ? [runConcept]
          : [latest.concept].filter(Boolean);
      const previewConcept = runConcepts.includes(runConcept)
        ? runConcept
        : runConcepts[0] || latest.concept;

      setState({
        postId: isEditingExisting ? latest.postId : latest.postId || newPostId(),
        ...nextDraftState(latest),
        // Hold the requested templates until AI generation.  `concept` itself
        // is restored below because it controls the currently visible run.
        pendingTemplateSelection: {
          concept: latest.concept,
          concepts: [...new Set((latest.concepts || []).filter(Boolean))],
        },
        concept: previewConcept,
        concepts: runConcepts,
        cardCopy: previewRun?.cardCopy
          ? { key: draftKeyOf(latest), ...previewRun.cardCopy }
          : latest.cardCopy,
        card: null,
      });
      setExpanded(false);
      router.push("/template/text-image");
      return;
    }

    setState({
      ...EMPTY_OUTPUT,
      postId: isEditingExisting ? latest.postId : newPostId(),
      ...nextDraftState(latest),
    });
    setExpanded(false);
    router.push("/template/text-image");
  }

  function waitIfPaused() {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise((resolve) => pauseWaiters.current.push(resolve));
  }

  function toggleGenerationPause() {
    if (!busy) return;
    pausedRef.current = !pausedRef.current;
    setGeneration((current) =>
      current ? { ...current, paused: pausedRef.current } : current,
    );
    if (!pausedRef.current) {
      pauseWaiters.current.splice(0).forEach((resolve) => resolve());
    }
  }

  function cancelGeneration() {
    if (!busy) return;
    pausedRef.current = false;
    pauseWaiters.current.splice(0).forEach((resolve) => resolve());
    generationController.current?.abort();
  }

  const channels = useMemo(
    () => CHANNELS.filter((channel) => state?.channels?.includes(channel.id)),
    [state?.channels],
  );

  const hasConditions = Boolean(
    state?.productId && String(state?.topic || "").trim(),
  );
  // 글 구조 요약에서 고른 제목은 생성 조건의 일부다. 제목이 비어 있으면
  // 어떤 경로로도 AI 생성 버튼을 활성화하지 않는다.
  const hasSelectedOutlineTitle = Boolean(
    String(state?.contentOutline?.title || "").trim(),
  );
  // 조건이 안 갖춰졌으면 사용자가 접으려 해도 무조건 펼친 채로 둔다 —
  // 접힌 채 요약할 조건 자체가 없다.
  const panelExpanded = expanded || !hasConditions;

  useEffect(() => {
    if (!state) return;
    if (!channels.some((channel) => channel.id === activeId)) {
      setActiveId(channels[0]?.id || "");
    }
  }, [activeId, channels, state]);

  const activeChannel = channels.find((channel) => channel.id === activeId);
  const product = state ? getProduct(state.productId) : null;
  const matchingRuns = useMemo(
    () => aiRunsForChannel(state, activeId),
    [activeId, state],
  );
  const activeRun =
    typeof state?.activeAiRun === "object"
      ? (state.activeAiRun?.[activeId] ?? null)
      : (state?.activeAiRun ?? null);
  const activeRunEntry = matchingRuns[activeRun];
  const chatContextKey = activeRunEntry
    ? copyChatContextKey(state.aiRuns.key, activeId, activeRun)
    : "";

  // The condition form temporarily keeps a future-run template selection.
  // On the result route, however, the visible preview is always owned by the
  // selected AI run.  Guard this at render time as well as at navigation time:
  // it covers an already-mounted page and prevents a pending "card" choice
  // from repainting 시안 1 before 시안 2 exists.
  useEffect(() => {
    if (!resultOnly || !activeRunEntry) return;
    const current = getState();
    const runConcept = activeRunEntry.run.conditions?.concept;
    const runConcepts = Array.isArray(activeRunEntry.run.conditions?.concepts)
      ? activeRunEntry.run.conditions.concepts.filter(Boolean)
      : runConcept
        ? [runConcept]
        : [];
    if (!runConcepts.length || runConcepts.includes(current.concept)) return;
    const concept = runConcepts.includes(runConcept)
      ? runConcept
      : runConcepts[0];
    setState({
      concept,
      concepts: runConcepts,
      cardCopy: activeRunEntry.run.cardCopy
        ? { key: draftKeyOf(current), ...activeRunEntry.run.cardCopy }
        : current.cardCopy,
      card: null,
    });
  }, [activeRunEntry, resultOnly]);

  function updateDraft(value) {
    const current = getState();
    const patch = { drafts: { ...current.drafts, [activeId]: value } };
    const entry = matchingRuns[activeRun];
    if (entry) {
      const instagramFormat = current.instagramFormat || "simple";
      patch.aiRuns = {
        ...current.aiRuns,
        list: current.aiRuns.list.map((run, index) =>
          index === entry.index
            ? {
                ...run,
                drafts: { ...run.drafts, [activeId]: value },
                ...(activeId === "instagram"
                  ? {
                      instagramDrafts: {
                        ...(run.instagramDrafts || {}),
                        [instagramFormat]: value,
                      },
                    }
                  : {}),
              }
            : run,
        ),
      };
    }
    setState(patch);
  }

  async function generate(channelIds, extraNote = "") {
    if (!product || busy) return;
    if (!String(getState().contentOutline?.title || "").trim()) {
      toast("글 구조 요약에서 제목을 선택해 주세요.");
      return;
    }
    const controller = new AbortController();
    generationController.current = controller;
    pausedRef.current = false;
    const totalJobs = 1 + channelIds.reduce(
      (total, id) =>
        total + (id === "instagram" ? INSTAGRAM_FORMATS.length : 1),
      0,
    );
    setGeneration({ current: 0, total: totalJobs, paused: false });
    setBusy(true);
    window.dispatchEvent(
      new CustomEvent("app:ai-generation", { detail: { active: true } }),
    );
    try {
      const current = getState();
      const style = (current.styles || []).find(
        (item) => item.id === current.styleId,
      );
      let researchStyle = style?.guide || "";
      // 채널 글을 쓰기 전에 주제 뼈대(core)를 먼저 만든다 — 세 채널이 같은 뼈대를 봐야
      // 내용이 통일된다. AI 1/2/3... 몇 번째 벌인지(round)에 따라 뼈대도 새로 짠다.
      const round = Math.max(
        0,
        ...channelIds.map(
          (id) =>
            aiRunsForChannel(current, id).filter(({ run }) => !run.pending)
              .length,
        ),
      );
      setGeneration((progress) => ({ ...progress, current: 1, channelName: "제안서 사실 정리" }));
      const { context: proposalContext, cached: proposalCached } = await getOrCreateProposalContext(
        product,
        extractProposalContext,
        { signal: controller.signal },
      );

      const { core, error: outlineError } = await ensureOutline(current, {
        round,
        researchStyle,
        extraNote,
        signal: controller.signal,
        waitIfPaused,
      });
      if (outlineError) {
        toast(`AI 주제 구성을 만들지 못했습니다 — ${outlineError}`, 5000);
        return;
      }

      // 챗봇에서 정리된 이 사용자의 스타일 메모 — 있으면 채널 프롬프트에 참고로 들어간다.
      const memory = await getMemorySummary().catch(() => null);

      if (proposalCached) {
        setGeneration((progress) => ({ ...progress, channelName: "저장된 제안서 사실 확인" }));
      }

      const drafts = {};
      let instagramDrafts = null;
      let completedJobs = 1;
      for (let index = 0; index < channelIds.length; index++) {
        await waitIfPaused();
        if (controller.signal.aborted) {
          throw new DOMException("취소되었습니다.", "AbortError");
        }
        const channelId = channelIds[index];
        const formats =
          channelId === "instagram"
            ? INSTAGRAM_FORMATS
            : [{ id: null, label: null }];
        for (const format of formats) {
          setGeneration((progress) => ({
            ...progress,
            current: completedJobs + 1,
            channelName: format.id
              ? `인스타그램 ${format.label}`
              : CHANNELS.find((channel) => channel.id === channelId)?.name ||
                channelId,
          }));
          const generatedDraft = await generateWithAI(
            channelId,
            {
              product,
              topic: current.topic.trim(),
              focusPoint: String(current.focusPoint || "").trim(),
              tone: current.tone,
              round,
              avoidHeadings: blogHeadingsFromRuns(current),
              variant: (current.variants?.[channelId] || 0) + 1,
              cardCount: current.cardCount,
              core,
              contentOutline: current.contentOutline || null,
              researchStyle,
              userMemory: memory?.summary || "",
              extraNote,
              proposalContext,
              instagramFormat: format.id || current.instagramFormat || "simple",
            },
            {
              signal: controller.signal,
              waitIfPaused,
            },
          );
          completedJobs += 1;
          if (channelId === "instagram") {
            instagramDrafts = {
              ...(instagramDrafts || {}),
              [format.id]: generatedDraft,
            };
          } else {
            drafts[channelId] = generatedDraft;
          }
        }
      }
      if (instagramDrafts) {
        drafts.instagram =
          instagramDrafts[current.instagramFormat || "simple"] ||
          instagramDrafts.simple;
      }
      // 카드뉴스는 아웃라인의 소제목을 재사용하지 않고, 완성된 블로그 전체를
      // OpenAI가 다시 읽어 카드 전용 핵심 문구로 압축한다. 이번 생성에 블로그가
      // 없으면 현재 편집 중인 블로그를 사용한다.
      const blogForCards = String(
        drafts.blog || getState().drafts?.blog || "",
      ).trim();
      let derivedCardCopy = null;
      // Card copy consumes a separate AI call, so make it only when an output
      // template is selected. Channel selection alone must not trigger it.
      const pendingTemplates = current.pendingTemplateSelection;
      const generationConcepts = Array.isArray(pendingTemplates?.concepts)
        ? pendingTemplates.concepts.filter(Boolean)
        : (current.concepts || []).filter(Boolean);
      const generationConcept = generationConcepts.includes(pendingTemplates?.concept)
        ? pendingTemplates.concept
        : generationConcepts[0] || current.concept;
      const generationState = {
        ...current,
        concept: generationConcept,
        concepts: generationConcepts,
      };
      if (needsCardCopy(generationState) && blogForCards) {
        setGeneration((generation) => ({
          ...generation,
          channelName: "카드뉴스 요약",
        }));
        try {
          const derived = await derivePosts(
            blogForCards,
            {
              product,
              topic: current.topic.trim(),
              focusPoint: String(current.focusPoint || "").trim(),
              tone: current.tone,
              cardCount: current.cardCount,
              core,
              contentOutline: current.contentOutline || null,
              researchStyle,
              userMemory: memory?.summary || "",
              extraNote,
              instagramFormat: current.instagramFormat || "simple",
            },
            {
              signal: controller.signal,
              waitIfPaused,
            },
          );
          derivedCardCopy = derived?.cards?.length
            ? {
                cards: derived.cards,
                coverRecommendations: derived.coverRecommendations || [],
              }
            : null;
        } catch (error) {
          if (error?.name === "AbortError") throw error;
          // 카드 요약 한 번의 실패 때문에 이미 완성된 채널 글까지 버리지는 않는다.
          // 템플릿에서는 기존 규칙 기반 덱으로 안전하게 폴백한다.
          console.warn("[card-copy] 카드뉴스 요약 생성에 실패했습니다.", error);
        }
      }
      const latest = getState();
      const run = {
        drafts,
        generated: { ...drafts },
        // Card copy is generated from the draft, so it belongs to this AI
        // run as well.  Keeping it here prevents selecting 시안 1 after
        // creating 시안 2 from showing 시안 2's card/image copy.
        cardCopy: derivedCardCopy,
        // 이 시안을 만들 때 실제로 썼던 조건 — 나중에 다른 시안을 만들며 제목·톤을
        // 바꿔도, 이 시안을 다시 선택하면 그때 조건 그대로 보여줘야 하기 때문에 남긴다.
        // `concept`(카드뉴스 템플릿)은 조건이 다 같은데 템플릿만 바꿔 다시 생성했을 때
        // `AiRunSelector` 가 "시안 N" 대신 템플릿 이름으로 버튼을 보여주는 데 쓴다.
        conditions: {
          title: current.contentOutline?.title || "",
          focusPoint: current.focusPoint || "",
          tone: current.tone,
          concept: generationConcept,
          // A run owns the template choices that existed when it was made.
          // Later edits to the condition panel must not change which preview
          // formats an older run can use.
          concepts: generationConcepts,
        },
        ...(instagramDrafts
          ? {
              instagramDrafts,
              instagramGenerated: { ...instagramDrafts },
            }
          : {}),
      };
      const sameKey = latest.aiRuns?.key === aiRunsKeyOf(latest);
      const existingList = sameKey ? latest.aiRuns?.list || [] : [];
      const pendingIndex = existingList.findIndex(
        (item) =>
          item.pending &&
          channelIds.every((id) => Object.hasOwn(item.drafts || {}, id)),
      );
      const list =
        pendingIndex >= 0
          ? existingList.map((item, index) =>
              index === pendingIndex
                ? {
                    ...item,
                    // A resumed/incomplete run must keep the same immutable
                    // template snapshot as a newly-created run.  Without it
                    // the result UI fell back to whichever template happens
                    // to be selected globally.
                    conditions: run.conditions,
                    drafts: { ...item.drafts, ...drafts },
                    generated: { ...item.generated, ...drafts },
                    cardCopy: run.cardCopy,
                    pending: Object.values({ ...item.drafts, ...drafts }).some(
                      (value) => !String(value || "").trim(),
                    ),
                    ...(instagramDrafts
                      ? {
                          instagramDrafts,
                          instagramGenerated: { ...instagramDrafts },
                        }
                      : {}),
                  }
                : item,
            )
          : sameKey
            ? [...existingList, run]
            : [run];
      const activeAiRun =
        typeof latest.activeAiRun === "object" && latest.activeAiRun
          ? { ...latest.activeAiRun }
          : {};
      channelIds.forEach((id) => {
        const channelRunIndex =
          list.filter((item) => Object.hasOwn(item.drafts || {}, id)).length -
          1;
        activeAiRun[id] = channelRunIndex;
      });
      setState({
        drafts: { ...latest.drafts, ...drafts },
        generated: { ...latest.generated, ...drafts },
        sources: {
          ...latest.sources,
          ...Object.fromEntries(channelIds.map((id) => [id, "ai"])),
        },
        variants: {
          ...latest.variants,
          ...Object.fromEntries(
            channelIds.map((id) => [id, (latest.variants?.[id] || 0) + 1]),
          ),
        },
        aiRuns: {
          key: aiRunsKeyOf(latest),
          groupId: sameKey ? latest.aiRuns?.groupId : undefined,
          list,
        },
        activeAiRun,
        concept: generationConcept,
        concepts: generationConcepts,
        pendingTemplateSelection: null,
        cardCopy: derivedCardCopy
          ? { key: draftKeyOf(latest), ...derivedCardCopy }
          : null,
        card: null,
      });
      const savedState = getState();
      if (derivedCardCopy?.cards?.length) {
        writeContentCache(savedState.productId, savedState.topic, {
          drafts: savedState.drafts,
          generated: savedState.generated,
          outline: savedState.outline,
          cardCopy: savedState.cardCopy,
        });
      }
      const saved = await saveToLibrary(getState());
      if (!saved.ok) toast(`자동 저장 실패 · ${saved.error}`, 6000);
      toast(`${channelIds.length}개 채널 글을 만들었습니다.`);
    } catch (error) {
      if (error?.name === "AbortError") {
        toast("AI 생성을 취소했습니다.");
        return;
      }
      if (error?.name === "MissingDataError") {
        if (extraNote) {
          // 방금 보완한 내용으로 다시 시도했는데도 같은 문제다 — 1회만 다시 시도하고,
          // 또 걸리면 모달을 다시 띄우지 않고 담당자에게 넘긴다.
          toast(
            `보완한 내용으로도 "${error.subject}" 자료를 찾지 못했습니다 — 담당자에게 자료 업데이트를 요청해 주세요.`,
            6000,
          );
          return;
        }
        setMissingData({
          subject: error.subject,
          sentence: error.sentence,
          stage: error.stage,
          channelId: error.channelId,
          channelIds,
          topic: getState().topic || "",
        });
        return;
      }
      console.error(error);
      toast(error?.message || "AI 글 생성에 실패했습니다.");
    } finally {
      generationController.current = null;
      pausedRef.current = false;
      pauseWaiters.current.splice(0).forEach((resolve) => resolve());
      setGeneration(null);
      setBusy(false);
      window.dispatchEvent(
        new CustomEvent("app:ai-generation", { detail: { active: false } }),
      );
    }
  }

  /** 모달에서 「이 내용으로 계속」을 눌렀을 때 — 담당자 검토용으로 기록하고, 입력한 내용을
   *  이번 생성 1회에만 반영해 같은 채널을 다시 만든다. */
  async function submitMissingData(userInput) {
    const pending = missingData;
    setMissingData(null);
    if (!pending) return;
    reportMissingData({
      productId: product?.id,
      topic: pending.topic,
      channelId: pending.channelId,
      stage: pending.stage,
      subject: pending.subject,
      sentence: pending.sentence,
      userInput,
    });
    await generate(pending.channelIds, userInput);
  }

  /** 모달에서 「취소」를 눌렀을 때 — AI 생성을 멈추고, 무엇이 없었는지만 기록해 둔다. */
  function cancelMissingData() {
    const pending = missingData;
    setMissingData(null);
    if (!pending) return;
    reportMissingData({
      productId: product?.id,
      topic: pending.topic,
      channelId: pending.channelId,
      stage: pending.stage,
      subject: pending.subject,
      sentence: pending.sentence,
      userInput: "",
    });
    toast(
      "AI 생성을 취소했습니다. 담당자에게 자료 보완을 요청해 주세요.",
      4000,
    );
  }

  function selectRun(index) {
    const entry = matchingRuns[index];
    if (!entry) return;
    const current = getState();
    const selectedDraft =
      activeId === "instagram"
        ? instagramDraftOf(entry.run, current.instagramFormat || "simple")
        : entry.run.drafts[activeId];
    const selectedGenerated =
      activeId === "instagram"
        ? (entry.run.instagramGenerated?.[
            current.instagramFormat || "simple"
          ] ??
          instagramDraftOf(
            entry.run,
            current.instagramFormat || "simple",
            "generated",
          ))
        : entry.run.generated[activeId];
    // 이 시안이 특정 카드뉴스 템플릿을 고른 상태로 만들어졌다면(다른 조건은 같고
    // 템플릿만 바꿔 다시 생성한 경우), 시안을 고르는 즉시 그 템플릿으로 미리보기를
    // 맞춰 준다 — 그래야 「노트형」 버튼을 눌렀을 때 실제로 노트형 카드가 보인다.
    const runConcept = entry.run.conditions?.concept;
    // Runs saved before per-run choices were introduced have only `concept`.
    // Preserve a usable selector for those older drafts without guessing at
    // templates that were never selected.
    const runConcepts = Array.isArray(entry.run.conditions?.concepts)
      ? entry.run.conditions.concepts.filter(Boolean)
      : runConcept
        ? [runConcept]
        : current.concepts || [];
    const selectedConcept = runConcepts.includes(runConcept)
      ? runConcept
      : runConcepts[0] || current.concept;
    setState({
      drafts: { ...current.drafts, [activeId]: selectedDraft },
      generated: {
        ...current.generated,
        [activeId]: selectedGenerated,
      },
      sources: { ...current.sources, [activeId]: "ai" },
      activeAiRun: {
        ...(typeof current.activeAiRun === "object" ? current.activeAiRun : {}),
        [activeId]: index,
      },
      concept: selectedConcept,
      concepts: runConcepts,
      // Restore the card copy made for the selected run.  A previous run may
      // legitimately have no card copy (older data or a failed card-copy
      // request), in which case the renderer safely falls back to its draft.
      cardCopy: entry.run.cardCopy
        ? { key: draftKeyOf(current), ...entry.run.cardCopy }
        : null,
      card: null,
    });
  }

  function selectConcept(conceptId) {
    // A template can be changed while reviewing a run, but only among the
    // templates chosen in the condition step.  This keeps generated card copy
    // and image prompts scoped to that explicit selection.
    const runChoices = Array.isArray(activeRunEntry?.run?.conditions?.concepts)
      ? activeRunEntry.run.conditions.concepts
      : activeRunEntry?.run?.conditions?.concept
        ? [activeRunEntry.run.conditions.concept]
        : state.concepts || [];
    if (conceptId === state.concept || !runChoices.includes(conceptId)) {
      return;
    }
    setState({
      concept: conceptId,
    });
    toast(`${getConcept(conceptId).name} 템플릿으로 골랐습니다.`);
  }

  function selectChannel(channelId) {
    setActiveId(channelId);
  }

  function selectInstagramFormat(instagramFormat) {
    const current = getState();
    const entry = matchingRuns[activeRun];
    if (!entry) {
      setState({ instagramFormat });
      return;
    }
    setState({
      instagramFormat,
      drafts: {
        ...current.drafts,
        instagram: instagramDraftOf(entry.run, instagramFormat),
      },
      generated: {
        ...current.generated,
        instagram:
          entry.run.instagramGenerated?.[instagramFormat] ??
          instagramDraftOf(entry.run, instagramFormat, "generated"),
      },
    });
  }

  async function copy(text, message) {
    if (!text?.trim()) return toast("복사할 내용이 없습니다.");
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast("복사하지 못했습니다. 내용을 직접 선택해 주세요.");
    }
  }

  if (!state || !productsReady) return <LoadingScreen />;

  const isImageTopicSetup = editMode === "2";

  if (isImageTopicSetup) {
    const selectedConceptIds = (Array.isArray(state.concepts)
      ? state.concepts
      : [state.concept]
    ).filter(Boolean);

    return (
      <main className="min-h-dvh bg-[#1a1a1a] pb-10 text-[#4e5968]">
        <div className="w-full px-[clamp(20px,3.85vw,74px)] py-6">
          <div className="mb-6"><ContentsTab /></div>
          <TextPageHeader>콘텐츠 이미지를 생성해보세요.</TextPageHeader>
          <ImagePostSetup
            loading={!productsReady}
            products={products}
            productId={state.productId}
            topic={state.topic || ""}
            presets={presets}
            presetsLoading={presetsLoading}
            concept={state.concept}
            selectedConceptIds={selectedConceptIds}
            onProductChange={(productId) =>
              setState({ productId, topic: "", card: null, images: {} })
            }
            onTopicChange={(topic) => setState({ topic, card: null })}
            onRefreshPresets={() => refreshPresets(undefined, { force: true })}
            onConceptSelectionChange={(conceptId) => {
              const concepts = selectedConceptIds.includes(conceptId)
                ? selectedConceptIds.filter((id) => id !== conceptId)
                : [...selectedConceptIds, conceptId];
              setState({
                concept: concepts.includes(state.concept) ? state.concept : concepts[0] || null,
                concepts,
                card: null,
              });
            }}
            onConceptPreviewChange={(concept) => setState({ concept })}
            generating={false}
            onStart={() => router.push("/template/image")}
            expanded
            onToggle={() => {}}
          />
        </div>
      </main>
    );
  }

  const value = activeChannel ? state.drafts?.[activeId] || "" : "";
  const compliance = activeChannel
    ? reviewCompliance(value, activeChannel, product)
    : null;
  // 지금 선택된 시안이 실제로 어떤 조건으로 만들어졌는지 보여준다 — 없으면(아직 AI로
  // 만든 적 없거나 옛 저장본이라 조건이 안 남은 시안이면) 현재 화면의 조건으로 보여준다.
  const activeConditions = activeRunEntry?.run?.conditions;
  const activeRunConcepts = Array.isArray(activeConditions?.concepts)
    ? activeConditions.concepts.filter(Boolean)
    : activeConditions?.concept
      ? [activeConditions.concept]
      : state.concepts || [];
  const summaryTitle = activeConditions
    ? activeConditions.title
    : state.contentOutline?.title;
  const summaryFocusPoint = activeConditions
    ? activeConditions.focusPoint
    : state.focusPoint;
  const summaryTone = activeConditions ? activeConditions.tone : state.tone;

  return (
    <main className="h-full bg-[#1a1a1a] text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <div className="my-6">
          <ContentsTab />
        </div>
        <div className="overflow-clip rounded-[15px]">
          <div className="min-w-0 pb-10">
            <TextPageHeader>상품의 글을 생성해보세요.</TextPageHeader>
            <div className="space-y-5">
              {panelExpanded ? (
                <div className="flex flex-col gap-5">
                  <TopicSection
                    product={product}
                    productSection={
                      <ProductSection
                        loading={!productsReady}
                        products={products}
                        selectedId={state.productId}
                        onSelect={selectProduct}
                      />
                    }
                    presets={presets}
                    presetsLoading={presetsLoading}
                    onRefreshPresets={() => refreshPresets(undefined, { force: true })}
                    state={state}
                    topicRef={topicRef}
                    onUpdate={(patch) => setState(patch)}
                    onToggleChannel={toggleChannel}
                  />
                  {hasTemplateSelectionConditions(state) && (
                    <TemplateSection
                      product={product}
                      state={state}
                      onUpdate={(patch) => setState(patch)}
                    />
                  )}
                  {product && (
                    <div className="flex items-center justify-end gap-4 max-[560px]:flex-col max-[560px]:items-stretch">
                      <button
                        type="button"
                        className="rounded-full bg-transparent px-3 py-2 text-[15px] font-bold text-white hover:bg-white/10"
                        onClick={clearTopic}
                      >
                        초기화
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#287aff] px-7 py-3.5 text-[16px] font-bold text-white transition hover:bg-[#1b64da] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
                        disabled={!hasRequiredConditions(state)}
                        onClick={startGeneration}
                      >
                        게시물 생성하기{" "}
                        <Icon
                          name="arrowRight"
                          className="size-[18px] stroke-[1.75]"
                        />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div ref={summaryTopRef} className="scroll-mt-[116px]">
                    <GenerationSummary
                      productName={product?.name}
                      topic={state.topic}
                      focusPoint={summaryFocusPoint}
                      writingStyle={TONE_LABEL[summaryTone] || summaryTone}
                      onEditConditions={() => {
                        // Editing conditions is always the setup flow.  From
                        // the result URL, move to its dedicated route before
                        // expanding so browser reload/back behavior remains
                        // deterministic as well.
                        if (resultOnly) router.push("/text/text-image");
                        setExpanded(true);
                      }}
                    />
                  </div>
                  {titlesLoading ? (
                    <section
                      className="flex items-center gap-3 rounded-[15px] border border-[#e5e8eb] bg-white px-8 py-7 text-[14px] font-medium text-[#6b7684] max-sm:px-5"
                      role="status"
                    >
                      <span
                        className="size-5 animate-spin rounded-full border-2 border-[#d9e7ff] border-t-[#287aff]"
                        aria-hidden="true"
                      />
                      제목을 추천하고 있어요.
                    </section>
                  ) : (
                    <TitleSuggestionSection state={state} busy={busy} />
                  )}
                  {activeChannel && (
                    <div className="overflow-clip rounded-[15px] bg-[#595959]">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-[21px] py-[33px]">
                        <ChannelTabs
                          channels={channels}
                          activeId={activeId}
                          onSelect={selectChannel}
                        />
                        <div className="flex min-w-[310px] flex-col items-end gap-3 max-[640px]:w-full max-[640px]:items-stretch">
                          <div className="flex flex-wrap justify-end gap-2.5">
                            <button
                              disabled={busy || !hasSelectedOutlineTitle}
                              onClick={() => generate([activeId])}
                              className="inline-flex h-[45px] items-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] text-[15px] font-medium text-[#4e5968] disabled:opacity-40"
                            >
                              <Icon name="sparkles" className="size-[18px]" />
                              현재 채널만 AI 생성
                            </button>
                            <button
                              disabled={busy || !hasSelectedOutlineTitle}
                              onClick={() =>
                                generate(channels.map((channel) => channel.id))
                              }
                              className="inline-flex h-[45px] items-center gap-[5px] rounded-full border border-[#287aff] bg-[#287aff] px-[19px] text-[15px] font-bold text-white disabled:opacity-40"
                            >
                              <Icon name="sparkles" className="size-[18px]" />
                              전체 채널 AI 생성
                            </button>
                          </div>
                        </div>
                      </div>
                      <CopyEditor
                        channel={activeChannel}
                        value={value}
                        generatedValue={state.generated?.[activeId] || ""}
                        readMode={readMode}
                        compliance={compliance}
                        showChat={Boolean(state.aiRuns?.list?.length)}
                        chatContextKey={chatContextKey}
                        draftLabel={
                          activeRun == null ? "" : `시안 ${activeRun + 1}`
                        }
                        generation={busy ? generation : null}
                        onToggleGenerationPause={toggleGenerationPause}
                        onCancelGeneration={cancelGeneration}
                        runSelector={
                          <div className="flex flex-col gap-3">
                            <AiRunSelector
                              runs={matchingRuns}
                              activeIndex={activeRun}
                              onSelect={selectRun}
                            />
                            {activeId === "instagram" && (
                              <InstagramFormatSelector
                                value={state.instagramFormat || "simple"}
                                conceptValue={state.concept}
                                selectedConceptIds={activeRunConcepts}
                                disabled={busy}
                                onChange={selectInstagramFormat}
                                onConceptChange={selectConcept}
                              />
                            )}
                            {activeId === "blog" && (
                              <BlogConceptSelector
                                value={state.concept}
                                selectedIds={activeRunConcepts}
                                disabled={busy}
                                onChange={selectConcept}
                              />
                            )}
                          </div>
                        }
                        onChange={updateDraft}
                        onToggleMode={() => setReadMode((mode) => !mode)}
                        onCopy={() =>
                          copy(
                            value,
                            `${activeChannel.name} 글귀를 복사했습니다.`,
                          )
                        }
                        instagramHandle={product?.handle}
                        cardCount={state.cardCount}
                        blogTitle={summaryTitle}
                        productName={product?.name}
                        state={state}
                        product={product}
                      />
                    </div>
                  )}
                </>
              )}
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
      <MissingDataModal
        notice={missingData}
        onSubmit={submitMissingData}
        onCancel={cancelMissingData}
      />
    </main>
  );
}

export default CopyPage;
