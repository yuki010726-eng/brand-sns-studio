"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUser, initAuth, onAuth } from '../../lib/auth.js';

export function AuthGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/');
  const isPublicRoute = isLoginRoute || pathname === '/privacy' || pathname.startsWith('/privacy/');
  const [user, setUser] = useState(() => getUser());
  const [ready, setReady] = useState(isPublicRoute);

  useEffect(() => {
    if (isPublicRoute) { setReady(true); return; }
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
