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
import { loadProducts } from "../lib/products.js";
import { getTopicSuggestions } from "../lib/topicSuggestions.js";
import { getState, newPostId, setState, STEPS, subscribe } from "../store.js";
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

export default function HomePage() {
  const router = useRouter();
  const topicRef = useRef(null);
  const [state, setViewState] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [presetOrder, setPresetOrder] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);

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
  const presets = presetOrder;
  const update = (patch) => setState(patch);

  useEffect(() => {
    if (!product) {
      setPresetOrder([]);
      return undefined;
    }
    const controller = new AbortController();
    setTopicsLoading(true);
    getTopicSuggestions(product, [], { signal: controller.signal })
      .then(setPresetOrder)
      .catch((error) => {
        if (error?.name !== "AbortError") console.error(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTopicsLoading(false);
      });
    return () => controller.abort();
  }, [product]);

  function selectProduct(id) {
    update({
      productId: id,
      topic: "",
      focusPoint: "",
      tone: "",
      customStyleUrl: "",
      customStyleGuide: "",
      customStyleGuideUrl: "",
      cardCount: 0,
      channels: [],
      libraryTitle: "",
    });
    setPresetOrder([]);
    requestAnimationFrame(() =>
      topicRef.current?.focus({ preventScroll: true }),
    );
  }

  async function shufflePresets() {
    if (!product || topicsLoading) return;
    setTopicsLoading(true);
    try {
      setPresetOrder(await getTopicSuggestions(product, presetOrder));
    } finally {
      setTopicsLoading(false);
    }
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
    if (!isEditingExisting) {
      clearLibraryEdit();
      const latest = getState();
      const runsKey = `${latest.productId}|${String(latest.topic || "").trim()}`;
      const sameTopicRuns =
        latest.aiRuns?.key === runsKey ||
        TONES.some(({ id }) => latest.aiRuns?.key === `${runsKey}|${id}`);
      setState({
        ...EMPTY_OUTPUT,
        postId: newPostId(),
        aiRuns: sameTopicRuns ? latest.aiRuns : { key: "", list: [] },
      });
    }
    router.push("/text");
  }

  if (!state) return <LoadingScreen />;
  return (
    <main className="min-h-dvh bg-[#1a1a1a] pb-[170px] pt-0 text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <div className="flex min-h-[1170px] items-stretch overflow-hidden rounded-[15px] bg-white/10 max-[860px]:min-h-0 max-[860px]:flex-col">
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
              topicsLoading={topicsLoading}
              state={state}
              topicRef={topicRef}
              onUpdate={update}
              onShuffle={shufflePresets}
              onToggleChannel={toggleChannel}
              onClear={clearTopic}
              onSubmit={openOutline}
              onSaveCustomStyle={() => {
                if (!String(state.customStyleUrl || "").trim()) {
                  toast("먼저 참고할 블로그 글 링크를 입력해 주세요.");
                  return;
                }
                toast(
                  "스타일 보관함은 마이페이지 마이그레이션 후 연결될 예정입니다.",
                );
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
