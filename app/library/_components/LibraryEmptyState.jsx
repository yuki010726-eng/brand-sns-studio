import Link from "next/link";
import { Icon } from "../../_components/Icon.jsx";

/** 보관함에 저장한 게시물이 아예 없을 때 (검색·필터 결과가 없을 때는 LibraryNoResults). */
export function LibraryEmptyState() {
  return (
    <div className="rounded-[15px] border border-[#e5e8eb] bg-white px-6 py-14 text-center">
      <Icon name="archive" className="mx-auto mb-3 size-9 text-[#8b95a1]" />
      <h3 className="text-[18px] font-bold text-[#191f28]">
        아직 보관한 게시물이 없습니다
      </h3>
      <p className="mx-auto mt-2 max-w-[360px] text-[14px] leading-[1.6] text-[#5f6b7a]">
        AI 글이 생성되면 자동으로 저장되고, 카드뉴스 편집 내용도 주기적으로
        반영됩니다.
      </p>
      <Link
        href="/"
        aria-label="새 게시물 만들기 화면으로 이동"
        className="mt-6 inline-flex items-center justify-center rounded-full bg-[#287aff] px-6 py-3 text-[15px] font-bold text-white transition hover:bg-[#1b64da]"
      >
        새 게시물 만들기
      </Link>
    </div>
  );
}
