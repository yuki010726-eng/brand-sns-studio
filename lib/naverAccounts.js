/**
 * `/api/naver/accounts` 를 호출하는 브라우저 클라이언트. `lib/instagram-accounts.js` 와
 * 같은 구조다 — 단, 네이버는 OAuth가 없어 계정 "연결"이 아니라 blogId·별명을 직접
 * 입력해 등록하는 것뿐이다. 로그인 세션은 여기서 만들어지지 않는다
 * (`npm run naver:setup -- {id}` 로 사람이 직접 로그인해야 한다).
 */
import { accessToken } from './auth.js';

async function authorizedRequest(url, options = {}) {
  const token = await accessToken();
  if (!token) throw new Error('로그인이 필요합니다.');
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || '네이버 계정 요청에 실패했습니다.');
  return body;
}

export async function getNaverAccounts() {
  const body = await authorizedRequest('/api/naver/accounts');
  return body.accounts || [];
}

export async function addNaverAccount(blogId, label) {
  const body = await authorizedRequest('/api/naver/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blogId, label }),
  });
  return body.account;
}

export async function removeNaverAccount(id) {
  await authorizedRequest(`/api/naver/accounts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
