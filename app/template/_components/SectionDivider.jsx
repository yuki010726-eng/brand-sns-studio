/**
 * 오른쪽 「디테일 수정」 패널의 섹션 구분선 — 굵은 제목(+짧은 설명은 옆에) + 아래 테두리.
 * 「문구」·「강조 색상」 등 패널 안 모든 편집 항목이 이 머리글을 공유한다.
 * 피그마: https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=72-1399
 */
export function SectionDivider({ title, description }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-[#e5e8eb] pb-[9px]">
      <h3 className="text-[15px] font-bold tracking-[0.26px] text-black">{title}</h3>
      {description && <p className="text-[13px] text-[#5f6b7a]">{description}</p>}
    </div>
  );
}
