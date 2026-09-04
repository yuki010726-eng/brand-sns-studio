"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNELS } from "../../data/channels.js";
import { derivePosts, generateWithAI } from "../../lib/copyai.js";
import { reviewCompliance } from "../../lib/compliance.js";
import { analyzeCustomBlogStyle } from "./_lib/customBlogStyle.js";
import {
  copyChatContextKey,
  getMemorySummary,
} from "../../lib/copymemory.js";
import { coreWithOutline, outlineKeyOf } from "../../lib/outline.js";
import { reportMissingData } from "../../lib/missingdata.js";
import { TONE_LABEL } from "../../lib/copywriter.js";
import { saveToLibrary } from "../../lib/librarystore.js";
import { loadLocalConfig } from "../../lib/localconfig.js";
import { getProduct, loadProducts } from "../../lib/products.js";
import {
  aiRunsKeyOf,
  draftKeyOf,
  getState,
  setState,
  STEPS,
  subscribe,
} from "../../store.js";
import { toast } from "../../components/toast.js";
import { LoadingScreen } from "../_components/LoadingScreen.jsx";
import { Icon } from "../_components/Icon.jsx";
import { AiRunSelector } from "../_components/text/AiRunSelector.jsx";
import {
  INSTAGRAM_FORMATS,
  InstagramFormatSelector,
} from "../_components/text/InstagramFormatSelector.jsx";
import { ChannelTabs } from "../_components/text/ChannelTabs.jsx";
import { MissingDataModal } from "../_components/text/MissingDataModal.jsx";
// import { CopyActions } from "../_components/text/CopyActions.jsx";
import { CopyEditor } from "../_components/text/CopyEditor.jsx";
import { TextStepper } from "../_components/text/TextStepper.jsx";
import { GenerationSummary } from "./_components/GenerationSummary.jsx";

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
 * ⚠️ `state.contentOutline`(홈 화면의 뼈대잡기 모달에서 담당자가 다듬은 서론/본론/결론
 *    초안)은 여기서 `coreWithOutline`에 **참고 자료**로 함께 넘어간다 — 강제 지시가 아니라
 *    각도·항목을 짤 때 반영하는 재료다. 초안이 바뀌면(`contentOutlineKey`) 캐시된 뼈대를
 *    다시 만든다.
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
  const router = useRouter();
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

  useEffect(() => {
    setViewState(getState());
    const unsubscribe = subscribe(setViewState);
    Promise.all([loadLocalConfig(), loadProducts()]).finally(() =>
      setProductsReady(true),
    );
    return unsubscribe;
  }, []);

  useEffect(() => () => generationController.current?.abort(), []);

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

  useEffect(() => {
    if (!state) return;
    if (!state.productId || !state.topic?.trim()) {
      router.replace("/");
      return;
    }
    if (!channels.some((channel) => channel.id === activeId)) {
      setActiveId(channels[0]?.id || "");
    }
  }, [activeId, channels, router, state]);

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
        conditions: {
          title: current.contentOutline?.title || "",
          focusPoint: current.focusPoint || "",
          tone: current.tone,
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
      card: null,
    });
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

  function moveToTemplate() {
    const current = getState();
    const hasGeneratedPost = channels.some((channel) =>
      String(current.generated?.[channel.id] || "").trim(),
    );
    if (!hasGeneratedPost) {
      toast("글 생성 후 이동할 수 있습니다.");
      return;
    }
    // AI 생성을 한 채널만 했다면 나머지 선택 채널은 아직 글이 없다 — "게시글이
    // 없다"는 것은 컴플라이언스 위반이 아니라 아직 안 만든 것뿐이므로, 실제로
    // 글이 있는 채널만 검사한다.
    const blockedChannel = channels.find((channel) => {
      const text = current.drafts?.[channel.id];
      if (!String(text || "").trim()) return false;
      return reviewCompliance(text, channel, product).errors.length;
    });
    if (blockedChannel) {
      setActiveId(blockedChannel.id);
      toast(`${blockedChannel.name} 게시글에 수정이 필요한 컴플라이언스 항목이 있습니다.`, 5000);
      return;
    }
    router.push("/template");
  }

  if (!state || !productsReady || !activeChannel) return <LoadingScreen />;
  const value = state.drafts?.[activeId] || "";
  const compliance = reviewCompliance(value, activeChannel, product);
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
        <div className="flex min-h-[1050px] items-stretch overflow-clip rounded-[15px] bg-white/10 max-[860px]:min-h-0 max-[860px]:flex-col">
          <TextStepper steps={STEPS} activeIndex={1} />
          <div className="min-w-0 flex-1 px-[clamp(24px,4vw,56px)] py-14">
            <header className="flex items-end gap-[14px] mb-8">
              <h1 className="text-[32px] font-bold tracking-[-0.04em] text-white">
                {Object.keys(state.drafts || {}).length
                  ? "상품의 글을 생성해보세요."
                  : "상품의 글을 생성해보세요."}
              </h1>
              <p className="mb-2 text-white/55">
                AI 생성 결과는 주제와 채널별로 계속 쌓입니다.
              </p>
            </header>
            <div className="space-y-5">
              <GenerationSummary
                productName={product?.name}
                topic={state.topic}
                title={summaryTitle}
                focusPoint={summaryFocusPoint}
                writingStyle={TONE_LABEL[summaryTone] || summaryTone}
                onEditConditions={() => router.push("/")}
                onNext={moveToTemplate}
              />
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
      <MissingDataModal
        notice={missingData}
        onSubmit={submitMissingData}
        onCancel={cancelMissingData}
      />
    </main>
  );
}
