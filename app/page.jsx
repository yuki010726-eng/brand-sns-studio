"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { choiceModal, confirmModal } from "../components/modal.js";
import { toast } from "../components/toast.js";
import {
  clearLibraryEdit,
  getLibrary,
  getLibraryEditId,
  loadFromLibrary,
  postKeyOf,
} from "../lib/librarystore.js";
import { loadProducts, loadRandomTopicPresets } from "../lib/products.js";
import { aiRunsKeyOf, getState, newPostId, setState, STEPS, subscribe } from "../store.js";
import { LoadingScreen } from "./_components/LoadingScreen.jsx";
import { ProductSection } from "./_components/home/ProductSection.jsx";
import { PostOutlineModal } from "./_components/home/PostOutlineModal.jsx";
import { TONES, TopicSection } from "./_components/home/TopicSection.jsx";
import { WorkshopStepper } from "./_components/home/WorkshopStepper.jsx";

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

export default function HomePage() {
  const router = useRouter();
  const topicRef = useRef(null);
  const [state, setViewState] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [presets, setPresets] = useState([]);
  const [presetsLoading, setPresetsLoading] = useState(false);

  useEffect(() => {
    setViewState(getState());
    const unsubscribe = subscribe(setViewState);
    loadProducts()
      .then((items) => setProducts([...items]))
      .catch(() => toast("상품 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
    return unsubscribe;
  }, []);

  const product = useMemo(
    () => products.find((item) => item.id === state?.productId) || null,
    [products, state?.productId],
  );
  const update = (patch) => setState(patch);

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
  }, [state?.productId, products]);

  function selectProduct(id) {
    update({
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
    update({ channels });
  }

  function clearTopic() {
    update({
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
    });
    topicRef.current?.focus();
    toast("주제를 비웠습니다.");
  }

  function openOutline() {
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
    setOutlineOpen(true);
  }

  async function goToCopy(contentOutline) {
    setOutlineOpen(false);
    setState({ contentOutline });
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
      router.push("/text");
      return;
    }
    if (!isEditingExisting) clearLibraryEdit();
    const latest = getState();
    const conditionsUnchanged = latest.aiRuns?.key === aiRunsKeyOf(latest);

    // 기존 시안이 있는 글의 조건이 실제로 달라지지 않았다면 drafts,
    // generated, card 등을 초기화하지 않는다. 선택했던 시안도 유지된다.
    if (conditionsUnchanged && (latest.aiRuns?.list || []).length > 0) {
      router.push("/text");
      return;
    }

    setState({
      ...EMPTY_OUTPUT,
      postId: isEditingExisting ? latest.postId : newPostId(),
      ...nextDraftState(latest),
    });
    router.push("/text");
  }

  if (!state) return <LoadingScreen />;
  return (
    <main className="min-h-dvh bg-[#1a1a1a] pb-[170px] pt-0 text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <div className="flex items-stretch overflow-hidden rounded-[15px] bg-white/10 max-[860px]:min-h-0 max-[860px]:flex-col">
          <WorkshopStepper steps={STEPS} />
          <div className="flex min-w-0 flex-1 flex-col gap-12 px-[39px] pb-20 pl-[49px] pt-[61px] max-[860px]:px-6 max-[860px]:pb-[54px] max-[860px]:pt-[34px]">
            <ProductSection
              loading={loading}
              products={products}
              selectedId={state.productId}
              onSelect={selectProduct}
            />
            <TopicSection
              product={product}
              presets={presets}
              presetsLoading={presetsLoading}
              onRefreshPresets={() => refreshPresets()}
              state={state}
              topicRef={topicRef}
              onUpdate={update}
              onToggleChannel={toggleChannel}
              onClear={clearTopic}
              onSubmit={openOutline}
              onSaveCustomStyle={() => {
                if (!String(state.customStyleUrl || "").trim()) {
                  toast("먼저 참고할 블로그 글 링크를 입력해 주세요.");
                  return;
                }
                setState({ customStyleSaveRequested: true });
                toast("AI 글을 생성할 때 이 스타일을 마이페이지에 함께 저장합니다.");
              }}
            />
          </div>
        </div>
      </div>
      <PostOutlineModal
        open={outlineOpen}
        product={product}
        state={state}
        onClose={() => setOutlineOpen(false)}
        onConfirm={goToCopy}
      />
      <div
        id="toast-root"
        className="toast-root"
        role="status"
        aria-live="polite"
      />
    </main>
  );
}
