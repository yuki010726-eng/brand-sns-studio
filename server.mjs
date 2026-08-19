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
  const target = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(query)}`;
  const html = await fetchText(target);
  const results = parseSearch(html).slice(0, 12);
  if (!results.length) return send(res, 502, { error: '네이버에서 후보 글을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  send(res, 200, { results });
}

async function collect(req, res) {
  const { urls = [] } = await jsonBody(req);
  const selected = [...new Set(urls.map(canonicalBlogUrl).filter(Boolean))].slice(0, 5);
  if (!selected.length) return send(res, 400, { error: '수집할 네이버 블로그 글을 선택해 주세요.' });

  const items = [];
  for (const url of selected) {
    try {
      const { blogId, logNo } = blogParts(url);
      const mobileUrl = `https://m.blog.naver.com/PostView.naver?blogId=${encodeURIComponent(blogId)}&logNo=${encodeURIComponent(logNo)}`;
      const html = await fetchText(mobileUrl);
      const article = parseArticle(html);
      if (article.text.length < 100) throw new Error('본문을 충분히 읽지 못했습니다.');
      const stem = `${safeName(blogId)}-${logNo}`;
      const pdfName = `${stem}.pdf`;
      const pdfPath = join(OUTPUT, pdfName);
      let pdfError = '';
      try { await savePdf(mobileUrl, pdfPath); } catch (error) { pdfError = error.message; }
      items.push({ url, title: article.title || `${blogId}의 글`, author: article.author || blogId, text: article.text.slice(0, 18000), pdfUrl: pdfError ? '' : `/research-output/${pdfName}`, pdfError });
    } catch (error) {
      items.push({ url, error: error.message || '수집하지 못했습니다.' });
    }
  }
  send(res, 200, { items });
}

function parseSearch(html) {
  const decoded = decodeEntities(html);
  const links = [...decoded.matchAll(/"link":"(https:\/\/blog\.naver\.com\/[^"?#]+\/\d{8,})"/g)];
  const seen = new Set();
  return links.flatMap((match) => {
    const url = canonicalBlogUrl(match[1]);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    const chunk = decoded.slice(match.index, match.index + 3500);
    const title = field(chunk, 'title') || '제목 없음';
    const author = field(chunk, 'writerTitle') || new URL(url).pathname.split('/')[1];
    const date = field(chunk, 'dateInfo');
    return [{ url, title: stripTags(title), author: stripTags(author), date }];
  });
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
    if (url.hostname !== 'blog.naver.com') return '';
    const match = url.pathname.match(/^\/([^/]+)\/(\d{8,})/);
    return match ? `https://blog.naver.com/${match[1]}/${match[2]}` : '';
  } catch { return ''; }
}
function field(chunk, name) { return chunk.match(new RegExp(`"${name}":"([\\s\\S]*?)"`))?.[1] || ''; }
function meta(html, property) { return html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)`, 'i'))?.[1] || ''; }
function stripTags(value = '') { return decodeEntities(String(value).replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n')).trim(); }
function decodeEntities(value = '') { return String(value).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))); }
function safeName(value) { return String(value).replace(/[^0-9A-Za-z_-]/g, '_').slice(0, 40); }
function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
