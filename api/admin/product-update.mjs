import { requirePost, requireAdminUser, fail, json } from '../_shared.mjs';
import { fetchText, parseArticle, canonicalBlogUrl, mobileBlogUrl } from '../research/_shared.mjs';

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  const auth = await requireAdminUser(req);
  if (!auth.ok) return fail(res, auth.status, auth.message);
  const productId = String(req.body?.productId || '').trim();
  const action = req.body?.action === 'apply' ? 'apply' : 'preview';
  const urls = [...new Set((Array.isArray(req.body?.urls) ? req.body.urls : []).map(canonicalNaverUrl).filter(Boolean))].slice(0, 10);
  const approvedSources = approvedSourceMap(req.body?.sources);
  if (!productId) return fail(res, 400, '상품을 선택해 주세요.');
  if (!urls.length) return fail(res, 400, '올바른 네이버 블로그 또는 카페 링크를 입력해 주세요.');

  const existing = await existingProductData(auth, productId);
  if (!existing) return fail(res, 404, '상품을 찾을 수 없습니다.');
  const items = await collectItems(urls, existing.proofs);
  const succeeded = items.filter((item) => !item.error);
  if (!succeeded.length) return json(res, 422, { items, error: '확인할 수 있는 링크가 없습니다.' });
  const newCount = succeeded.reduce((sum, item) => sum + item.newContent.length, 0);

  if (action === 'preview') return json(res, 200, { action, items, newCount });
  const changed = succeeded.flatMap((item) => {
    const approved = approvedSources.get(item.url) || [];
    const newContent = approved.filter((line) => !existing.proofs.some((known) => isDuplicateContent(line, known)));
    const content = [...new Set([...(existing.sources.get(item.url) || []), ...newContent])];
    return newContent.length ? [{ ...item, content, newContent }] : [];
  });
  for (const item of changed) await saveSource(auth, productId, item);
  if (changed.length) await mergeProofs(auth, productId, existing.proofs, changed.flatMap((item) => item.newContent));
  return json(res, 200, { action, items: [...changed, ...items.filter((item) => item.error)], updated: changed.length, newCount });
}

async function existingProductData(auth, productId) {
  const response = await fetch(`${auth.supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(productId)}&select=id,product_proofs(content),product_sources(source_url,source_content)`, { headers: auth.headers });
  const [product] = response.ok ? await response.json() : [];
  if (!product) return null;
  const row = Array.isArray(product.product_proofs) ? product.product_proofs[0] : product.product_proofs;
  const sources = new Map((Array.isArray(product.product_sources) ? product.product_sources : [])
    .map((source) => [source.source_url, Array.isArray(source.source_content) ? source.source_content : []]));
  return { proofs: Array.isArray(row?.content) ? row.content : [], sources };
}

async function collectItems(urls, existingProofs) {
  const known = new Set(existingProofs.map(normalizeLine));
  const items = [];
  for (const url of urls) {
    try {
      const article = await collectArticle(url);
      if (article.text.length < 100) throw new Error('본문을 충분히 읽지 못했습니다.');
      const content = uniqueLines(article.text);
      const newContent = content.filter((line) => !known.has(normalizeLine(line)));
      items.push({ url, title: article.title || '제목 없음', type: url.includes('cafe.naver.com') ? 'cafe' : 'blog', chars: article.text.length, content, newContent });
    } catch (error) { items.push({ url, error: error.message || '가져오지 못했습니다.' }); }
  }
  return items;
}

async function saveSource(auth, productId, item) {
  const response = await fetch(`${auth.supabaseUrl}/rest/v1/product_sources?on_conflict=product_id,source_url`, {
    method: 'POST', headers: { ...auth.headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ product_id: productId, source_url: item.url, source_content: item.content }),
  });
  if (!response.ok) throw new Error('Supabase 출처 저장에 실패했습니다.');
}

async function mergeProofs(auth, productId, existing, imported) {
  const content = [...new Set([...existing, ...imported])];
  const response = await fetch(`${auth.supabaseUrl}/rest/v1/product_proofs?on_conflict=product_id`, {
    method: 'POST', headers: { ...auth.headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ product_id: productId, content }),
  });
  if (!response.ok) throw new Error('가져온 내용을 상품 근거에 반영하지 못했습니다.');
}

const uniqueLines = (text) => [...new Set(text.slice(0, 18000).split(/\n+/).map((line) => line.trim()).filter(Boolean))];
const normalizeLine = (value) => String(value).replace(/\s+/g, ' ').trim().toLocaleLowerCase('ko-KR');

function isDuplicateContent(left, right) {
  const a = comparableLine(left);
  const b = comparableLine(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (numberKey(a) !== numberKey(b)) return false;
  return editSimilarity(a, b) >= 0.82;
}

const comparableLine = (value) => normalizeLine(value).replace(/[^0-9a-z가-힣]/g, '')
  .replace(/(?:열립니다|열린다|입니다|됩니다|합니다|습니다|이다|한다|된다)$/u, '');
const numbersOf = (value) => String(value).match(/\d+(?:[.,]\d+)*/g) || [];
const numberKey = (value) => [...new Set(numbersOf(value))].sort().join('|');
function editSimilarity(a, b) {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (!longer.length) return 1;
  const row = Array.from({ length: shorter.length + 1 }, (_, index) => index);
  for (let i = 1; i <= longer.length; i++) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= shorter.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (longer[i - 1] === shorter[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return 1 - row[shorter.length] / longer.length;
}

function approvedSourceMap(value) {
  const map = new Map();
  if (!Array.isArray(value)) return map;
  value.slice(0, 10).forEach((source) => {
    const url = canonicalNaverUrl(source?.url);
    const content = [...new Set((Array.isArray(source?.content) ? source.content : [])
      .map((line) => String(line).replace(/\s+/g, ' ').trim())
      .filter((line) => line.length >= 8 && line.length <= 500))].slice(0, 40);
    if (url && content.length) map.set(url, content);
  });
  return map;
}

function canonicalNaverUrl(value) {
  const blog = canonicalBlogUrl(value);
  if (blog) return blog;
  try {
    const url = new URL(String(value));
    if (!['cafe.naver.com', 'm.cafe.naver.com'].includes(url.hostname)) return '';
    const modern = url.pathname.match(/^\/ca-fe\/cafes\/(\d+)\/articles\/(\d+)/);
    if (modern) return `https://cafe.naver.com/ca-fe/cafes/${modern[1]}/articles/${modern[2]}`;
    const legacy = url.pathname.match(/^\/([^/]+)\/(\d+)/);
    return legacy ? `https://cafe.naver.com/${legacy[1]}/${legacy[2]}` : '';
  } catch { return ''; }
}

async function collectArticle(url) {
  if (!url.includes('cafe.naver.com')) return parseArticle(await fetchText(mobileBlogUrl(url)));
  const path = new URL(url).pathname;
  const modern = path.match(/^\/ca-fe\/cafes\/(\d+)\/articles\/(\d+)/);
  const legacy = path.match(/^\/([^/]+)\/(\d+)/);
  const cafeId = modern?.[1] || await resolveCafeId(legacy?.[1]);
  const articleId = modern?.[2] || legacy?.[2];
  if (!cafeId || !articleId) throw new Error('카페 링크를 확인할 수 없습니다.');
  const endpoint = `https://apis.naver.com/cafe-web/cafe-articleapi/v2.1/cafes/${cafeId}/articles/${articleId}?query=&boardType=L&useCafeId=true&requestFrom=A`;
  const response = await fetch(endpoint, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: url }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('공개 글이 아니거나 카페 읽기 권한이 필요합니다.');
  const article = (await response.json())?.result?.article;
  if (!article?.isReadable || !article?.isOpen) throw new Error('공개 글이 아니거나 카페 읽기 권한이 필요합니다.');
  return { title: article.subject || '', text: stripTags(article.contentHtml || '') };
}

async function resolveCafeId(alias) {
  if (!alias) return '';
  const response = await fetch(`https://apis.naver.com/cafe-web/cafe2/CafeGateInfo.json?cluburl=${encodeURIComponent(alias)}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = response.ok ? await response.json() : {};
  return String(data?.message?.result?.cafeInfoView?.cafeId || data?.message?.result?.cafeId || '');
}

function stripTags(value) {
  return String(value).replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}
