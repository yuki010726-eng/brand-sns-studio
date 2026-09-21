import { accessToken } from './auth.js';

export async function collectSiteContext(siteUrl, opts = {}) {
  const token = await accessToken();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
  const response = await fetch('/api/site-context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ siteUrl }),
    signal: opts.signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || '사이트 내용을 읽지 못했습니다.');
  return String(body.text || '').trim();
}
