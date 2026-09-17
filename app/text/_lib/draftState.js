import { TONES } from "../../_components/home/TopicSection.jsx";
import { aiRunsKeyOf, getState, setState } from "../../../store.js";
import { getProduct } from "../../../lib/products.js";
import { outlineKeyOf } from "../../../lib/outline.js";
import { buildCore } from "../../../lib/copywriter.js";

export const EMPTY_OUTPUT = {
  drafts: {}, generated: {}, variants: {}, sources: {}, draftKey: "", aiKey: {},
  outline: null, researchStyle: null, activeAiRun: null, image: null, images: {}, card: null,
};

export function nextDraftState(latest) {
  const runsKey = `${latest.productId}|${String(latest.topic || "").trim()}`;
  const currentRunsKey = aiRunsKeyOf(latest);
  if (latest.aiRuns?.key === currentRunsKey) return { aiRuns: latest.aiRuns, activeAiRun: latest.activeAiRun };
  const sameTopicRuns = latest.aiRuns?.key === currentRunsKey || latest.aiRuns?.key === runsKey || String(latest.aiRuns?.key || "").startsWith(`${runsKey}|`) || TONES.some(({ id }) => latest.aiRuns?.key === `${runsKey}|${id}`);
  if (!sameTopicRuns) return { aiRuns: { key: "", list: [] }, activeAiRun: null };
  return { aiRuns: { ...latest.aiRuns, key: currentRunsKey, list: latest.aiRuns?.list || [] }, activeAiRun: null };
}

export function aiRunsForChannel(state, channelId) {
  if (!state || state.aiRuns?.key !== aiRunsKeyOf(state)) return [];
  return (state.aiRuns?.list || []).map((run, index) => ({ run, index })).filter(({ run }) => Object.hasOwn(run.drafts || {}, channelId));
}

export const instagramDraftOf = (run, format, field = "drafts") =>
  (field === "generated" ? run?.instagramGenerated?.[format] : run?.instagramDrafts?.[format]) ?? run?.[field]?.instagram ?? "";

export function blogHeadingsFromRuns(state) {
  if (!state || state.aiRuns?.key !== aiRunsKeyOf(state)) return [];
  return [...new Set((state.aiRuns?.list || []).flatMap((run) => String(run?.drafts?.blog || "").split(/\r?\n/)).map((line) => line.trim()).filter((line) => line.startsWith("## ")).map((line) => line.slice(3).trim()).filter(Boolean))];
}

export async function ensureOutline(state, { round = 0, researchStyle = "", extraNote = "", signal, waitIfPaused } = {}) {
  const key = outlineKeyOf(state);
  if (!extraNote && state.outline?.key === key && (state.outline.round || 0) === round) return { core: state.outline.core, error: null };
  const pastHeads = state.outline?.key === key ? state.outline.pastHeads || [] : [];
  const avoid = [...new Set([...pastHeads, ...blogHeadingsFromRuns(state)])].filter(Boolean);
  const core = buildCore({
    product: getProduct(state.productId),
    topic: state.topic.trim(),
    tone: state.tone,
    cardCount: state.cardCount,
  });
  setState({ outline: { key, round, core, pastHeads: avoid } });
  return { core, error: null };
}
