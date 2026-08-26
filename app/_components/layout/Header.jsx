"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import logo from "../../../assets/logos/logo.svg";
import {
  getUser,
  initAuth,
  onAuth,
  usernameOf,
} from "../../../lib/auth.js";
import {
  clearLibraryEdit,
  getLibraryEditId,
  saveToLibrary,
} from "../../../lib/librarystore.js";
import { getState, resetFlow } from "../../../store.js";
import { toast } from "../../../components/toast.js";

const NAV_ITEMS = [
  { path: "/", label: "새 게시물" },
  { path: "/library", label: "마이페이지" },
];

const MY_PAGE_PATHS = ["/library", "/profile", "/research"];

function isActive(navPath, currentPath, libraryEditId) {
  if (navPath === "/products-admin") return currentPath === navPath;
  if (currentPath === "/products-admin") return false;

  const isMyPage = MY_PAGE_PATHS.includes(currentPath) || Boolean(libraryEditId);
  return navPath === "/library" ? isMyPage : !isMyPage;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const [user, setUser] = useState(() => getUser());
  const [isStartingPost, setIsStartingPost] = useState(false);
  const [libraryEditId, setLibraryEditId] = useState(null);

  useEffect(() => {
    setLibraryEditId(getLibraryEditId());
    const unsubscribe = onAuth(setUser);
    if (!isLoginPage) initAuth();
    return unsubscribe;
  }, [isLoginPage]);

  const navItems =
    user?.role === "admin"
      ? [...NAV_ITEMS, { path: "/products-admin", label: "상품 관리" }]
      : NAV_ITEMS;

  async function startNewPost(event) {
    event.preventDefault();
    if (isStartingPost) return;
    setIsStartingPost(true);

    const state = getState();
    const started =
      Boolean(state.productId) || Boolean(String(state.topic || "").trim());

    try {
      if (getLibraryEditId()) {
        const saved = await saveToLibrary(state);
        if (!saved.ok) {
          toast(`저장하지 못해 새 게시물로 이동하지 않았습니다. ${saved.error}`, 6000);
          return;
        }
      }

      clearLibraryEdit();
      resetFlow();
      router.push("/");
      router.refresh();

      if (started) {
        toast("현재 작성 내용을 저장하고 새 게시물을 시작합니다.");
      }
    } finally {
      setIsStartingPost(false);
    }
  }

  const initial = (user?.name || "?").trim().charAt(0);

  if (isLoginPage) return null;

  return (
    <header className="sticky top-0 z-40 bg-[#1a1a1a]">
      <div className="flex h-[100px] max-w-none items-center gap-6 px-[clamp(20px,3.93vw,76px)] max-[560px]:gap-[10px] [&>*]:max-[560px]:min-w-0">
        <Link
          href="/"
          onClick={startNewPost}
          aria-label="브랜드 SNS 스튜디오 홈으로 이동"
          className="inline-flex items-center hover:no-underline max-[560px]:hidden"
        >
          <img
            src={logo.src}
            alt=""
            className="block h-5 w-auto"
          />
        </Link>

        <div className="ml-auto flex items-center gap-[10px] max-[560px]:min-w-0 max-[560px]:gap-2">
          <nav className="flex items-center gap-2" aria-label="주요 메뉴">
            {navItems.map((item) => {
              const active = isActive(item.path, pathname, libraryEditId);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={item.path === "/" ? startNewPost : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-full border px-5 py-[9px] text-[16px] font-bold leading-[22.4px] transition-[background-color,border-color] duration-150 max-[640px]:px-[10px] max-[640px]:py-2 max-[640px]:text-[13px] ${
                    active
                      ? "border-transparent bg-[#f2f4f6] text-[#191f28] hover:bg-[#e8ebed]"
                      : "border-white/90 bg-transparent text-white hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {user && (
            <div className="flex items-center">
              <div className="flex items-center gap-[11px]">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 shrink-0 rounded-full bg-[#f2f4f6] object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-bold text-[#1a1a1a]"
                  >
                    {initial}
                  </span>
                )}
                <span
                  title={usernameOf(user.email)}
                  className="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-normal leading-[21px] text-white max-[560px]:hidden"
                >
                  {user.name}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
