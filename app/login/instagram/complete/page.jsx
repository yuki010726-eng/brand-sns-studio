"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClient } from '../../../../lib/supabase.js';
import { initAuth } from '../../../../lib/auth.js';
import { clearLibraryEdit } from '../../../../lib/librarystore.js';
import { resetFlow } from '../../../../store.js';

export default function InstagramLoginCompletePage() {
  const router = useRouter();
  const [message, setMessage] = useState('Instagram 계정을 연결하고 있습니다.');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tokenHash = new URLSearchParams(window.location.search).get('token_hash');
        if (!tokenHash) throw new Error('로그인 확인 토큰이 없습니다.');
        const sb = await getClient();
        const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
        if (error) throw error;
        const user = await initAuth();
        if (cancelled) return;
        if (user?.status === 'approved') {
          clearLibraryEdit();
          resetFlow();
          router.replace('/');
        } else {
          router.replace('/login?instagram=connected');
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error.message || 'Instagram 로그인에 실패했습니다.');
          setTimeout(() => router.replace('/login?instagram_error=login_failed'), 1800);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  return <main className="flex min-h-dvh items-center justify-center bg-[#1a1a1a] p-6 text-center text-white"><p>{message}</p></main>;
}
