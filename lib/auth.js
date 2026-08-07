/** Supabase 이메일/비밀번호 인증과 관리자 승인 상태 관리 */
import { getClient, isConfigured } from './supabase.js';

let current = null;
const listeners = new Set();
const EMAIL_DOMAIN = '@openxgroup.co.kr';

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
  const { data, error } = await sb.from('users').select('name, status').eq('id', user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email || '',
    name: data?.name || user.user_metadata?.name || usernameOf(user.email) || '사용자',
    avatar: '',
    // 조회 실패/행 누락을 관리자 승인 대기(pending)로 위장하지 않는다.
    status: data?.status || null,
    profileError: error?.message || (!data ? '사용자 프로필을 찾을 수 없습니다.' : null),
  };
}

function emit() { listeners.forEach((fn) => fn(current)); }
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

export async function signOut() {
  const sb = await getClient();
  if (!sb) return;
  await sb.auth.signOut(); current = null; emit();
}
