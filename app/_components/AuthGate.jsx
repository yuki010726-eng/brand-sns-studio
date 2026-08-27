"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUser, initAuth, onAuth } from '../../lib/auth.js';

export function AuthGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/');
  const [user, setUser] = useState(() => getUser());
  const [ready, setReady] = useState(isLoginRoute);

  useEffect(() => {
    if (isLoginRoute) { setReady(true); return; }
    const unsubscribe = onAuth(setUser);
    initAuth().finally(() => setReady(true));
    return unsubscribe;
  }, [isLoginRoute]);

  useEffect(() => {
    if (!isLoginRoute && ready && user?.status !== 'approved') router.replace('/login');
  }, [isLoginRoute, ready, router, user]);

  if (isLoginRoute) return children;
  if (!ready || user?.status !== 'approved') {
    return <main className="flex min-h-dvh items-center justify-center bg-[#1a1a1a] text-white">계정 상태를 확인하고 있습니다.</main>;
  }
  return children;
}
