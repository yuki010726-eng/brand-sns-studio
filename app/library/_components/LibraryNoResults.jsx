import { Icon } from "../../_components/Icon.jsx";

/** 검색어·상품 필터에 걸리는 게시물이 없을 때 (게시물이 아예 없을 때는 LibraryEmptyState). */
export function LibraryNoResults({ onClearFilters }) {
  return (
    <div className="rounded-[15px] border border-[#e5e8eb] bg-white px-6 py-14 text-center">
      <Icon name="search" className="mx-auto mb-3 size-9 text-[#8b95a1]" />
      <h3 className="text-[18px] font-bold text-[#191f28]">
        찾는 게시물이 없습니다
      </h3>
      <p className="mt-2 text-[14px] text-[#5f6b7a]">
        검색어나 상품 조건을 바꿔 보세요.
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        aria-label="검색과 필터 초기화"
        className="mt-6 inline-flex items-center justify-center rounded-full border border-[#e5e8eb] bg-white px-6 py-3 text-[15px] font-bold text-[#333d4b] transition hover:bg-[#f2f4f6]"
      >
        조건 지우기
      </button>
    </div>
  );
}
