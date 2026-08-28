"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import logo from "../../../assets/logos/logo.svg";
import {
  getUser,
  initAuth,
  onAuth,
  signOut,
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

const MY_PAGE_PATHS = ["/library", "/library/profile", "/research"];

function isActive(navPath, currentPath, libraryEditId) {
  if (navPath === "/products-admin") return currentPath === navPath;
  if (currentPath === "/products-admin") return false;

  const isMyPage =
    MY_PAGE_PATHS.includes(currentPath) || Boolean(libraryEditId);
  return navPath === "/library" ? isMyPage : !isMyPage;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const [user, setUser] = useState(() => getUser());
  const [isStartingPost, setIsStartingPost] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [libraryEditId, setLibraryEditId] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    setLibraryEditId(getLibraryEditId());
    const unsubscribe = onAuth(setUser);
    if (!isLoginPage) initAuth();
    return unsubscribe;
  }, [isLoginPage]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
          toast(
            `저장하지 못해 새 게시물로 이동하지 않았습니다. ${saved.error}`,
            6000,
          );
          return;
        }
      }

      clearLibraryEdit();
      setLibraryEditId(null);
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

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast(error?.message || "로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setIsSigningOut(false);
    }
  }

  const initial = (user?.name || "?").trim().charAt(0);

  if (isLoginPage) return null;

  return (
    <header className="pointer-events-none sticky top-0 z-40 h-[100px]">
      <div
        className={`pointer-events-auto flex max-w-none items-center gap-6 bg-[#1a1a1a] px-[clamp(20px,3.93vw,76px)] transition-[height] duration-200 max-[560px]:gap-[10px] [&>*]:max-[560px]:min-w-0 ${
          isScrolled ? "h-[60px]" : "h-[100px]"
        }`}
      >
        <Link
          href="/"
          onClick={startNewPost}
          aria-label="브랜드 SNS 스튜디오 홈으로 이동"
          className="inline-flex items-center hover:no-underline max-[560px]:hidden"
        >
          <img
            src={logo.src}
            alt=""
            className={`block w-auto transition-[height] duration-200 ${
              isScrolled ? "h-[15px]" : "h-5"
            }`}
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
                  className={`whitespace-nowrap rounded-full border font-bold leading-[22.4px] transition-[background-color,border-color,font-size] duration-200 max-[640px]:px-[10px] max-[640px]:py-2 max-[640px]:text-[13px] ${
                    isScrolled
                      ? "text-[11px] px-4 py-[5px]"
                      : "px-5 py-[9px] text-[16px]"
                  } ${
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
                  title={user.name}
                  className={`max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap font-normal leading-[21px] text-white transition-[font-size] duration-200 max-[560px]:hidden ${
                    isScrolled ? "text-[11px]" : "text-[16px]"
                  }`}
                >
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className={`shrink-0 whitespace-nowrap rounded-full border border-white/70 font-bold text-white transition-[background-color,font-size,opacity] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 ${
                    isScrolled
                      ? "px-3 py-[5px] text-[11px]"
                      : "px-4 py-[8px] text-[14px]"
                  }`}
                >
                  {isSigningOut ? "로그아웃 중..." : "로그아웃"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
