export function TextPageHeader({ children }) {
  return (
    <header className="flex items-end gap-[14px] mb-8">
      <h1 className="text-[28px] font-bold tracking-[-0.04em] text-white">
        {/* 상품의 글을 생성해보세요. */}
        {children}
      </h1>
    </header>
  );
}
