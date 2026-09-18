"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONTENT_MODE, textPath } from "../../lib/contentRoutes.js";

const TABS = [
  { mode: CONTENT_MODE.TEXT_IMAGE, label: "글 + 이미지" },
  { mode: CONTENT_MODE.IMAGE, label: "이미지" },
];

export function ContentsTab() {
  const pathname = usePathname();
  const mode = pathname.endsWith(`/${CONTENT_MODE.IMAGE}`)
    ? CONTENT_MODE.IMAGE
    : CONTENT_MODE.TEXT_IMAGE;

  return (
    <nav
      className="flex items-center gap-1 rounded-full bg-white/10 p-1 w-max"
      aria-label="게시물 만들기 방식"
    >
      {TABS.map((tab) => {
        const active = tab.mode === mode;
        return (
          <Link
            key={tab.mode}
            href={textPath(tab.mode)}
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
