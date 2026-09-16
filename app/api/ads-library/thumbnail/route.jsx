const SNAPSHOT_HOSTS = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com']);

function imageFromSnapshot(html) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = (tag.match(/(?:property|name)\s*=\s*["']?([^"'\s>]+)/i)?.[1] || '').toLowerCase();
    if (key !== 'og:image' && key !== 'og:image:url' && key !== 'twitter:image') continue;
    const value = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
    if (value) return value.replace(/&amp;/g, '&');
  }
  return '';
}

export async function GET(request) {
  const source = new URL(request.url).searchParams.get('url') || '';
  let snapshot;
  try { snapshot = new URL(source); } catch { return new Response(null, { status: 400 }); }
  if (snapshot.protocol !== 'https:' || !SNAPSHOT_HOSTS.has(snapshot.hostname)) return new Response(null, { status: 400 });
  try {
    const page = await fetch(snapshot, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; BrandStudioThumbnail/1.0)' }, cache: 'force-cache' });
    const imageUrl = page.ok && imageFromSnapshot(await page.text());
    if (!imageUrl) return new Response(null, { status: 404 });
    const image = await fetch(imageUrl, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; BrandStudioThumbnail/1.0)' }, cache: 'force-cache' });
    const type = image.headers.get('content-type');
    if (!image.ok || !type?.startsWith('image/')) return new Response(null, { status: 404 });
    return new Response(image.body, { headers: { 'content-type': type, 'cache-control': 'public, max-age=86400, s-maxage=604800' } });
  } catch { return new Response(null, { status: 404 }); }
}
