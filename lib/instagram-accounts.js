import { accessToken } from './auth.js';

export const INSTAGRAM_ACCOUNTS_CHANGED = 'instagram-accounts-changed';
export const ACTIVE_INSTAGRAM_ACCOUNT_KEY = 'active-instagram-account-id';

async function authorizedRequest(url, options = {}) {
  const token = await accessToken();
  if (!token) throw new Error('로그인이 필요합니다.');
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Instagram 계정 요청에 실패했습니다.');
  return body;
}

export async function getInstagramAccounts() {
  const body = await authorizedRequest('/api/instagram/accounts');
  return body.accounts || [];
}

export async function startInstagramConnection() {
  const body = await authorizedRequest('/api/auth/instagram/start', { method: 'POST' });
  window.location.assign(body.url);
}

export async function disconnectInstagramAccount(instagramUserId) {
  await authorizedRequest(`/api/instagram/accounts?instagram_user_id=${encodeURIComponent(instagramUserId)}`, {
    method: 'DELETE',
  });
  if (getActiveInstagramAccountId() === String(instagramUserId)) {
    localStorage.removeItem(ACTIVE_INSTAGRAM_ACCOUNT_KEY);
  }
  window.dispatchEvent(new Event(INSTAGRAM_ACCOUNTS_CHANGED));
}

export function getActiveInstagramAccountId() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ACTIVE_INSTAGRAM_ACCOUNT_KEY) || '';
}

export function setActiveInstagramAccountId(id) {
  if (id) localStorage.setItem(ACTIVE_INSTAGRAM_ACCOUNT_KEY, String(id));
  else localStorage.removeItem(ACTIVE_INSTAGRAM_ACCOUNT_KEY);
  window.dispatchEvent(new Event(INSTAGRAM_ACCOUNTS_CHANGED));
}
