export async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`페이지를 열지 못했습니다 (${response.status}).`);
  return response.text();
}

export function parseSearch(html) {
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
    return [{ url, title: stripTags(title), author: stripTags(author), date: field(chunk, 'dateInfo') }];
  });
}

export function parseArticle(html) {
  const title = meta(html, 'og:title');
  const author = meta(html, 'naverblog:nickname') || meta(html, 'og:article:author');
  const paragraphs = [...html.matchAll(/<(?:p|span)[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/(?:p|span)>/gi)]
    .map((match) => stripTags(match[1])).filter(Boolean);
  const fallback = html.match(/<div[^>]*class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)?.[1] || '';
  const text = (paragraphs.length ? paragraphs : [stripTags(fallback)]).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { title: decodeEntities(title), author: decodeEntities(author), text };
}

export function canonicalBlogUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.hostname !== 'blog.naver.com') return '';
    const match = url.pathname.match(/^\/([^/]+)\/(\d{8,})/);
    return match ? `https://blog.naver.com/${match[1]}/${match[2]}` : '';
  } catch { return ''; }
}

export function mobileBlogUrl(value) {
  const url = canonicalBlogUrl(value);
  const match = new URL(url).pathname.match(/^\/([^/]+)\/(\d{8,})/);
  if (!match) throw new Error('올바른 네이버 블로그 주소가 아닙니다.');
  return `https://m.blog.naver.com/PostView.naver?blogId=${encodeURIComponent(match[1])}&logNo=${encodeURIComponent(match[2])}`;
}

export function pdfName(value) {
  const match = new URL(canonicalBlogUrl(value)).pathname.match(/^\/([^/]+)\/(\d{8,})/);
  return `${String(match[1]).replace(/[^0-9A-Za-z_-]/g, '_').slice(0, 40)}-${match[2]}.pdf`;
}

function field(chunk, name) { return chunk.match(new RegExp(`"${name}":"([\\s\\S]*?)"`))?.[1] || ''; }
function meta(html, property) { return html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)`, 'i'))?.[1] || ''; }
function stripTags(value = '') { return decodeEntities(String(value).replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n')).trim(); }
function decodeEntities(value = '') { return String(value).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))); }
