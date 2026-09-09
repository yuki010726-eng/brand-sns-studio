"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCachedUser, getUser, initAuth, onAuth } from '../../lib/auth.js';

export function AuthGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/');
  const isPublicRoute = isLoginRoute || pathname === '/privacy' || pathname.startsWith('/privacy/');
  // ⚠️ 초기값은 서버 렌더링과 반드시 같아야 한다 — 여기서 sessionStorage 를 바로 읽으면
  // 서버는 스피너를, 클라이언트 첫 렌더는 캐시된 화면을 그려 하이드레이션이 어긋난다.
  // 그래서 캐시는 아래 effect(마운트 이후, 클라이언트에서만) 에서 적용한다.
  const [user, setUser] = useState(() => getUser());
  const [ready, setReady] = useState(isPublicRoute);

  useEffect(() => {
    if (isPublicRoute) { setReady(true); return; }
    // 새로고침 직후엔 getUser() 가 비어 있다(메모리 상태라 매번 리셋된다).
    // 직전에 승인 확인된 적이 있으면 그 값으로 먼저 그리고, initAuth() 는 그대로
    // 백그라운드에서 다시 물어 확인한다 — 다르면(예: 승인 취소) 아래 effect 가 로그인으로 보낸다.
    const cached = getCachedUser();
    if (cached) { setUser(cached); setReady(true); }
    const unsubscribe = onAuth(setUser);
    initAuth().finally(() => setReady(true));
    return unsubscribe;
  }, [isPublicRoute]);

  useEffect(() => {
    if (!isPublicRoute && ready && user?.status !== 'approved') router.replace('/login');
  }, [isPublicRoute, ready, router, user]);

  if (isPublicRoute) return children;
  if (!ready || user?.status !== 'approved') {
    return <main className="flex min-h-dvh items-center justify-center bg-[#1a1a1a] text-white">계정 상태를 확인하고 있습니다.</main>;
  }
  return children;
}
