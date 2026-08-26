"use client";

import { PRODUCTS } from "../../../lib/products.js";
import { Icon } from "../../_components/Icon.jsx";
import { FilterChip } from "./FilterChip.jsx";

const SORTS = [
  { id: "recent", label: "최근 저장순" },
  { id: "oldest", label: "오래된순" },
  { id: "title", label: "주제 이름순" },
];

/** 검색·정렬·상품 필터 — 값은 부모(page.jsx)가 들고 있는 화면 전용 상태다. 스토어에 넣지 않는다. */
export function LibraryToolbar({
  items,
  query,
  sort,
  productFilter,
  onQueryChange,
  onSortChange,
  onFilterChange,
}) {
  const counts = { all: items.length };
  for (const product of PRODUCTS) {
    counts[product.id] = items.filter((it) => it.productId === product.id).length;
  }

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">보관함 검색</span>
          <Icon
            name="search"
            className="pointer-events-none absolute left-[14px] top-1/2 size-[18px] -translate-y-1/2 text-[#8b95a1]"
          />
          <input
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="주제나 글 내용으로 검색"
            className="w-full rounded-full border border-[#e5e8eb] bg-white py-[13px] pl-11 pr-4 text-[15px] text-[#4e5968] outline-none transition hover:border-[#cdd3d9] focus:border-[#3182f6] focus:shadow-[0_0_0_3px_rgba(49,130,246,0.18)] placeholder:text-[#5f6b7a]"
          />
        </label>
        <label className="relative">
          <span className="sr-only">정렬 기준</span>
          <Icon
            name="sort"
            className="pointer-events-none absolute left-[14px] top-1/2 size-[18px] -translate-y-1/2 text-[#8b95a1]"
          />
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
            aria-label="정렬 기준"
            className="appearance-none rounded-full border border-[#e5e8eb] bg-white py-[13px] pl-11 pr-9 text-[15px] text-[#4e5968] outline-none transition hover:border-[#cdd3d9] focus:border-[#3182f6]"
          >
            {SORTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label="상품으로 거르기"
      >
        <FilterChip
          id="all"
          label="전체"
          count={counts.all}
          active={productFilter === "all"}
          onSelect={onFilterChange}
        />
        {PRODUCTS.map((product) => (
          <FilterChip
            key={product.id}
            id={product.id}
            label={product.short}
            count={counts[product.id]}
            active={productFilter === product.id}
            onSelect={onFilterChange}
          />
        ))}
      </div>
    </div>
  );
}
