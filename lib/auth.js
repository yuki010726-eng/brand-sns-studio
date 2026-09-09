/** Supabase 이메일/비밀번호 인증과 관리자 승인 상태 관리 */
import { getClient, isConfigured } from './supabase.js';

let current = null;
const listeners = new Set();
const EMAIL_DOMAIN = '@openxgroup.co.kr';

/**
 * 승인 상태 캐시(sessionStorage) — 첫 화면 대기 시간을 줄이기 위한 것.
 *
 * ⚠️ 왜 필요한가: `initAuth()` 는 세션 확인(로컬) 뒤에 `users` 테이블 조회(네트워크)까지
 * 끝나야 `current` 가 채워진다. 새로고침마다 이 조회를 기다리는 동안 AuthGate 가
 * 화면 전체를 스피너로 막고 있었다. 직전에 확인된 승인 상태를 sessionStorage 에 남겨 두면
 * 다음 로드 때 그 값으로 **먼저 그리고**, 진짜 조회는 그대로 백그라운드에서 돌려 확인한다.
 * 조회 결과가 다르면(예: 승인 취소) 평소처럼 `onAuth` 로 갱신되어 즉시 반영된다.
 *
 * ⚠️ 탭을 닫으면 사라지는 sessionStorage 를 쓴다 — 다른 계정이 같은 브라우저를 쓸 수 있어
 * localStorage 처럼 오래 남기면 안 된다.
 */
const CACHE_KEY = 'bboggl.auth-cache';

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(user) {
  try {
    if (user) sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // 프라이빗 모드 등에서 storage 접근이 막혀도 인증 흐름은 그대로 동작해야 한다.
  }
}

/** AuthGate 가 첫 렌더에서 낙관적으로 쓸 값. 승인 상태가 아니면 캐시를 쓸 이유가 없다. */
export function getCachedUser() {
  const cached = readCache();
  return cached?.status === 'approved' ? cached : null;
}

/** 화면에서는 아이디만 받고, Supabase 인증 요청에만 사내 이메일 형식을 사용한다. */
function authEmail(username) {
  const value = String(username).trim();
  const localPart = value.toLowerCase().endsWith(EMAIL_DOMAIN)
    ? value.slice(0, -EMAIL_DOMAIN.length)
    : value;
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_{|}~-]+$/.test(localPart)) return null;
  return `${localPart.toLowerCase()}${EMAIL_DOMAIN}`;
}

/** 인증 제공자가 돌려준 이메일에서 화면에 표시할 아이디만 꺼낸다. */
export function usernameOf(email = '') {
  const value = String(email).trim();
  return value.toLowerCase().endsWith(EMAIL_DOMAIN)
    ? value.slice(0, -EMAIL_DOMAIN.length)
    : value.split('@')[0];
}

async function profileOf(user, sb) {
  if (!user) return null;
  const { data, error } = await sb.from('users').select('name, status, role').eq('id', user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email || '',
    name: data?.name || user.user_metadata?.name || usernameOf(user.email) || '사용자',
    avatar: '',
    // 조회 실패/행 누락을 관리자 승인 대기(pending)로 위장하지 않는다.
    status: data?.status || null,
    role: data?.role || 'normal',
    profileError: error?.message || (!data ? '사용자 프로필을 찾을 수 없습니다.' : null),
  };
}

function emit() { writeCache(current); listeners.forEach((fn) => fn(current)); }
export function onAuth(fn) { listeners.add(fn); fn(current); return () => listeners.delete(fn); }
export const getUser = () => current;

export async function initAuth() {
  if (!isConfigured()) return null;
  const sb = await getClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  current = await profileOf(data?.session?.user, sb);
  emit();
  sb.auth.onAuthStateChange((_event, session) => {
    // Auth 콜백의 내부 잠금이 풀린 다음 프로필 테이블을 조회한다.
    setTimeout(async () => {
      // signIn() 이 로그인 직후 같은 사용자 프로필을 이미 받아 뒀으면 다시 묻지 않는다
      // (로그인 한 번에 users 테이블을 두 번 조회하던 것을 없앤다).
      if (current?.id === session?.user?.id && current?.status != null) return;
      current = await profileOf(session?.user, sb);
      emit();
    }, 0);
  });
  return current;
}

export async function signIn(username, password) {
  const sb = await getClient();
  if (!sb) return { error: '로그인 설정이 아직 없습니다.' };
  const email = authEmail(username);
  if (!email) return { error: '아이디 형식을 확인해 주세요.' };
  const { data, error } = await sb.auth.signInWithPassword({ email, password: String(password) });
  if (error) {
    const emailUnconfirmed = error.code === 'email_not_confirmed'
      || /email not confirmed/i.test(error.message || '');
    const invalidCredentials = error.code === 'invalid_credentials'
      || /invalid login credentials/i.test(error.message || '');
    if (emailUnconfirmed) {
      return {
        error: '이메일 확인이 완료되지 않은 계정입니다. 관리자에게 이메일 Confirm 처리를 요청해 주세요.',
        errorType: 'email_unconfirmed',
        status: null,
      };
    }
    if (invalidCredentials) {
      return { error: '아이디나 비밀번호가 맞지 않습니다.', errorType: 'credentials', status: null };
    }
    return { error: error.message, errorType: 'unknown', status: null };
  }
  const profile = await profileOf(data?.user, sb);
  if (profile?.profileError) {
    return {
      error: `관리자 승인 상태를 확인하지 못했습니다. ${profile.profileError}`,
      errorType: 'profile',
      status: null,
    };
  }
  // 여기서 이미 조회했으니 initAuth() 의 onAuthStateChange 리스너가 같은 것을 또 묻지 않게 한다.
  current = profile;
  emit();
  return { error: null, status: profile?.status };
}

export async function signUp(username, password, name) {
  const sb = await getClient();
  if (!sb) return { error: '로그인 설정이 아직 없습니다.' };
  const email = authEmail(username);
  if (!email) return { error: '아이디 형식을 확인해 주세요.' };
  const { data, error } = await sb.auth.signUp({
    email, password: String(password), options: { data: { name: String(name).trim() } },
  });
  return { error: error?.message || null, needsEmailConfirmation: !error && !data?.session };
}

/**
 * 서버 프록시에 보낼 토큰. 서버가 이 토큰으로 **승인된 계정인지 되물어 확인한다.**
 * 로그인 전이거나 설정이 없으면 빈 문자열이다 — 던지지 않는다(auth.js 의 공통 원칙).
 */
export async function accessToken() {
  const sb = await getClient();
  if (!sb) return '';
  const { data } = await sb.auth.getSession();
  return data?.session?.access_token || '';
}

export async function signOut() {
  const sb = await getClient();
  if (!sb) return;
  await sb.auth.signOut(); current = null; emit();
}
