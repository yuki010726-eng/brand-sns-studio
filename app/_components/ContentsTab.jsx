"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { path: "/text", label: "글 + 이미지" },
  { path: "/template", label: "이미지" },
];

/** 새 게시물 작성 방식 전환 탭. 탭을 바꿔도 현재 작업 상태는 유지한다. */
export function ContentsTab() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-1 rounded-full bg-white/10 p-1 w-max"
      aria-label="게시물 만들기 방식"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.path;
        // 이미지 작업 화면에서 글+이미지로 돌아올 때는 기존 조건을 바로
        // 수정할 수 있도록 주제 설정 패널을 연다.
        const href =
          pathname === "/template" && tab.path === "/text"
            ? "/text?edit=1"
            : tab.path;
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
