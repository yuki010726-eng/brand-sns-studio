"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon.jsx";

function ProductSelect({ loading, products, selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = products.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={loading || !products.length}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex min-h-[50px] w-full items-center justify-between gap-3 rounded-[12px] border bg-white px-4 py-3 text-left text-[15px] outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${open ? "border-[#3182f6] shadow-[0_0_0_3px_rgba(49,130,246,0.18)]" : "border-[#e5e8eb] hover:border-[#cdd3d9]"}`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selected && (
            <Icon
              name={selected.icon}
              className="size-5 shrink-0 text-[#287aff]"
            />
          )}
          <span
            className={
              selected
                ? "truncate font-medium text-[#333d4b]"
                : "text-[#5f6b7a]"
            }
          >
            {loading
              ? "상품을 불러오는 중입니다."
              : selected?.name || "상품을 선택해 주세요."}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`mr-1 size-2.5 shrink-0 border-b-2 border-r-2 border-[#6b7684] transition-transform ${open ? "translate-y-0.5 rotate-[225deg]" : "-translate-y-0.5 rotate-45"}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="상품 선택"
          className="absolute left-0 top-[calc(100%+8px)] z-30 max-h-[260px] w-full overflow-y-auto rounded-[14px] border border-[#e5e8eb] bg-white p-1.5 shadow-[0_14px_35px_rgba(0,30,78,0.16)]"
        >
          {products.map((item) => {
            const active = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-[10px] px-3.5 py-3 text-left transition ${active ? "bg-[#e8f2fe] text-[#1b64da]" : "text-[#333d4b] hover:bg-[#f2f4f6]"}`}
              >
                <Icon name={item.icon} className="size-5 shrink-0" />
                <strong className="min-w-0 flex-1 truncate text-[14px]">
                  {item.name}
                </strong>
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full border ${active ? "border-[#3182f6] bg-[#3182f6] text-white" : "border-[#d1d6db] text-transparent"}`}
                >
                  <Icon name="check" className="size-3 stroke-[2.5]" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProductSection({
  loading,
  products,
  selectedId,
  onSelect,
  expanded = true,
  onProceed,
}) {
  const product = products.find((item) => item.id === selectedId) || null;
  return (
    <section className="flex flex-col" aria-labelledby="product-heading">
      <div className="flex items-baseline gap-6 max-[860px]:flex-col max-[860px]:items-start max-[860px]:gap-1.5">
        {expanded ? (
          <div className="grid grid-cols-[422px_minmax(0,1fr)] items-stretch max-[1024px]:grid-cols-1">
            {loading ? (
              <p className="m-auto text-[14px] text-[#5f6b7a]">
                상품을 불러오는 중입니다.
              </p>
            ) : products.length ? (
              <ProductSelect
                loading={loading}
                products={products}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ) : (
              <p className="m-auto text-[14px] text-[#5f6b7a]">
                등록된 상품이 없습니다.
              </p>
            )}
          </div>
        ) : (
          <div className="flex min-h-[66px] items-center gap-3 rounded-[15px] bg-white/10 px-6 py-4">
            <Icon
              name={product?.icon || "award"}
              className="size-5 shrink-0 text-white/70"
            />
            <span className="text-[15px] font-bold text-white">
              {product ? product.name : "상품을 선택해 주세요."}
            </span>
          </div>
        )}
        {onProceed && (
          <button
            type="button"
            onClick={onProceed}
            className="ml-auto inline-flex h-[38px] shrink-0 items-center gap-[5px] rounded-full border border-white/20 bg-white/10 px-4 text-[14px] font-medium text-white transition hover:bg-white/20"
          >
            <Icon
              name="chevronDown"
              className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            접기
          </button>
        )}
      </div>
    </section>
  );
}
