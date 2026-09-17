"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { path: "/text?edit=1", label: "글 + 이미지" },
  { path: "/text?edit=2", label: "이미지" },
];

/** 새 게시물 작성 방식 전환 탭. 탭을 바꿔도 현재 작업 상태는 유지한다. */
export function ContentsTab() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav
      className="flex items-center gap-1 rounded-full bg-white/10 p-1 w-max"
      aria-label="게시물 만들기 방식"
    >
      {TABS.map((tab) => {
        // 미리보기 화면도 어느 작성 흐름에서 왔는지 그대로 표시한다.
        const mode =
          pathname === "/template"
            ? searchParams.get("preview") || "1"
            : searchParams.get("edit") || "1";
        const active = tab.path === `/text?edit=${mode}`;
        const href = tab.path;
        return (
          <Link
            key={tab.path}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${
              active
                ? "bg-white text-[#191f28]"
                : "text-white/65 hover:bg-white/10 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
