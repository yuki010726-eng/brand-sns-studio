"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../../_components/Icon.jsx";

const ITEMS = [
  { path: "/library/profile", label: "프로필", icon: "user" },
  { path: "/research", label: "글 스타일", icon: "edit" },
  { path: "/library", label: "저장한 게시물", icon: "archive" },
];

export function MyPageSidebar() {
  const pathname = usePathname();

  return (
    <aside className="min-w-[174px] rounded-[15px] bg-white/10 px-[9px] py-2 max-[860px]:w-full">
      <p className="px-5 pb-5 pt-2 text-center text-[18px] font-bold leading-[22.4px] text-white">마이페이지</p>
      <nav className="flex flex-col gap-1 max-[860px]:flex-row max-[860px]:overflow-x-auto" aria-label="마이페이지 메뉴">
        {ITEMS.map((item) => {
          const active = item.path === "/library"
            ? pathname === "/library"
            : pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              href={item.path}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center gap-3 whitespace-nowrap rounded-full px-3 py-2 text-[14px] transition-colors ${active ? "bg-[#1a1a1a] font-bold text-white" : "font-medium text-white/55 hover:bg-white/10 hover:text-white"}`}
            >
              <span className={`grid size-6 shrink-0 place-items-center rounded-full ${active ? "bg-white text-[#1a1a1a]" : "bg-white/15 text-white/70"}`}>
                <Icon name={item.icon} className="size-[14px]" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
