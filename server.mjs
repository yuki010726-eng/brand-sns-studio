import { createServer } from 'node:http';
import { readFile, mkdir, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve('.');
const OUTPUT = join(ROOT, 'research-output');
const PORT = Number(process.env.PORT || 5610);
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf' };

await mkdir(OUTPUT, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'POST' && url.pathname === '/api/research/search') return await search(req, res);
    if (req.method === 'POST' && url.pathname === '/api/research/collect') return await collect(req, res);
    return await staticFile(url.pathname, res);
  } catch (error) {
    send(res, 500, { error: error.message || '처리 중 오류가 발생했습니다.' });
  }
});

if (process.argv.includes('--self-test')) {
  const html = await fetchText(`https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent('브랜드 마케팅')}`);
  const results = parseSearch(html);
  if (!results.length) throw new Error('검색 결과 파싱 실패');
  const first = results[0];
  const { blogId, logNo } = blogParts(first.url);
  const mobileUrl = `https://m.blog.naver.com/PostView.naver?blogId=${encodeURIComponent(blogId)}&logNo=${encodeURIComponent(logNo)}`;
  const article = parseArticle(await fetchText(mobileUrl));
  if (article.text.length < 100) throw new Error('본문 파싱 실패');
  const testPdf = join(OUTPUT, '_self-test.pdf');
  await savePdf(mobileUrl, testPdf);
  console.log(JSON.stringify({ candidates: results.length, first: first.title, bodyChars: article.text.length, pdf: testPdf }, null, 2));
} else {
  server.listen(PORT, () => {
    console.log(`브랜드 SNS 스튜디오: http://localhost:${PORT}`);
    console.log('블로그 PDF는 research-output 폴더에 저장됩니다.');
  });
}

async function search(req, res) {
  const { keyword = '' } = await jsonBody(req);
  const query = String(keyword).trim();
  if (query.length < 2) return send(res, 400, { error: '검색어를 두 글자 이상 입력해 주세요.' });
  const encodedQuery = encodeURIComponent(query);
  const targets = [
    `https://m.search.naver.com/search.naver?ssc=tab.m_blog.all&query=${encodedQuery}`,
    `https://m.search.naver.com/search.naver?ssc=tab.m_blog.all&sm=mtb_pge&page=2&start=1&query=${encodedQuery}`,
    `https://m.search.naver.com/search.naver?ssc=tab.m_cafe.all&query=${encodedQuery}`,
    `https://m.search.naver.com/search.naver?ssc=tab.m_cafe.all&sm=mtb_pge&page=2&start=1&query=${encodedQuery}`,
  ];
  const pages = await Promise.allSettled(targets.map(fetchText));
  const parsed = [];
  const seen = new Set();
  for (const page of pages) {
    if (page.status !== 'fulfilled') continue;
    for (const item of parseSearch(page.value)) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      parsed.push(item);
      if (parsed.length >= 60) break;
    }
    if (parsed.length >= 60) break;
  }
  const ranked = rankSearchResults(parsed, query);
  const readable = await Promise.all(ranked.map(async (item) => {
    if (item.type !== 'cafe') return true;
    try { await fetchCafeArticle(articleSource(item.url)); return true; }
    catch { return false; }
  }));
  const filtered = ranked.filter((_, index) => readable[index]);
  const blogs = filtered.filter((item) => item.type === 'blog');
  const cafes = filtered.filter((item) => item.type === 'cafe');
  const results = interleaveResults(blogs, cafes, 12);
  if (!results.length) return send(res, 502, { error: '네이버에서 후보 글을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  send(res, 200, { results });
}

async function collect(req, res) {
  const { urls = [] } = await jsonBody(req);
  const selected = [...new Set(urls.map(canonicalNaverUrl).filter(Boolean))].slice(0, 5);
  if (!selected.length) return send(res, 400, { error: '수집할 네이버 블로그 글을 선택해 주세요.' });

  const items = [];
  for (const url of selected) {
    try {
      const source = articleSource(url);
      const article = source.type === 'cafe'
        ? await fetchCafeArticle(source)
        : parseArticle(await fetchText(source.readUrl));
      if (article.text.length < 100) {
        if (source.type === 'cafe') throw new Error('공개 글이 아니거나 가입·로그인·등급 권한이 필요한 카페 글입니다.');
        throw new Error('본문을 충분히 읽지 못했습니다.');
      }
      const stem = `${source.type}-${safeName(source.owner)}-${source.articleId}`;
      const pdfName = `${stem}.pdf`;
      const pdfPath = join(OUTPUT, pdfName);
      let pdfError = '';
      try { await savePdf(source.readUrl, pdfPath); } catch (error) { pdfError = error.message; }
      items.push({ url, type: source.type, title: article.title || `${source.owner}의 글`, author: article.author || source.owner, text: article.text.slice(0, 18000), pdfUrl: pdfError ? '' : `/research-output/${pdfName}`, pdfError });
    } catch (error) {
      items.push({ url, error: error.message || '수집하지 못했습니다.' });
    }
  }
  send(res, 200, { items });
}

function parseSearch(html) {
  const decoded = decodeEntities(html);
  // Only use rendered result-card anchors. Looking for every URL in the HTML
  // also captures image viewers, recommendations and comments before the real
  // results, which produces irrelevant candidates and hides valid ones.
  const metadata = searchMetadata(decoded);
  const links = [...decoded.matchAll(/<a\b[^>]*href=["']([^"']*(?:blog|cafe)\.naver\.com[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  return links.flatMap((match) => {
    const rawUrl = match[1].replace(/\\\//g, '/');
    let url = canonicalNaverUrl(rawUrl);
    if (!url) return [];
    const info = metadata.get(url) || {};
    if (info.url) url = info.url;
    if (seen.has(url)) return [];
    const title = stripTags(match[2]);
    if (!title || title === '더보기' || /^\d+$/.test(title) || title.length > 300) return [];
    seen.add(url);
    const author = info.author || new URL(url).pathname.split('/')[1];
    return [{ url, type: new URL(url).hostname === 'cafe.naver.com' ? 'cafe' : 'blog', title, author, date: info.date || '' }];
  });
}

function rankSearchResults(items, query) {
  const normalizedQuery = normalizeSearchText(query);
  const stopwords = new Set(['네이버', '블로그', '카페', '후기', '추천', '정보']);
  const tokens = [...new Set(normalizedQuery.split(/\s+/).filter((token) => token.length >= 2 && !stopwords.has(token)))];
  return items.filter((item) => !/[!?~]{2,}/.test(item.title) && normalizeSearchText(item.title).length >= 4)
    .map((item, index) => {
    const title = normalizeSearchText(item.title);
    const matched = tokens.filter((token) => title.includes(token)).length;
    const score = (normalizedQuery && title.includes(normalizedQuery) ? 100 : 0) + matched * 10 - index / 100;
    return { item, score, matched };
  }).filter(({ matched }) => !tokens.length || matched > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

function normalizeSearchText(value) {
  return String(value || '').toLocaleLowerCase('ko-KR').replace(/[^0-9a-z가-힣]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function interleaveResults(blogs, cafes, limit) {
  const results = [];
  let blogIndex = 0;
  let cafeIndex = 0;
  while (results.length < limit && (blogIndex < blogs.length || cafeIndex < cafes.length)) {
    if (blogIndex < blogs.length) results.push(blogs[blogIndex++]);
    if (results.length < limit && blogIndex < blogs.length) results.push(blogs[blogIndex++]);
    if (results.length < limit && cafeIndex < cafes.length) results.push(cafes[cafeIndex++]);
  }
  return results;
}

function searchMetadata(decoded) {
  const map = new Map();
  const links = [...decoded.matchAll(/"link":"(https?:\/\/(?:m\.)?(?:blog|cafe)\.naver\.com\/[^"?#]+(?:\?[^"#]*)?)"/g)];
  for (const match of links) {
    const original = canonicalNaverUrl(match[1]);
    if (!original) continue;
    const chunk = decoded.slice(match.index, match.index + 20000);
    const cafeRef = field(chunk, 'articleid').match(/^cafe(\d+)\|\d+\|(\d+)$/);
    const url = cafeRef ? `https://cafe.naver.com/ca-fe/cafes/${cafeRef[1]}/articles/${cafeRef[2]}` : original;
    const current = map.get(original);
    const info = { url, author: stripTags(field(chunk, 'writerTitle') || field(chunk, 'cafeName')), date: field(chunk, 'dateInfo') };
    if (!current || (!current.author && info.author)) map.set(original, info);
  }
  // The mobile page also embeds an escaped image-data copy where the article
  // reference can be far from its link. Resolve cafe aliases from that copy so
  // public article collection receives the numeric cafe ID required by Naver.
  for (const ref of decoded.matchAll(/(?:\\?"articleid\\?":\\?")cafe(\d+)\|\d+\|(\d+)/g)) {
    const before = decoded.slice(Math.max(0, ref.index - 20000), ref.index);
    const cafeLinks = [...before.matchAll(/https?:\\?\/\\?\/(?:m\.)?cafe\.naver\.com\\?\/([^\s"'<>?#\\]+)\\?\/(\d+)/g)];
    const link = cafeLinks.filter((candidate) => candidate[2] === ref[2]).at(-1);
    if (!link) continue;
    const original = canonicalCafeUrl(link[0].replace(/\\\//g, '/'));
    if (!original) continue;
    const existing = map.get(original) || {};
    map.set(original, { ...existing, url: `https://cafe.naver.com/ca-fe/cafes/${ref[1]}/articles/${ref[2]}` });
  }
  return map;
}

function parseArticle(html) {
  const title = meta(html, 'og:title');
  const author = meta(html, 'naverblog:nickname') || meta(html, 'og:article:author');
  const paragraphs = [...html.matchAll(/<(?:p|span)[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/(?:p|span)>/gi)]
    .map((m) => stripTags(m[1])).filter(Boolean);
  const fallback = html.match(/<div[^>]*class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)?.[1] || '';
  const text = (paragraphs.length ? paragraphs : [stripTags(fallback)]).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { title: decodeEntities(title), author: decodeEntities(author), text };
}

function parseCafeArticle(html) {
  const title = meta(html, 'og:title').replace(/\s*:\s*네이버 카페\s*$/, '');
  const author = meta(html, 'article:author') || meta(html, 'naver:cafe:nickname');
  const paragraphs = [...html.matchAll(/<(?:p|span)[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/(?:p|span)>/gi)]
    .map((match) => stripTags(match[1])).filter(Boolean);
  const fallback = html.match(/<(?:div|article)[^>]*(?:id|class)=["'][^"']*(?:postContent|ContentRenderer|se-main-container|article_viewer)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article)>/i)?.[1] || '';
  const cleanedFallback = fallback.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const text = (paragraphs.length ? paragraphs : [stripTags(cleanedFallback)]).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { title: decodeEntities(title), author: decodeEntities(author), text };
}

async function fetchCafeArticle(source) {
  const cafeId = source.cafeId || await resolveCafeId(source.owner);
  if (!cafeId) throw new Error('카페 정보를 확인할 수 없어 본문을 수집하지 못했습니다.');
  const endpoint = `https://apis.naver.com/cafe-web/cafe-articleapi/v2.1/cafes/${cafeId}/articles/${source.articleId}?query=&boardType=L&useCafeId=true&requestFrom=A`;
  const response = await fetch(endpoint, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9', Referer: source.readUrl }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('공개 글이 아니거나 가입·로그인·등급 권한이 필요한 카페 글입니다.');
  const data = await response.json();
  const article = data?.result?.article;
  if (!article?.isReadable || !article?.isOpen) throw new Error('공개 글이 아니거나 가입·로그인·등급 권한이 필요한 카페 글입니다.');
  const text = stripTags(String(article.contentHtml || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, ''));
  return { title: article.subject || '', author: article.writer?.nick || article.writer?.nickname || article.writer?.name || '', text };
}

async function resolveCafeId(cafeAlias) {
  if (/^\d+$/.test(String(cafeAlias))) return String(cafeAlias);
  const endpoint = `https://apis.naver.com/cafe-web/cafe2/CafeGateInfo.json?cluburl=${encodeURIComponent(cafeAlias)}`;
  const response = await fetch(endpoint, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://cafe.naver.com/' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) return '';
  const data = await response.json();
  return String(data?.message?.result?.cafeInfoView?.cafeId || data?.message?.result?.cafeId || data?.message?.result?.clubId || '');
}

async function savePdf(url, output) {
  const chrome = await findChrome();
  await new Promise((resolvePromise, reject) => {
    const child = spawn(chrome, [
      '--headless=new', '--disable-gpu', '--disable-gpu-compositing', '--disable-software-rasterizer',
      '--no-sandbox', '--no-first-run', '--no-pdf-header-footer', `--print-to-pdf=${output}`, url,
    ], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('PDF 저장 시간이 초과됐습니다.')); }, 30000);
    child.on('error', reject);
    child.on('exit', async (code) => {
      clearTimeout(timer);
      try { await access(output); resolvePromise(); }
      catch { reject(new Error(`Chrome PDF 저장에 실패했습니다${code ? ` (${code})` : ''}. ${stderr.slice(-180)}`)); }
    });
  });
}

async function findChrome() {
  for (const path of CHROME_CANDIDATES) {
    try { await access(path); return path; } catch { /* 다음 후보 */ }
  }
  throw new Error('Chrome 또는 Edge를 찾지 못해 PDF를 저장하지 못했습니다.');
}

async function staticFile(pathname, res) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const path = normalize(join(ROOT, relative));
  if (!path.startsWith(ROOT)) return send(res, 403, { error: '허용되지 않은 경로입니다.' });
  try {
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { send(res, 404, { error: '파일을 찾지 못했습니다.' }); }
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`페이지를 열지 못했습니다 (${response.status}).`);
  return response.text();
}

async function jsonBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100000) throw new Error('요청이 너무 큽니다.');
  }
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('요청 형식이 올바르지 않습니다.'); }
}

function blogParts(url) {
  const match = new URL(url).pathname.match(/^\/([^/]+)\/(\d{8,})/);
  if (!match) throw new Error('올바른 네이버 블로그 주소가 아닙니다.');
  return { blogId: match[1], logNo: match[2] };
}
function canonicalBlogUrl(value) {
  try {
    const url = new URL(String(value));
    if (!['blog.naver.com', 'm.blog.naver.com'].includes(url.hostname)) return '';
    const match = url.pathname.match(/^\/([^/]+)\/(\d{8,})/);
    return match ? `https://blog.naver.com/${match[1]}/${match[2]}` : '';
  } catch { return ''; }
}
function canonicalCafeUrl(value) {
  try {
    const url = new URL(String(value));
    if (!['cafe.naver.com', 'm.cafe.naver.com'].includes(url.hostname)) return '';
    const modern = url.pathname.match(/\/(?:ca-fe\/(?:web\/)?|)cafes\/(\d+)\/articles\/(\d+)/);
    if (modern) return `https://cafe.naver.com/ca-fe/cafes/${modern[1]}/articles/${modern[2]}`;
    const queryClub = url.searchParams.get('clubid');
    const queryArticle = url.searchParams.get('articleid');
    if (queryClub && queryArticle) return `https://cafe.naver.com/ca-fe/cafes/${queryClub}/articles/${queryArticle}`;
    const legacy = url.pathname.match(/^\/([^/]+)\/(\d+)\/?$/);
    return legacy ? `https://cafe.naver.com/${legacy[1]}/${legacy[2]}` : '';
  } catch { return ''; }
}
function canonicalNaverUrl(value) { return canonicalBlogUrl(value) || canonicalCafeUrl(value); }
function articleSource(url) {
  const blogUrl = canonicalBlogUrl(url);
  if (blogUrl) {
    const { blogId, logNo } = blogParts(blogUrl);
    return { type: 'blog', owner: blogId, articleId: logNo, readUrl: `https://m.blog.naver.com/PostView.naver?blogId=${encodeURIComponent(blogId)}&logNo=${encodeURIComponent(logNo)}` };
  }
  const cafeUrl = canonicalCafeUrl(url);
  const modern = cafeUrl && new URL(cafeUrl).pathname.match(/\/ca-fe\/cafes\/(\d+)\/articles\/(\d+)/);
  if (modern) return { type: 'cafe', owner: modern[1], cafeId: modern[1], articleId: modern[2], readUrl: `https://m.cafe.naver.com/ca-fe/web/cafes/${modern[1]}/articles/${modern[2]}` };
  const legacy = cafeUrl && new URL(cafeUrl).pathname.match(/^\/([^/]+)\/(\d+)/);
  if (legacy) return { type: 'cafe', owner: legacy[1], articleId: legacy[2], readUrl: `https://m.cafe.naver.com/${legacy[1]}/${legacy[2]}` };
  throw new Error('올바른 네이버 블로그 또는 카페 글 주소가 아닙니다.');
}
function field(chunk, name) { return chunk.match(new RegExp(`"${name}":"([\\s\\S]*?)"`))?.[1] || ''; }
function meta(html, property) { return html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)`, 'i'))?.[1] || ''; }
function stripTags(value = '') { return decodeEntities(String(value).replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n')).trim(); }
function decodeEntities(value = '') { return String(value).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))); }
function safeName(value) { return String(value).replace(/[^0-9A-Za-z_-]/g, '_').slice(0, 40); }
function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
