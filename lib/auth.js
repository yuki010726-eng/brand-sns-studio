/**
 * 구글 로그인
 *
 * Supabase Auth 의 OAuth 를 그대로 쓴다. 우리가 토큰을 직접 다루지 않는다 —
 * 직접 다루면 검증할 백엔드가 필요한데, 그건 이 프로젝트에 없다.
 *
 * ⚠️ 설정이 없거나 네트워크가 막혀도 **앱은 그대로 동작해야 한다.**
 *    이 파일의 모든 함수는 실패해도 던지지 않고 조용히 비활성 상태를 돌려준다.
 */
import { getClient, isConfigured } from './supabase.js';

/** @type {{id:string, email:string, name:string, avatar:string}|null} */
let current = null;
const listeners = new Set();

const profileOf = (user) => (user ? {
  id: user.id,
  email: user.email || '',
  name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || '사용자',
  avatar: user.user_metadata?.avatar_url || '',
} : null);

function emit() {
  listeners.forEach((fn) => fn(current));
}

/** @param {(user:object|null) => void} fn @returns {() => void} 구독 해제 */
export function onAuth(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export const getUser = () => current;

/**
 * 앱 시작 시 한 번 부른다. 이미 로그인돼 있으면 복구하고, 이후 변화도 구독한다.
 * @returns {Promise<object|null>}
 */
export async function initAuth() {
  if (!isConfigured()) return null;
  const sb = await getClient();
  if (!sb) return null;

  const { data } = await sb.auth.getSession();
  current = profileOf(data?.session?.user);
  emit();

  sb.auth.onAuthStateChange((_event, session) => {
    current = profileOf(session?.user);
    emit();
  });

  return current;
}

/**
 * 구글 로그인 — 구글 화면으로 이동했다가 지금 주소로 돌아온다.
 *
 * ⚠️ 돌아올 주소(redirectTo)를 Supabase 대시보드의 Redirect URLs 에 등록해 둬야 한다.
 *    등록 안 된 주소로 돌아오면 로그인이 조용히 실패한다. 개발용 localhost 도 넣어야 한다.
 */
export async function signInWithGoogle() {
  const sb = await getClient();
  if (!sb) return { error: '로그인 설정이 아직 없습니다.' };

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // 해시 라우터라 location.href 를 그대로 쓰면 #/copy 까지 붙어 등록 주소와 어긋난다
      redirectTo: `${location.origin}${location.pathname}`,
    },
  });
  return { error: error?.message || null };
}

export async function signOut() {
  const sb = await getClient();
  if (!sb) return;
  await sb.auth.signOut();
  current = null;
  emit();
}
