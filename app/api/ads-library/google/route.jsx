import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../../../lib/supabase.js';

const GOOGLE_SOURCE = 'google_ads_transparency';
const REGION_BY_COUNTRY = { KR: '2410' };
const MAX_VIDEO_THUMBNAIL_LOOKUPS = 3;
const fail = (status, error) => Response.json({ error }, { status });
const text = (value) => typeof value === 'string' ? value.trim() : '';

function isSearchQuotaError(message) {
  return /run out of searches|search(?:es)? (?:quota|limit)|credits? (?:have )?been exhausted/i.test(message || '');
}

function settings() {
  return {
    url: (process.env.SUPABASE_URL || SUPABASE.url || '').trim(),
    anonKey: (process.env.SUPABASE_ANON_KEY || SUPABASE.anonKey || '').trim(),
    serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  };
}

async function approved(request, config) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { status: 401, error: '로그인이 필요합니다.' };
  const headers = { apikey: config.anonKey, Authorization: `Bearer ${token}` };
  try {
    const userRes = await fetch(`${config.url}/auth/v1/user`, { headers });
    if (!userRes.ok) return { status: 401, error: '로그인 세션이 만료되었습니다.' };
    const user = await userRes.json();
    const profileRes = await fetch(`${config.url}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=status,role`, { headers });
    const [profile] = profileRes.ok ? await profileRes.json() : [];
    if (profile?.status === 'approved' && profile?.role === 'admin') return { ok: true };
    if (profile?.status === 'approved') return { status: 403, error: '광고 검색은 관리자만 사용할 수 있습니다.' };
    return profile?.status === 'approved' ? { ok: true } : { status: 403, error: '승인된 계정만 사용할 수 있습니다.' };
  } catch {
    return { status: 503, error: '로그인 상태를 확인하지 못했습니다.' };
  }
}

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619); }
  return (result >>> 0).toString(36);
}

function creativeImage(creative) {
  const image = creative.image || creative.image_url || creative.thumbnail || creative.thumbnail_url || '';
  return typeof image === 'string' ? text(image) : text(image?.url);
}

function displayAd(creative, advertiser, index) {
  const image = creativeImage(creative);
  return {
    id: creative.ad_creative_id || creative.creative_id || creative.id || `${advertiser.advertiser_id || advertiser.name || 'ad'}-${index}`,
    advertiser: advertiser.name || creative.advertiser || creative.advertiser_name || '',
    firstShown: creative.first_shown_date || creative.first_shown || '', lastShown: creative.last_shown_date || creative.last_shown || '',
    text: creative.text || creative.ad_text || creative.description || creative.headline || '', format: creative.format || creative.ad_format || creative.type || '',
    image, url: creative.details_link || creative.ad_details_link || creative.url || '',
  };
}

function storedAd(creative, advertiser, index, country) {
  const image = creativeImage(creative);
  const headline = text(creative.headline || creative.title || creative.ad_text || creative.text);
  const description = text(creative.description || creative.ad_description || creative.text);
  const sourceUrl = text(creative.details_link || creative.ad_details_link || creative.url)
    || advertiser?.google_transparency_url
    || `https://adstransparency.google.com/?region=${encodeURIComponent(country)}&domain=${encodeURIComponent(advertiser?.domain || advertiser?.name || '')}`;
  const externalAdId = text(creative.ad_creative_id || creative.creative_id || creative.id || creative.ad_id)
    || `derived-${hash([advertiser?.id || '', headline, description, sourceUrl, creative.format || creative.type || '', index].join('|'))}`;
  return { source: GOOGLE_SOURCE, advertiser_id: advertiser?.id || null, external_ad_id: externalAdId,
    advertiser_name: text(creative.advertiser || creative.advertiser_name) || advertiser?.name || null,
    format: text(creative.format || creative.ad_format || creative.type) || null, platform: 'google', headline: headline || null, description: description || null,
    thumbnail_url: image || null, source_url: sourceUrl,
    last_seen_at: new Date().toISOString(), raw_data: creative };
}

function escapeLike(value) { return value.replace(/[%,_]/g, '\\$&'); }

async function advertisersForQuery(admin, query) {
  const pattern = `%${escapeLike(query)}%`;
  const { data, error } = await admin.from('advertisers').select('id,name,domain,google_transparency_url')
    .or(`name.ilike.${pattern},domain.ilike.${pattern}`).limit(25);
  if (error) throw new Error(`광고주 정보를 읽지 못했습니다: ${error.message}`);
  return data || [];
}

async function googleSearchPage(query, country, nextPageToken = '') {
  const url = new URL('https://serpapi.com/search.json');
  const region = REGION_BY_COUNTRY[country];
  Object.entries({ engine: 'google_ads_transparency_center', api_key: process.env.SERPAPI_KEY, text: query, num: '100', ...(region ? { region } : {}), ...(nextPageToken ? { next_page_token: nextPageToken } : {}) })
    .forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Google 광고 목록을 불러오지 못했습니다.');
  if (body.error && body.search_information?.results_state !== 'Fully empty') throw new Error(body.error);
  const items = body.ad_creatives || body.ads || (body.advertisers || []).flatMap((advertiser) =>
    (advertiser.ad_creatives || advertiser.ads || []).map((creative, index) => ({ creative, advertiser, index })));
  // Keep pagination metadata off the JSON response, but available to the caller.
  items.nextPageToken = text(body.serpapi_pagination?.next_page_token);
  return items;
}

async function googleSearch(query, country) {
  // SerpApi bills per result page. One preview page keeps a single user search
  // from expanding into an unbounded number of provider requests.
  return googleSearchPage(query, country);
}

// The list endpoint often omits a video preview. The ad-details endpoint exposes
// it as `thumbnail`, so only enrich video creatives that still have no image.
async function addVideoThumbnails(items, country) {
  let lookups = 0;
  for (const item of items) {
    const creative = item.creative || item;
    const format = text(creative.format || creative.ad_format || creative.type).toLowerCase();
    const advertiserId = text(creative.advertiser_id || item.advertiser?.advertiser_id);
    const creativeId = text(creative.ad_creative_id || creative.creative_id || creative.id || creative.ad_id);
    if (format !== 'video' || creativeImage(creative) || !advertiserId || !creativeId || lookups >= MAX_VIDEO_THUMBNAIL_LOOKUPS) continue;

    try {
      lookups += 1;
      const url = new URL('https://serpapi.com/search.json');
      Object.entries({ engine: 'google_ads_transparency_center_ad_details', api_key: process.env.SERPAPI_KEY, advertiser_id: advertiserId, creative_id: creativeId, ...(REGION_BY_COUNTRY[country] ? { region: REGION_BY_COUNTRY[country] } : {}) })
        .forEach(([key, value]) => url.searchParams.set(key, value));
      const response = await fetch(url, { cache: 'no-store' });
      const body = response.ok ? await response.json() : {};
      const detailCreative = (body.ad_creatives || []).find((value) => creativeImage(value));
      const thumbnail = detailCreative && creativeImage(detailCreative);
      if (thumbnail) creative.thumbnail = thumbnail;
    } catch {
      // A missing preview must not make the complete ad search fail.
    }
  }
  return items;
}

export async function GET(request) {
  const config = settings();
  const auth = await approved(request, config);
  if (!auth.ok) return fail(auth.status, auth.error);
  if (!process.env.SERPAPI_KEY) return fail(503, 'Google 광고 검색을 사용하려면 서버 환경변수 SERPAPI_KEY를 설정해 주세요.');
  if (!config.url || !config.serviceRoleKey) return fail(500, 'Google 검색 결과 저장을 위해 SUPABASE_SERVICE_ROLE_KEY를 설정해 주세요.');
  const params = new URL(request.url).searchParams;
  const q = text(params.get('q')).slice(0, 100);
  const country = (text(params.get('country')) || 'KR').toUpperCase();
  if (!q) return fail(400, '광고주 또는 도메인을 입력해 주세요.');
  if (!/^[A-Z]{2}$/.test(country)) return fail(400, '국가 코드는 영문 두 글자여야 합니다.');
  try {
    const admin = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const advertisers = await advertisersForQuery(admin, q);
    // 입력값 자체가 등록된 이름/도메인이라면, 그 검색 결과도 해당 광고주에 연결한다.
    const matchingAdvertiser = advertisers.find((advertiser) =>
      [advertiser.name, advertiser.domain].some((value) => text(value).toLowerCase() === q.toLowerCase()),
    ) || null;
    // Do not search every similarly named advertiser: each match adds a billed
    // provider query. The exact local advertiser match is still retained.
    const targets = [{ query: q, advertiser: matchingAdvertiser }];
    const resultSets = await Promise.all(targets.map(async (target) => ({
      target,
      // Google often omits a preview image (especially for video and text ads).
      // It is still a valid search result and must be persisted/displayed.
      items: await addVideoThumbnails(await googleSearch(target.query, country), country),
    })));
    const seen = new Set(), data = [], records = [];
    for (const { target, items } of resultSets) for (const item of items) {
      const creative = item.creative || item, sourceAdvertiser = item.advertiser || {};
      const result = displayAd(creative, sourceAdvertiser, data.length);
      const key = text(creative.ad_creative_id || creative.creative_id || creative.id || creative.ad_id) || `${result.advertiser}|${result.url}|${result.text}|${result.image}`;
      if (seen.has(key)) continue;
      seen.add(key); data.push(result); records.push(storedAd(creative, target.advertiser, records.length, country));
    }
    if (records.length) {
      const { error } = await admin.from('ads').upsert(records, { onConflict: 'source,external_ad_id' });
      if (error) throw new Error(`광고 저장에 실패했습니다: ${error.message}`);
    }
    return Response.json({ data, searched: targets.map(({ query }) => query), stored: records.length });
  } catch (error) {
    const message = error.message || '';
    if (isSearchQuotaError(message)) {
      return fail(429, 'Google 광고 검색 한도가 소진되었습니다. SerpApi 대시보드에서 플랜 또는 검색 크레딧을 충전한 뒤 다시 시도해 주세요.');
    }
    return fail(503, message || 'Google 광고 서비스에 연결하지 못했습니다.');
  }
}
