"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import {
  getActiveInstagramAccountId,
  getInstagramAccounts,
  INSTAGRAM_ACCOUNTS_CHANGED,
  setActiveInstagramAccountId,
} from "../../../lib/instagram-accounts.js";

const NAV_ITEMS = [
  { path: "/", label: "새 게시물" },
  { path: "/library", label: "마이페이지" },
];

const MY_PAGE_PATHS = ["/library", "/library/profile", "/research"];

function isActive(navPath, currentPath) {
  if (navPath === "/products-admin") return currentPath === navPath;
  if (currentPath === "/products-admin") return false;

  const isMyPage = MY_PAGE_PATHS.some(
    (path) => currentPath === path || currentPath.startsWith(`${path}/`),
  );
  return navPath === "/library" ? isMyPage : !isMyPage;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const [user, setUser] = useState(() => getUser());
  const [isStartingPost, setIsStartingPost] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [instagramAccounts, setInstagramAccounts] = useState([]);
  const [activeInstagramId, setActiveInstagramIdState] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuth((nextUser) => {
      setUser(nextUser);
      if (nextUser || isLoginPage) setIsSigningOut(false);
    });
    if (!isLoginPage) initAuth();
    return unsubscribe;
  }, [isLoginPage]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!user) { setInstagramAccounts([]); return undefined; }
    let cancelled = false;
    const loadAccounts = async () => {
      try {
        const accounts = await getInstagramAccounts();
        if (cancelled) return;
        setInstagramAccounts(accounts);
        const saved = getActiveInstagramAccountId();
        setActiveInstagramIdState(accounts.some((item) => item.instagram_user_id === saved) ? saved : '');
      } catch { if (!cancelled) setInstagramAccounts([]); }
    };
    loadAccounts();
    window.addEventListener(INSTAGRAM_ACCOUNTS_CHANGED, loadAccounts);
    return () => { cancelled = true; window.removeEventListener(INSTAGRAM_ACCOUNTS_CHANGED, loadAccounts); };
  }, [user?.id, pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const close = (event) => { if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [accountMenuOpen]);

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
    const canSave =
      Boolean(state.productId) && Boolean(String(state.topic || "").trim());

    try {
      if (getLibraryEditId() && canSave) {
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
  const activeInstagram = instagramAccounts.find((item) => item.instagram_user_id === activeInstagramId);
  const displayName = activeInstagram ? `@${activeInstagram.username}` : user?.name;

  function selectAccount(id) {
    setActiveInstagramAccountId(id);
    setActiveInstagramIdState(id);
    setAccountMenuOpen(false);
  }

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
              const active = isActive(item.path, pathname);
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
            <div className="relative flex items-center" ref={accountMenuRef}>
              <div className="flex items-center gap-[11px]">
                {activeInstagram?.profile_picture_url || user.avatar ? (
                  <img
                    src={activeInstagram?.profile_picture_url || user.avatar}
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
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  title={displayName}
                  className={`max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap font-normal leading-[21px] text-white transition-[font-size] duration-200 max-[560px]:hidden ${
                    isScrolled ? "text-[11px]" : "text-[16px]"
                  }`}
                >
                  {displayName} <span aria-hidden="true" className="ml-1 text-white/55">⌄</span>
                </button>
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
              {accountMenuOpen && (
                <div role="menu" className="absolute right-0 top-[calc(100%+12px)] z-50 w-[260px] overflow-hidden rounded-[14px] border border-white/15 bg-[#262626] p-2 text-white shadow-2xl">
                  <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">사용할 계정</p>
                  <button type="button" role="menuitemradio" aria-checked={!activeInstagramId} onClick={() => selectAccount('')} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left hover:bg-white/10">
                    <span className="flex size-8 items-center justify-center rounded-full bg-white text-[13px] font-bold text-black">{initial}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{user.name}</span>
                    {!activeInstagramId && <span className="text-[#4ade80]">✓</span>}
                  </button>
                  {instagramAccounts.map((account) => (
                    <button key={account.instagram_user_id} type="button" role="menuitemradio" aria-checked={activeInstagramId === account.instagram_user_id} onClick={() => selectAccount(account.instagram_user_id)} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left hover:bg-white/10">
                      {account.profile_picture_url ? <img src={account.profile_picture_url} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full object-cover" /> : <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-[12px] font-bold">{account.username.charAt(0).toUpperCase()}</span>}
                      <span className="min-w-0 flex-1 truncate text-[13px]">@{account.username}</span>
                      {activeInstagramId === account.instagram_user_id && <span className="text-[#4ade80]">✓</span>}
                    </button>
                  ))}
                  {!instagramAccounts.length && <Link href="/library/profile" onClick={() => setAccountMenuOpen(false)} className="block rounded-[10px] px-3 py-3 text-center text-[12px] font-semibold text-white/60 hover:bg-white/10 hover:text-white">Instagram 계정 연결하기</Link>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
