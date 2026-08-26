"use client";

/**
 * 마이페이지 (구 STEP 5 보관함) — 계정 설정과 저장해 둔 게시물을 한자리에서 본다.
 *
 * 게시물이 들어오는 길은 하나다. 4단계에서 「보관함에 저장」을 누른 게시물만 여기 있다
 * (요청자 결정). 자동으로 쌓지 않는 이유는 `lib/librarystore.js` 머리말에 적어 뒀다.
 *
 * 이 화면이 하는 일은 셋이다.
 *   찾기(검색·상품 필터·정렬) → 불러오기(4단계로 복원) → 지우기
 *
 * ⚠️ 검색·필터·정렬 값은 스토어에 넣지 않는다. 화면을 떠나면 사라져도 되는 값이고,
 *    넣으면 기기 간 동기화까지 따라가서 다른 PC 의 필터가 바뀐다.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmModal } from "../../components/modal.js";
import { toast } from "../../components/toast.js";
import {
  loadFromLibrary,
  postKeyOf,
  removeFromLibrary,
} from "../../lib/librarystore.js";
import { getProduct, loadProducts } from "../../lib/products.js";
import { getState, subscribe } from "../../store.js";
import { LoadingScreen } from "../_components/LoadingScreen.jsx";
import { LibraryEmptyState } from "./_components/LibraryEmptyState.jsx";
import { LibraryGrid } from "./_components/LibraryGrid.jsx";
import { LibraryNoResults } from "./_components/LibraryNoResults.jsx";
import { LibraryToolbar } from "./_components/LibraryToolbar.jsx";
import { SettingsList } from "./_components/SettingsList.jsx";

/** 주제·상품명뿐 아니라 글 내용까지 뒤진다. 주제를 잊어도 문장 한 조각으로 찾을 수 있어야 한다. */
function haystack(item) {
  const drafts = item.state?.drafts || {};
  const product = getProduct(item.productId);
  return [item.title, product?.name || "", product?.short || "", ...Object.values(drafts)]
    .join(" ")
    .toLowerCase();
}

const SORT_COMPARATORS = {
  recent: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
  oldest: (a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)),
  title: (a, b) => a.title.localeCompare(b.title, "ko"),
};

export default function LibraryPage() {
  const router = useRouter();
  const [state, setViewState] = useState(null);
  const [productsReady, setProductsReady] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [productFilter, setProductFilter] = useState("all");

  useEffect(() => {
    setViewState(getState());
    const unsubscribe = subscribe(setViewState);
    loadProducts().finally(() => setProductsReady(true));
    return unsubscribe;
  }, []);

  const all = useMemo(
    () => (Array.isArray(state?.library) ? state.library : []),
    [state],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = all.filter(
      (it) => productFilter === "all" || it.productId === productFilter,
    );
    if (q) list = list.filter((it) => haystack(it).includes(q));
    return list.slice().sort(SORT_COMPARATORS[sort] || SORT_COMPARATORS.recent);
  }, [all, query, productFilter, sort]);

  function clearFilters() {
    setQuery("");
    setProductFilter("all");
  }

  /**
   * 불러오기 — 지금 작업 중인 내용을 덮어쓴다.
   *
   * ⚠️ 작업 중인 게시물이 아직 보관되지 않았다면 먼저 물어본다. 여기서 말없이 덮으면
   *    돌이킬 방법이 없다(보관함에 없으니 되찾을 곳도 없다).
   */
  async function handleLoad(id) {
    const current = getState();
    const working = String(current.topic || "").trim();
    const target = all.find((it) => it.id === id);
    if (!target) {
      toast("항목을 찾을 수 없습니다.");
      return;
    }

    const unsaved =
      working && !all.some((it) => it.postKey === postKeyOf(current));
    if (unsaved && postKeyOf(current) !== target.postKey) {
      const ok = await confirmModal(
        `지금 작업 중인 「${working}」은(는) 보관함에 없습니다. 불러오면 지금 내용은 사라집니다.`,
        { okLabel: "그래도 불러오기", title: "저장하지 않은 작업이 있습니다" },
      );
      if (!ok) return;
    }

    const result = await loadFromLibrary(id);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    toast(`「${target.title}」을(를) 불러왔습니다.`);
    router.push("/template");
  }

  async function handleRemove(id) {
    const item = all.find((it) => it.id === id);
    if (!item) return;

    const ok = await confirmModal(
      `「${item.title}」을(를) 보관함에서 지웁니다. 되돌릴 수 없습니다.`,
      { okLabel: "삭제", title: "게시물 삭제", danger: true },
    );
    if (!ok) return;

    await removeFromLibrary(id);
    toast("보관함에서 지웠습니다.");
  }

  if (!state || !productsReady) return <LoadingScreen />;

  return (
    <main className="min-h-dvh bg-[#1a1a1a] pb-[140px] pt-[54px] text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <header className="mb-10">
          <h1 className="text-[32px] font-bold tracking-[-0.04em] text-white">
            마이페이지
          </h1>
          <p className="mt-2 max-w-[560px] text-white/55">
            계정 설정과 저장해 둔 게시물을 한자리에서 봅니다. 게시물을
            불러오면 글귀·템플릿·카드 문구가 그대로 되살아납니다.
          </p>
        </header>

        <section className="mb-12">
          <h2 className="mb-4 text-[20px] font-bold text-white">설정</h2>
          <SettingsList />
        </section>

        <section>
          <h2 className="mb-4 text-[20px] font-bold text-white">
            저장한 게시물
          </h2>
          {all.length > 0 && (
            <LibraryToolbar
              items={all}
              query={query}
              sort={sort}
              productFilter={productFilter}
              onQueryChange={setQuery}
              onSortChange={setSort}
              onFilterChange={setProductFilter}
            />
          )}
          {!all.length ? (
            <LibraryEmptyState />
          ) : !visible.length ? (
            <LibraryNoResults onClearFilters={clearFilters} />
          ) : (
            <LibraryGrid
              items={visible}
              onLoad={handleLoad}
              onRemove={handleRemove}
            />
          )}
        </section>
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
