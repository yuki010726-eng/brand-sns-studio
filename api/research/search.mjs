import { requirePost, requireApprovedUser, fail, json } from '../_shared.mjs';
import { fetchText, parseSearch } from './_shared.mjs';

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  const auth = await requireApprovedUser(req);
  if (!auth.ok) return fail(res, auth.status, auth.message);
  const keyword = String(req.body?.keyword || '').trim();
  if (keyword.length < 2) return fail(res, 400, '검색어를 두 글자 이상 입력해 주세요.');
  try {
    const url = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(keyword)}`;
    const results = parseSearch(await fetchText(url)).slice(0, 12);
    if (!results.length) return fail(res, 502, '네이버에서 후보 글을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return json(res, 200, { results });
  } catch (error) { return fail(res, 502, error.message || '네이버 검색에 실패했습니다.'); }
}
