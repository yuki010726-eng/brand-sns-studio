import { requirePost, requireApprovedUser, fail, json } from '../_shared.mjs';
import { canonicalBlogUrl, mobileBlogUrl, fetchText, parseArticle } from './_shared.mjs';

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  const auth = await requireApprovedUser(req);
  if (!auth.ok) return fail(res, auth.status, auth.message);
  const urls = [...new Set((Array.isArray(req.body?.urls) ? req.body.urls : []).map(canonicalBlogUrl).filter(Boolean))].slice(0, 5);
  if (!urls.length) return fail(res, 400, '수집할 네이버 블로그 글을 선택해 주세요.');
  const items = [];
  for (const url of urls) {
    try {
      const article = parseArticle(await fetchText(mobileBlogUrl(url)));
      if (article.text.length < 100) throw new Error('본문을 충분히 읽지 못했습니다.');
      items.push({ url, title: article.title || '제목 없음', author: article.author || '', text: article.text.slice(0, 18000), canMakePdf: true });
    } catch (error) { items.push({ url, error: error.message || '수집하지 못했습니다.' }); }
  }
  return json(res, 200, { items });
}
