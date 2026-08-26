import { LibraryItemCard } from "./LibraryItemCard.jsx";

export function LibraryGrid({ items, onLoad, onRemove }) {
  return (
    <>
      <p className="mb-3 text-[14px] text-[#8b95a1]" role="status">
        {items.length}개 게시물
      </p>
      <ul className="grid grid-cols-3 gap-4 max-[1024px]:grid-cols-2 max-[560px]:grid-cols-1">
        {items.map((item) => (
          <LibraryItemCard
            key={item.id}
            item={item}
            onLoad={onLoad}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </>
  );
}
