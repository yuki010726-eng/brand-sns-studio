import { SUPABASE } from '../../../lib/supabase.js';

const fail = (status, error) => Response.json({ error }, { status });
const MAX_PAGES = 8;
const MAX_CHARS = 18000;

async function approved(request) {
  const supabaseUrl = process.env.SUPABASE_URL || SUPABASE.url || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || SUPABASE.anonKey || '';
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!supabaseUrl || !anonKey || !token) return false;
  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
  if (!response.ok) return false;
  const user = await response.json();
  const profile = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=status`, { headers });
  const [row] = profile.ok ? await profile.json() : [];
  return row?.status === 'approved';
}

function safeUrl(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || host === 'localhost' || host.endsWith('.local') ||
      /^(?:127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/.test(host)) {
    throw new Error('공개 HTTPS 사이트만 수집할 수 있습니다.');
  }
  return url;
}

const decode = (value) => String(value || '')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");

function textFromHtml(html) {
  return decode(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6]|section|article|br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\r/g, '').replace(/[ \t]+/g, ' ')
    .split('\n').map((line) => line.trim()).filter((line) => line.length >= 2)
    .filter((line, index, list) => !index || line !== list[index - 1])
    .join('\n');
}

function linksFromHtml(html, page, origin) {
  const links = [];
  for (const match of String(html).matchAll(/<a\b[^>]*\bhref=["']([^"'#?]+)[^"']*["']/gi)) {
    try {
      const url = new URL(match[1], page);
      if (url.origin === origin && /(?:about|service|product|price|rent|faq|guide|company|소개|서비스|상품|요금|렌트|문의)/i.test(url.pathname)) {
        url.hash = ''; url.search = '';
        links.push(url.toString());
      }
    } catch { /* ignore malformed links */ }
  }
  return links;
}

async function page(url, origin) {
  const response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'BrandSNSStudio/1.0 (+content research)' } });
  if (response.status >= 300 && response.status < 400) {
    const next = safeUrl(new URL(response.headers.get('location') || '', url).toString());
    if (next.origin !== origin) throw new Error('다른 도메인으로의 이동은 수집하지 않습니다.');
    return page(next.toString(), origin);
  }
  if (!response.ok) throw new Error(`사이트 응답 ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) throw new Error('HTML 페이지가 아닙니다.');
  return response.text();
}

export async function POST(request) {
  try {
    if (!await approved(request)) return fail(401, '승인된 로그인 계정이 필요합니다.');
    const { siteUrl } = await request.json();
    const start = safeUrl(String(siteUrl || '').trim());
    const queue = [start.toString()];
    const seen = new Set();
    const pages = [];
    let text = '';
    while (queue.length && pages.length < MAX_PAGES && text.length < MAX_CHARS) {
      const url = queue.shift();
      if (seen.has(url)) continue;
      seen.add(url);
      try {
        const html = await page(url, start.origin);
        const body = textFromHtml(html);
        if (body) {
          pages.push(url);
          text += `${text ? '\n\n' : ''}[출처: ${url}]\n${body}`;
        }
        for (const link of linksFromHtml(html, url, start.origin)) if (!seen.has(link)) queue.push(link);
      } catch { /* A single unavailable page must not discard other official pages. */ }
    }
    text = text.slice(0, MAX_CHARS).trim();
    if (text.length < 100) return fail(422, '사이트에서 충분한 본문을 읽지 못했습니다. PDF 제안서 또는 상품 근거를 등록해 주세요.');
    return Response.json({ text, pages });
  } catch (error) {
    return fail(400, error.message || '사이트를 수집하지 못했습니다.');
  }
}
