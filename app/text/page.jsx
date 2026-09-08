"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CHANNELS } from "../../data/channels.js";
import { derivePosts, generateWithAI } from "../../lib/copyai.js";
import { reviewCompliance } from "../../lib/compliance.js";
import { analyzeCustomBlogStyle } from "./_lib/customBlogStyle.js";
import {
  copyChatContextKey,
  getMemorySummary,
} from "../../lib/copymemory.js";
import { getConcept } from "../../lib/concepts.js";
import { coreWithOutline, outlineKeyOf } from "../../lib/outline.js";
import { reportMissingData } from "../../lib/missingdata.js";
import { TONE_LABEL } from "../../lib/copywriter.js";
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
import { ProductSection } from "../_components/home/ProductSection.jsx";
import { PostOutlineSection } from "../_components/home/PostOutlineSection.jsx";
import {
  hasRequiredConditions,
  TONES,
  TopicSection,
} from "../_components/home/TopicSection.jsx";
import { TemplateSection } from "../_components/home/TemplateSection.jsx";
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

const EMPTY_OUTPUT = {
  drafts: {},
  generated: {},
  variants: {},
  sources: {},
  draftKey: "",
  aiKey: {},
  outline: null,
  researchStyle: null,
  activeAiRun: null,
  image: null,
  images: {},
  card: null,
};

/**
 * 조건 편집(펼친 조건 요약 바)에서 「게시물 생성하기」를 눌렀을 때 시안 목록을
 * 어떻게 이어받을지 정한다. 옛 `app/page.jsx` 의 `nextDraftState()` 그대로다 —
 * 조건 편집이 별도 페이지에서 같은 페이지의 펼침 영역으로 옮겨졌을 뿐 로직은 그대로다.
 */
function nextDraftState(latest) {
  const runsKey = `${latest.productId}|${String(latest.topic || "").trim()}`;
  const currentRunsKey = aiRunsKeyOf(latest);

  // 조건 수정 화면에 갔다가 아무것도 바꾸지 않고 돌아온 경우에는 기존
  // 시안과 선택 상태를 그대로 둔다. 이전에는 이 경로에서도 빈 pending
  // run을 하나 추가해서 내용 없는 시안 버튼이 계속 늘어났다.
  if (latest.aiRuns?.key === currentRunsKey) {
    return {
      aiRuns: latest.aiRuns,
      activeAiRun: latest.activeAiRun,
    };
  }

  const sameTopicRuns =
    latest.aiRuns?.key === currentRunsKey ||
    latest.aiRuns?.key === runsKey ||
    String(latest.aiRuns?.key || "").startsWith(`${runsKey}|`) ||
    TONES.some(({ id }) => latest.aiRuns?.key === `${runsKey}|${id}`);

  if (!sameTopicRuns) {
    return { aiRuns: { key: "", list: [] }, activeAiRun: null };
  }

  return {
    // 시안 버튼은 AI 결과가 실제로 생성된 뒤에만 추가한다. 조건만 바꾼
    // 단계에서 빈 run을 선등록하면 생성하지 않았는데도 시안이 생겨 보인다.
    aiRuns: {
      ...latest.aiRuns,
      key: currentRunsKey,
      list: latest.aiRuns?.list || [],
    },
    activeAiRun: null,
  };
}

/** 이 채널의 글을 담고 있는 AI 생성 벌들을, 원래 `aiRuns.list` 안 위치를 지킨 채로 골라낸다. */
function aiRunsForChannel(state, channelId) {
  if (!state || state.aiRuns?.key !== aiRunsKeyOf(state)) return [];
  return (state.aiRuns?.list || [])
    .map((run, index) => ({ run, index }))
    .filter(({ run }) => Object.hasOwn(run.drafts || {}, channelId));
}

const instagramDraftOf = (run, format, field = "drafts") =>
  (field === "generated"
    ? run?.instagramGenerated?.[format]
    : run?.instagramDrafts?.[format])
  ?? run?.[field]?.instagram
  ?? "";

const contentOutlineKeyOf = (contentOutline) =>
  contentOutline ? JSON.stringify(contentOutline) : "";

const outlineJobs = new Map();

/** 저장된 블로그 시안에서 실제로 노출된 소제목을 모은다. */
function blogHeadingsFromRuns(state) {
  if (!state || state.aiRuns?.key !== aiRunsKeyOf(state)) return [];
  return [
    ...new Set(
      (state.aiRuns?.list || [])
        .flatMap((run) => String(run?.drafts?.blog || "").split(/\r?\n/))
        .map((line) => line.trim())
        .filter((line) => line.startsWith("## "))
        .map((line) => line.slice(3).trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * 채널 글을 쓰기 전에 주제 뼈대(core)를 먼저 만든다.
 *
 * 세 채널이 각자 알아서 주제를 쪼개면 서로 다른 이야기를 하게 되므로, 뼈대를 한 번만
 * AI로 만들어(`coreWithOutline`) 모든 채널이 같은 것을 보게 한다 (CLAUDE.md 8-8 참고).
 * 조건(상품·주제·톤·라운드·뼈대잡기 초안)이 그대로면 다시 만들지 않는다 — 있는 뼈대를
 * 또 사면 돈만 쓴다.
 *
 * ⚠️ `state.contentOutline`(펼친 조건 요약 바의 뼈대잡기 모달에서 담당자가 다듬은
 *    서론/본론/결론 초안)은 여기서 `coreWithOutline`에 **참고 자료**로 함께 넘어간다 —
 *    강제 지시가 아니라 각도·항목을 짤 때 반영하는 재료다. 초안이 바뀌면
 *    (`contentOutlineKey`) 캐시된 뼈대를 다시 만든다.
 */
async function ensureOutline(
  state,
  { round = 0, researchStyle = "", extraNote = "", signal, waitIfPaused } = {},
) {
  const key = outlineKeyOf(state);
  const contentOutlineKey = contentOutlineKeyOf(state.contentOutline);
  // extraNote(모달에서 방금 보완한 데이터)가 있으면 캐시를 쓰지 않고 반드시 다시 짠다 —
  // 그래야 방금 입력한 내용이 이번 뼈대에 반영된다.
  if (
    !extraNote &&
    state.outline?.key === key &&
    (state.outline.round || 0) === round &&
    (state.outline.contentOutlineKey || "") === contentOutlineKey
  ) {
    return { core: state.outline.core, error: null };
  }

  const jobKey = `${key}|r${round}|c${contentOutlineKey}${extraNote ? "|note" : ""}`;
  if (outlineJobs.has(jobKey)) return outlineJobs.get(jobKey);

  // 직전 라운드의 소제목을 넘겨 AI 2 이후가 같은 구성을 다시 짜지 못하게 한다.
  const pastHeads =
    state.outline?.key === key ? state.outline.pastHeads || [] : [];
  const avoid = [
    ...new Set([
      ...pastHeads,
      ...blogHeadingsFromRuns(state),
      ...(state.outline?.key === key
        ? (state.outline.core?.points || []).map((x) => x.q)
        : []),
    ]),
  ].filter(Boolean);

  const job = coreWithOutline(
    {
      product: getProduct(state.productId),
      topic: state.topic.trim(),
      focusPoint: String(state.focusPoint || "").trim(),
      tone: state.tone,
      cardCount: state.cardCount,
      round,
      avoid,
      researchStyle,
      contentOutline: state.contentOutline || null,
      extraNote,
    },
    { signal, waitIfPaused },
  )
    .then(({ core, error }) => {
      const latest = getState();
      if (
        !error &&
        (latest.outline?.key !== key || (latest.outline.round || 0) <= round)
      ) {
        setState({
          outline: { key, round, core, pastHeads: avoid, contentOutlineKey },
        });
      }
      return { core: error ? null : core, error };
    })
    .finally(() => outlineJobs.delete(jobKey));
  outlineJobs.set(jobKey, job);
  return job;
}

export default function CopyPage() {
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
  const [outlineExpanded, setOutlineExpanded] = useState(true);
  // 조건이 아직 안 갖춰졌으면(막 새 게시물을 시작했으면) 강제로 펼쳐서 보여준다 —
  // 그래서 `panelExpanded` 는 이 값과 `hasConditions` 를 함께 본다(아래).
  const [expanded, setExpanded] = useState(false);
  const expandInitialized = useRef(false);
  // 「1. 상품을 선택해주세요」 카드의 접힘/펼침 — 조건 패널이 펼쳐져 있는 동안에만
  // 의미가 있고, 기본은 펼친 채로 시작한다(기존 화면과 동일).
  const [productExpanded, setProductExpanded] = useState(true);
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
    const wantsEdit =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("edit") === "1";
    if (wantsEdit || !(state.productId && String(state.topic || "").trim())) {
      setExpanded(true);
    }
  }, [state]);

  // 조건 요약 바가 펼침→접힘으로 바뀌는 순간(「게시물 생성하기」를 눌렀을 때 등)에만
  // 그 접힌 바 맨 위로 화면을 이동한다 — 사용자가 직접 펼칠 때는 스크롤을 건드리지 않는다.
  useEffect(() => {
    if (wasExpandedRef.current && !expanded) {
      requestAnimationFrame(() => {
        summaryTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    wasExpandedRef.current = expanded;
  }, [expanded]);

  async function refreshPresets(productId = state?.productId) {
    if (!productId) {
      setPresets([]);
      return;
    }
    setPresetsLoading(true);
    try {
      setPresets(await loadRandomTopicPresets(productId));
    } catch (error) {
      console.error("[topics] 추천 주제 조회에 실패했습니다.", error);
      const fallback = products.find((item) => item.id === productId)?.topicPresets || [];
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
    if (!channels.length) return toast("채널은 최소 1개를 선택해야 합니다.");
    setState({ channels });
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
      (state.tone === "custom" && !String(state.customStyleUrl || "").trim()) ||
      Number(state.cardCount) <= 0 ||
      !state.channels.length
    ) {
      toast(
        "주제, 글 스타일, 카드뉴스 장수, 내보낼 채널을 모두 선택해 주세요.",
      );
      topicRef.current?.focus();
      return;
    }
    const current = getState();
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
      setOutlineExpanded(true);
      return;
    }
    if (!isEditingExisting) clearLibraryEdit();
    const latest = getState();
    const conditionsUnchanged = latest.aiRuns?.key === aiRunsKeyOf(latest);

    // 기존 시안이 있는 글의 조건이 실제로 달라지지 않았다면 drafts,
    // generated, card 등을 초기화하지 않는다. 선택했던 시안도 유지된다.
    if (conditionsUnchanged && (latest.aiRuns?.list || []).length > 0) {
      setExpanded(false);
      setOutlineExpanded(true);
      return;
    }

    setState({
      ...EMPTY_OUTPUT,
      postId: isEditingExisting ? latest.postId : newPostId(),
      ...nextDraftState(latest),
    });
    setExpanded(false);
    setOutlineExpanded(true);
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
    const controller = new AbortController();
    generationController.current = controller;
    pausedRef.current = false;
    const totalJobs = channelIds.reduce(
      (total, id) => total + (id === "instagram" ? INSTAGRAM_FORMATS.length : 1),
      0,
    );
    setGeneration({ current: 0, total: totalJobs, paused: false });
    setBusy(true);
    try {
      const current = getState();
      const style = (current.styles || []).find(
        (item) => item.id === current.styleId,
      );
      let researchStyle = style?.guide || "";
      if (current.tone === "custom") {
        const customUrl = String(current.customStyleUrl || "").trim();
        if (!customUrl)
          throw new Error("참고할 블로그 글 링크를 입력해 주세요.");
        if (
          current.customStyleGuideUrl === customUrl &&
          current.customStyleGuide
        ) {
          researchStyle = current.customStyleGuide;
        } else {
          toast("블로그 글 스타일을 확인하고 있습니다.");
          researchStyle = await analyzeCustomBlogStyle(customUrl);
          setState({
            customStyleGuide: researchStyle,
            customStyleGuideUrl: customUrl,
          });
        }
        if (current.customStyleSaveRequested) {
          const latest = getState();
          const existing = (latest.styles || []).find((item) =>
            (item.sources || []).includes(customUrl),
          );
          if (existing) {
            setState({
              styles: (latest.styles || []).map((item) =>
                item.id === existing.id
                  ? { ...item, guide: researchStyle, at: Date.now() }
                  : item,
              ),
              styleId: existing.id,
              customStyleSaveRequested: false,
            });
            toast("이미 저장된 글 스타일을 최신 분석으로 업데이트했습니다.");
          } else {
            const used = new Set(
              (latest.styles || []).map((item) => {
                const match = String(item.name || "").match(/^\((\d+)\)$/);
                return match ? Number(match[1]) : 0;
              }),
            );
            let number = 1;
            while (used.has(number)) number += 1;
            const entry = {
              id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name: `(${number})`,
              guide: researchStyle,
              at: Date.now(),
              sources: [customUrl],
            };
            setState({
              styles: [entry, ...(latest.styles || [])].slice(0, 12),
              styleId: entry.id,
              customStyleSaveRequested: false,
            });
            toast(`글 스타일 ${entry.name}을 마이페이지에 저장했습니다.`);
          }
        }
      }

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

      const drafts = {};
      let instagramDrafts = null;
      let completedJobs = 0;
      for (let index = 0; index < channelIds.length; index++) {
        await waitIfPaused();
        if (controller.signal.aborted) {
          throw new DOMException("취소되었습니다.", "AbortError");
        }
        const channelId = channelIds[index];
        const formats = channelId === "instagram"
          ? INSTAGRAM_FORMATS
          : [{ id: null, label: null }];
        for (const format of formats) {
          setGeneration((progress) => ({
            ...progress,
            current: completedJobs + 1,
            channelName: format.id
              ? `인스타그램 ${format.label}`
              : CHANNELS.find((channel) => channel.id === channelId)?.name || channelId,
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
            instagramFormat: format.id || current.instagramFormat || "simple",
          },
          {
            signal: controller.signal,
            waitIfPaused,
          },
          );
          completedJobs += 1;
          if (channelId === "instagram") {
            instagramDrafts = { ...(instagramDrafts || {}), [format.id]: generatedDraft };
          } else {
            drafts[channelId] = generatedDraft;
          }
        }
      }
      if (instagramDrafts) {
        drafts.instagram = instagramDrafts[current.instagramFormat || "simple"]
          || instagramDrafts.simple;
      }
      // 카드뉴스는 아웃라인의 소제목을 재사용하지 않고, 완성된 블로그 전체를
      // OpenAI가 다시 읽어 카드 전용 핵심 문구로 압축한다. 이번 생성에 블로그가
      // 없으면 현재 편집 중인 블로그를 사용한다.
      const blogForCards = String(
        drafts.blog || getState().drafts?.blog || "",
      ).trim();
      let derivedCardCopy = null;
      if (blogForCards) {
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
        // 이 시안을 만들 때 실제로 썼던 조건 — 나중에 다른 시안을 만들며 제목·톤을
        // 바꿔도, 이 시안을 다시 선택하면 그때 조건 그대로 보여줘야 하기 때문에 남긴다.
        // `concept`(카드뉴스 템플릿)은 조건이 다 같은데 템플릿만 바꿔 다시 생성했을 때
        // `AiRunSelector` 가 "시안 N" 대신 템플릿 이름으로 버튼을 보여주는 데 쓴다.
        conditions: {
          title: current.contentOutline?.title || "",
          focusPoint: current.focusPoint || "",
          tone: current.tone,
          concept: current.concept,
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
                    drafts: { ...item.drafts, ...drafts },
                    generated: { ...item.generated, ...drafts },
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
        cardCopy: derivedCardCopy
          ? { key: draftKeyOf(latest), ...derivedCardCopy }
          : null,
        card: null,
      });
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
    toast("AI 생성을 취소했습니다. 담당자에게 자료 보완을 요청해 주세요.", 4000);
  }

  function selectRun(index) {
    const entry = matchingRuns[index];
    if (!entry) return;
    const current = getState();
    const selectedDraft = activeId === "instagram"
      ? instagramDraftOf(entry.run, current.instagramFormat || "simple")
      : entry.run.drafts[activeId];
    const selectedGenerated = activeId === "instagram"
      ? entry.run.instagramGenerated?.[current.instagramFormat || "simple"]
        ?? instagramDraftOf(entry.run, current.instagramFormat || "simple", "generated")
      : entry.run.generated[activeId];
    // 이 시안이 특정 카드뉴스 템플릿을 고른 상태로 만들어졌다면(다른 조건은 같고
    // 템플릿만 바꿔 다시 생성한 경우), 시안을 고르는 즉시 그 템플릿으로 미리보기를
    // 맞춰 준다 — 그래야 「노트형」 버튼을 눌렀을 때 실제로 노트형 카드가 보인다.
    const runConcept = entry.run.conditions?.concept;
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
      ...(runConcept && runConcept !== current.concept
        ? { concept: runConcept }
        : {}),
      card: null,
    });
  }

  function selectConcept(conceptId) {
    if (conceptId === state.concept) return;
    setState({ concept: conceptId });
    toast(`${getConcept(conceptId).name} 템플릿으로 골랐습니다.`);
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
        instagram: entry.run.instagramGenerated?.[instagramFormat]
          ?? instagramDraftOf(entry.run, instagramFormat, "generated"),
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

  const value = activeChannel ? state.drafts?.[activeId] || "" : "";
  const compliance = activeChannel
    ? reviewCompliance(value, activeChannel, product)
    : null;
  // 지금 선택된 시안이 실제로 어떤 조건으로 만들어졌는지 보여준다 — 없으면(아직 AI로
  // 만든 적 없거나 옛 저장본이라 조건이 안 남은 시안이면) 현재 화면의 조건으로 보여준다.
  const activeConditions = activeRunEntry?.run?.conditions;
  const summaryTitle = activeConditions
    ? activeConditions.title
    : state.contentOutline?.title;
  const summaryFocusPoint = activeConditions
    ? activeConditions.focusPoint
    : state.focusPoint;
  const summaryTone = activeConditions ? activeConditions.tone : state.tone;

  return (
    <main className="min-h-dvh bg-[#1a1a1a] pb-[140px] text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <div className="min-h-[1050px] overflow-clip rounded-[15px] bg-white/10">
          <div className="min-w-0 px-[clamp(24px,4vw,56px)] py-14">
            <header className="flex items-end gap-[14px] mb-8">
              <h1 className="text-[32px] font-bold tracking-[-0.04em] text-white">
                상품의 글을 생성해보세요.
              </h1>
              <p className="mb-2 text-white/55">
                AI 생성 결과는 주제와 채널별로 계속 쌓입니다.
              </p>
            </header>
            <div className="space-y-5">
              {panelExpanded ? (
                <div className="flex flex-col gap-12">
                  <ProductSection
                    loading={!productsReady}
                    products={products}
                    selectedId={state.productId}
                    onSelect={selectProduct}
                    expanded={productExpanded}
                    onToggle={() => setProductExpanded((current) => !current)}
                  />
                  <TopicSection
                    product={product}
                    presets={presets}
                    presetsLoading={presetsLoading}
                    onRefreshPresets={() => refreshPresets()}
                    state={state}
                    topicRef={topicRef}
                    onUpdate={(patch) => setState(patch)}
                    onToggleChannel={toggleChannel}
                    onSaveCustomStyle={() => {
                      if (!String(state.customStyleUrl || "").trim()) {
                        toast("먼저 참고할 블로그 글 링크를 입력해 주세요.");
                        return;
                      }
                      setState({ customStyleSaveRequested: true });
                      toast("AI 글을 생성할 때 이 스타일을 마이페이지에 함께 저장합니다.");
                    }}
                  />
                  <TemplateSection
                    product={product}
                    state={state}
                    onUpdate={(patch) => setState(patch)}
                  />
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
                        <Icon name="arrowRight" className="size-[18px] stroke-[1.75]" />
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
                      onEditConditions={() => setExpanded(true)}
                    />
                  </div>
                  <PostOutlineSection
                    product={product}
                    state={state}
                    expanded={outlineExpanded}
                    onToggle={() => setOutlineExpanded((current) => !current)}
                  />
                  {activeChannel && (
                    <div className="overflow-clip rounded-[15px] bg-[#595959]">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-[21px] py-[33px]">
                        <ChannelTabs
                          channels={channels}
                          activeId={activeId}
                          onSelect={setActiveId}
                        />
                        <div className="flex min-w-[310px] flex-col items-end gap-3 max-[640px]:w-full max-[640px]:items-stretch">
                          <div className="flex flex-wrap justify-end gap-2.5">
                            <button
                              disabled={busy}
                              onClick={() => generate([activeId])}
                              className="inline-flex h-[45px] items-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] text-[15px] font-medium text-[#4e5968] disabled:opacity-40"
                            >
                              <Icon name="sparkles" className="size-[18px]" />
                              현재 채널만 AI 생성
                            </button>
                            <button
                              disabled={busy}
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
                        draftLabel={activeRun == null ? "" : `시안 ${activeRun + 1}`}
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
                                disabled={busy}
                                onChange={selectInstagramFormat}
                              />
                            )}
                            {activeId === "blog" && (
                              <BlogConceptSelector
                                value={state.concept}
                                disabled={busy}
                                onChange={selectConcept}
                              />
                            )}
                          </div>
                        }
                        onChange={updateDraft}
                        onToggleMode={() => setReadMode((mode) => !mode)}
                        onCopy={() =>
                          copy(value, `${activeChannel.name} 글귀를 복사했습니다.`)
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
