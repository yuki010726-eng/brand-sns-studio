"use client";

/**
 * 상품 관리 탭 — 옛 pages/products-admin.js 를 Next.js/React 로 옮겼다.
 * 관리자만 쓰는 화면이다: 블로그·카페 링크를 읽어 기존 상품 근거(product_proofs)에
 * 없는 내용만 골라 보여주고, 고른 것만 Supabase 에 반영한다.
 *
 * ⚠️ `app/_components/layout/Header.jsx` 의 `NAV_ITEMS`/`isActive` 가 이미 `/products-admin` 을
 *    관리자 전용 탭으로 다루고 있다 — 경로를 바꾸면 그쪽도 같이 고쳐야 한다.
 * ⚠️ 여기서는 미리보기 단계에서 어떤 문장을 "새 내용"으로 볼지만 판단한다(`_lib/factExtract.js`).
 *    실제 저장은 `/api/admin/product-update` 가 한다 — 클라이언트가 고른 문장을 그대로 믿지 않고
 *    서버가 원문을 다시 읽어 검증한 뒤 저장한다(옛 서버 로직 그대로).
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { accessToken, getUser, onAuth } from "../../lib/auth.js";
import { getProduct, loadProducts, reloadProducts } from "../../lib/products.js";
import { toast } from "../../components/toast.js";
import { LoadingScreen } from "../_components/LoadingScreen.jsx";
import { extractPreviewItems } from "./_lib/factExtract.js";

const INPUT_CLASS =
  "w-full rounded-[12px] border border-[#e5e8eb] bg-white px-4 py-[13px] text-[15px] text-[#4e5968] outline-none transition hover:border-[#cdd3d9] focus:border-[#3182f6] focus:shadow-[0_0_0_3px_rgba(49,130,246,0.18)] placeholder:text-[#5f6b7a]";
const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#287aff] px-7 py-3.5 text-[16px] font-bold text-white transition hover:bg-[#1b64da] disabled:cursor-not-allowed disabled:bg-[#e5e8eb] disabled:text-[#4e5968]";

async function callUpdateApi(body) {
  const token = await accessToken();
  const response = await fetch("/api/admin/product-update", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `요청에 실패했습니다 (${response.status}).`);
  return data;
}

export default function ProductsAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(() => getUser());
  const [products, setProducts] = useState([]);
  const [productsReady, setProductsReady] = useState(false);
  const [productId, setProductId] = useState("");
  const [sourceUrls, setSourceUrls] = useState("");
  const [status, setStatus] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | previewing | applying
  const [items, setItems] = useState(null);
  const [selection, setSelection] = useState({}); // url -> boolean[]
  const [savedView, setSavedView] = useState(false);

  useEffect(() => onAuth(setUser), []);

  useEffect(() => {
    let cancelled = false;
    loadProducts()
      .then((list) => {
        if (!cancelled) setProducts([...list]);
      })
      .catch(() => toast("상품 정보를 불러오지 못했습니다."))
      .finally(() => {
        if (!cancelled) setProductsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/");
  }, [user, router]);

  const newCount = useMemo(() => {
    if (!items) return 0;
    return items.reduce((sum, item) => {
      if (item.error) return sum;
      const picks = selection[item.url];
      const content = item.newContent || [];
      return sum + content.filter((_, index) => (picks ? picks[index] : true)).length;
    }, 0);
  }, [items, selection]);

  if (!user || user.role !== "admin" || !productsReady) return <LoadingScreen />;

  const busy = phase !== "idle";

  function requestValues() {
    return {
      productId,
      urls: sourceUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
    };
  }

  function selectedSources() {
    const map = new Map();
    (items || []).forEach((item) => {
      if (item.error) return;
      const picks = selection[item.url] || [];
      const content = (item.newContent || []).filter((_, index) => picks[index]);
      if (content.length) map.set(item.url, content);
    });
    return [...map].map(([url, content]) => ({ url, content }));
  }

  async function handlePreview(event) {
    event.preventDefault();
    if (busy) return;
    const request = requestValues();
    if (!request.productId) {
      toast("확인할 상품을 선택해 주세요.");
      return;
    }
    if (!request.urls.length) {
      toast("확인할 블로그·카페 링크를 입력해 주세요.");
      return;
    }

    setPhase("previewing");
    setSavedView(false);
    setItems(null);
    setStatus("링크의 본문을 읽고 기존 상품 자료와 비교하고 있습니다. 아직 저장하지 않습니다.");
    try {
      const data = await callUpdateApi({ ...request, action: "preview" });
      setStatus("원문에서 상품 자료로 쓸 핵심 내용만 뽑아 정리하고 있습니다.");
      const preview = extractPreviewItems(data.items || [], getProduct(request.productId));
      const nextSelection = {};
      preview.forEach((item) => {
        if (!item.error) nextSelection[item.url] = item.newContent.map(() => true);
      });
      const found = preview.reduce((sum, item) => sum + (item.newContent?.length || 0), 0);
      setSelection(nextSelection);
      setItems(preview);
      setStatus(
        found
          ? `새 내용 ${found.toLocaleString("ko-KR")}개를 찾았습니다. 아래 목록을 확인한 뒤 반영해 주세요.`
          : "새로 추가할 내용이 없습니다. Supabase는 변경되지 않았습니다.",
      );
    } catch (error) {
      setStatus(error.message || "내용을 확인하지 못했습니다.");
    } finally {
      setPhase("idle");
    }
  }

  function toggleContent(url, index) {
    setSelection((prev) => {
      const current = [...(prev[url] || [])];
      current[index] = !current[index];
      return { ...prev, [url]: current };
    });
  }

  async function handleApply() {
    if (busy || !items) return;
    const sources = selectedSources();
    if (!sources.length) {
      toast("반영할 내용을 선택해 주세요.");
      return;
    }
    setPhase("applying");
    setStatus("원문을 다시 확인한 뒤 Supabase에 반영하고 있습니다.");
    try {
      const data = await callUpdateApi({ ...requestValues(), action: "apply", sources });
      const list = await reloadProducts();
      setProducts([...list]);
      setItems(data.items || []);
      setSavedView(true);
      setStatus(`${data.updated}개 링크의 내용을 상품 자료에 반영했습니다.`);
      toast("상품 자료를 업데이트했습니다.");
    } catch (error) {
      setStatus(error.message || "상품 자료에 반영하지 못했습니다.");
    } finally {
      setPhase("idle");
    }
  }

  return (
    <main className="min-h-dvh bg-[#1a1a1a] pb-[170px] pt-0 text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <div className="overflow-hidden rounded-[15px] bg-white/10 px-[39px] pb-20 pt-[61px] max-[860px]:px-6 max-[860px]:pb-[54px] max-[860px]:pt-[34px]">
          <header className="mb-8 max-w-[720px]">
            <h1 className="text-[32px] font-bold tracking-[-0.04em] text-white">상품 관리</h1>
            <p className="mt-2 text-white/55">
              블로그·카페에서 새로 확인된 내용을 검토한 뒤 상품 자료에 반영합니다.
            </p>
          </header>

          <section className="max-w-[720px] rounded-[15px] bg-white p-8 max-[640px]:p-5" aria-labelledby="product-source-title">
            <h2 id="product-source-title" className="text-[19px] font-bold text-[#191f28]">
              상품 자료 확인
            </h2>
            <p className="mt-1.5 text-[14px] text-[#6b7684]">
              링크를 읽어 기존 상품 근거에 없는 내용만 먼저 보여드립니다. 확인 단계에서는 Supabase에 저장하지 않습니다.
            </p>

            <form className="mt-6 flex flex-col gap-5" onSubmit={handlePreview}>
              <label className="flex flex-col gap-2">
                <span className="text-[14px] font-bold text-[#333d4b]">확인할 상품</span>
                <select
                  className={INPUT_CLASS}
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  disabled={busy}
                >
                  <option value="">상품 선택</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[14px] font-bold text-[#333d4b]">블로그·카페 링크</span>
                <textarea
                  className={INPUT_CLASS}
                  rows={7}
                  value={sourceUrls}
                  onChange={(event) => setSourceUrls(event.target.value)}
                  placeholder={"https://blog.naver.com/...\nhttps://cafe.naver.com/..."}
                  disabled={busy}
                />
                <span className="text-[13px] text-[#8b95a1]">네이버 공개 글만 가능하며 한 번에 최대 10개까지 확인합니다.</span>
              </label>

              <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
                {phase === "previewing" ? "확인하는 중…" : "새 내용 확인"}
              </button>
            </form>

            {status ? (
              <p role="status" aria-live="polite" className="mt-4 text-[14px] font-medium text-[#4e5968]">
                {status}
              </p>
            ) : null}

            {items ? (
              <div className="mt-6 border-t border-[#e5e8eb] pt-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[16px] font-bold text-[#191f28]">
                    {savedView ? "반영된 내용" : "새로 확인된 내용"}
                  </h3>
                  {!savedView ? (
                    <span className="text-[13px] font-semibold text-[#4e5968]">
                      {newCount.toLocaleString("ko-KR")}개 선택
                    </span>
                  ) : null}
                </div>

                <ul className="mt-4 flex flex-col gap-4">
                  {items.map((item) => {
                    if (item.error) {
                      return (
                        <li key={item.url} className="rounded-[12px] border border-[#f6c6c6] bg-[#fff5f5] p-4">
                          <strong className="block text-[14px] font-bold text-[#c53030]">
                            {item.title || item.url}
                          </strong>
                          <span className="mt-1 block text-[13px] text-[#c53030]">{item.error}</span>
                        </li>
                      );
                    }
                    const picks = selection[item.url] || [];
                    return (
                      <li key={item.url} className="rounded-[12px] border border-[#e5e8eb] p-4">
                        <strong className="block text-[14px] font-bold text-[#191f28]">
                          {item.title || item.url}
                        </strong>
                        <span className="mt-1 block text-[13px] text-[#8b95a1]">
                          {item.type === "cafe" ? "카페" : "블로그"} ·{" "}
                          {savedView
                            ? `${Number(item.chars || 0).toLocaleString("ko-KR")}자 저장`
                            : `새 내용 ${(item.newContent || []).length.toLocaleString("ko-KR")}개`}
                        </span>
                        {!savedView && (item.newContent || []).length ? (
                          <ul className="mt-3 flex flex-col gap-2">
                            {item.newContent.map((line, index) => {
                              const checked = !!picks[index];
                              return (
                                <li key={`${item.url}-${index}`}>
                                  <label
                                    className={`flex cursor-pointer items-start gap-2.5 rounded-[12px] border px-4 py-3 text-[14px] leading-6 transition hover:border-[#d5dae0] ${
                                      checked ? "border-[#1b64da] bg-[#e8f2fe]" : "border-[#e5e8eb]"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-1 size-4 shrink-0 accent-[#1b64da]"
                                      checked={checked}
                                      onChange={() => toggleContent(item.url, index)}
                                    />
                                    <span className="text-[#191f28]">{line}</span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        ) : !savedView ? (
                          <p className="mt-3 text-[13px] text-[#8b95a1]">기존 자료와 비교해 새로 추가할 내용이 없습니다.</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {!savedView && newCount > 0 ? (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#e5e8eb] pt-6">
                    <p className="text-[13px] text-[#8b95a1]">체크한 내용만 source_content에 저장됩니다.</p>
                    <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={handleApply}>
                      {phase === "applying" ? "반영하는 중…" : "선택한 내용 반영"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
      <div id="toast-root" className="toast-root" role="status" aria-live="polite" />
    </main>
  );
}
