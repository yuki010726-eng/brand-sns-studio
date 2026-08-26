import { ProductDetail } from "./ProductDetail.jsx";
import { ProductOption } from "./ProductOption.jsx";

export function ProductSection({ loading, products, selectedId, onSelect }) {
  const product = products.find((item) => item.id === selectedId) || null;
  return (
    <section className="flex flex-col gap-7" aria-labelledby="product-heading">
      <div className="flex items-baseline gap-6 max-[860px]:flex-col max-[860px]:items-start max-[860px]:gap-1.5">
        <h1
          id="product-heading"
          className="text-[25px] font-bold leading-[1.35] text-white max-sm:text-[22px]"
        >
          1. 제작할 게시물의 상품을 선택해 주세요.
        </h1>
        <p className="text-[15px] text-[#8e8e8e]">
          기준 정보는 사내 브랜드 자료(2026-07-23 기준)를 따릅니다.
        </p>
      </div>
      <div className="grid grid-cols-[422px_minmax(0,1fr)] items-stretch max-[1024px]:grid-cols-1">
        <div className="relative z-10 flex min-h-[337px] flex-col gap-3.5 rounded-[15px] bg-white px-[18px] py-6 shadow-[8px_0_20px_rgba(0,0,0,0.18)] max-[1024px]:max-h-[360px] max-[1024px]:rounded-b-none max-[1024px]:shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
          <h2 className="pl-2.5 text-left text-[18px] font-bold text-[#191f28]">
            상품 리스트
          </h2>
          <div className="h-px w-full bg-[#e5e8eb]" />
          {loading ? (
            <p className="m-auto text-[14px] text-[#5f6b7a]">
              상품을 불러오는 중입니다.
            </p>
          ) : products.length ? (
            <fieldset className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto border-0 pr-2 [scrollbar-color:#050505_#f2f2f2]">
              <legend className="sr-only">광고할 상품을 선택하세요</legend>
              {products.map((item) => (
                <ProductOption
                  key={item.id}
                  product={item}
                  checked={item.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </fieldset>
          ) : (
            <p className="m-auto text-[14px] text-[#5f6b7a]">
              등록된 상품이 없습니다.
            </p>
          )}
        </div>
        <ProductDetail product={product} />
      </div>
    </section>
  );
}
