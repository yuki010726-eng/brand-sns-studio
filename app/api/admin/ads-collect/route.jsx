import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../../../lib/supabase.js';

const GOOGLE_SOURCE = 'google_ads_transparency';
const fail = (status, error) => Response.json({ error }, { status });
const REGION_BY_COUNTRY = { KR: '2410' };

function config() {
  return {
    supabaseUrl: (process.env.SUPABASE_URL || SUPABASE.url || '').trim(),
    anonKey: (process.env.SUPABASE_ANON_KEY || SUPABASE.anonKey || '').trim(),
    serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    serpApiKey: (process.env.SERPAPI_KEY || '').trim(),
    cronSecret: (process.env.CRON_SECRET || '').trim(),
  };
}

function isAuthorizedCron(request, settings) {
  const authorization = request.headers.get('authorization') || '';
  return Boolean(settings.cronSecret) && authorization === `Bearer ${settings.cronSecret}`;
}

async function requireAdmin(request, settings) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return { status: 401, error: '로그인이 필요합니다.' };

  const headers = { apikey: settings.anonKey, Authorization: `Bearer ${token}` };
  try {
    const userResponse = await fetch(`${settings.supabaseUrl}/auth/v1/user`, { headers });
    if (!userResponse.ok) return { status: 401, error: '로그인 세션이 만료되었습니다.' };
    const user = await userResponse.json();
    const profileResponse = await fetch(
      `${settings.supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=status,role`,
      { headers },
    );
    const [profile] = profileResponse.ok ? await profileResponse.json() : [];
    if (profile?.status !== 'approved' || profile?.role !== 'admin') {
      return { status: 403, error: '관리자 권한이 필요합니다.' };
    }
    return { ok: true };
  } catch {
    return { status: 503, error: '로그인 상태를 확인하지 못했습니다.' };
  }
}

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function string(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function creativeImage(creative) {
  const image = creative.image || creative.image_url || creative.thumbnail || creative.thumbnail_url || '';
  return typeof image === 'string' ? string(image) : string(image?.url);
}

function normalizeCreative(creative, advertiser, index) {
  const image = creativeImage(creative);
  const headline = string(creative.headline || creative.title || creative.ad_text || creative.text);
  const description = string(creative.description || creative.ad_description || creative.text);
  const sourceUrl = string(creative.details_link || creative.ad_details_link || creative.url)
    || advertiser.google_transparency_url
    || `https://adstransparency.google.com/?region=KR&domain=${encodeURIComponent(advertiser.domain || advertiser.name)}`;
  const externalAdId = string(creative.creative_id || creative.id || creative.ad_id)
    || `derived-${hash([advertiser.id, headline, description, sourceUrl, creative.format || creative.type, index].join('|'))}`;

  return {
    source: GOOGLE_SOURCE,
    advertiser_id: advertiser.id,
    external_ad_id: externalAdId,
    advertiser_name: string(creative.advertiser || creative.advertiser_name) || advertiser.name,
    format: string(creative.format || creative.ad_format || creative.type) || null,
    platform: 'google',
    headline: headline || null,
    description: description || null,
    thumbnail_url: image || null,
    source_url: sourceUrl,
    last_seen_at: new Date().toISOString(),
    raw_data: creative,
  };
}

async function searchGoogleAdsPage(advertiser, country, serpApiKey, nextPageToken = '') {
  const url = new URL('https://serpapi.com/search.json');
  const query = advertiser.domain || advertiser.name;
  const region = REGION_BY_COUNTRY[country];
  Object.entries({
    engine: 'google_ads_transparency_center',
    api_key: serpApiKey,
    text: query,
    num: '100',
    ...(region ? { region } : {}),
    ...(nextPageToken ? { next_page_token: nextPageToken } : {}),
  }).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(body.error || 'Google 광고 투명성 센터 검색에 실패했습니다.');

  const creatives = body.ad_creatives || body.ads || (body.advertisers || []).flatMap((item) => item.ad_creatives || item.ads || []);
  if (!Array.isArray(creatives)) return [];
  for (const creative of creatives) {
    const format = string(creative.format || creative.ad_format || creative.type).toLowerCase();
    // `advertiser.id` is our database UUID, not Google's AR… advertiser ID.
    const advertiserId = string(creative.advertiser_id);
    const creativeId = string(creative.ad_creative_id || creative.creative_id || creative.id || creative.ad_id);
    if (format !== 'video' || creativeImage(creative) || !advertiserId || !creativeId) continue;
    try {
      const detailUrl = new URL('https://serpapi.com/search.json');
      Object.entries({ engine: 'google_ads_transparency_center_ad_details', api_key: serpApiKey, advertiser_id: advertiserId, creative_id: creativeId, ...(REGION_BY_COUNTRY[country] ? { region: REGION_BY_COUNTRY[country] } : {}) })
        .forEach(([key, value]) => detailUrl.searchParams.set(key, value));
      const detailResponse = await fetch(detailUrl, { cache: 'no-store' });
      const detail = detailResponse.ok ? await detailResponse.json() : {};
      const detailCreative = (detail.ad_creatives || []).find((value) => creativeImage(value));
      const thumbnail = detailCreative && creativeImage(detailCreative);
      if (thumbnail) creative.thumbnail = thumbnail;
    } catch {
      // Preserve the ad even when its transient thumbnail cannot be retrieved.
    }
  }
  creatives.nextPageToken = string(body.serpapi_pagination?.next_page_token);
  return creatives;
}

async function searchGoogleAds(advertiser, country, serpApiKey) {
  const all = [];
  const seenTokens = new Set();
  let nextPageToken = '';

  do {
    const page = await searchGoogleAdsPage(advertiser, country, serpApiKey, nextPageToken);
    all.push(...page);
    nextPageToken = page.nextPageToken || '';
    if (!nextPageToken || seenTokens.has(nextPageToken)) break;
    seenTokens.add(nextPageToken);
  } while (nextPageToken);

  // Video previews were enriched page-by-page. A missing preview does not mean
  // the creative is invalid, so retain it for storage and the library.
  return all;
}

export async function POST(request) {
  const settings = config();
  if (!settings.supabaseUrl || !settings.anonKey || !settings.serviceRoleKey) {
    return fail(500, 'SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY를 설정해 주세요.');
  }
  if (!settings.serpApiKey) return fail(503, 'SERPAPI_KEY를 설정해 주세요.');

  if (!isAuthorizedCron(request, settings)) {
    const auth = await requireAdmin(request, settings);
    if (!auth.ok) return fail(auth.status, auth.error);
  }

  const body = await request.json().catch(() => ({}));
  const advertiserId = string(body?.advertiserId);
  const country = (string(body?.country) || 'KR').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return fail(400, 'country는 두 글자 국가 코드여야 합니다.');

  const admin = createClient(settings.supabaseUrl, settings.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let query = admin.from('advertisers').select('id,name,domain,google_transparency_url');
  if (advertiserId) query = query.eq('id', advertiserId);
  const { data: advertisers, error: advertisersError } = await query.order('last_collected_at', { ascending: true, nullsFirst: true });
  if (advertisersError) return fail(500, `광고주 목록을 읽지 못했습니다: ${advertisersError.message}`);

  const results = [];
  for (const advertiser of advertisers || []) {
    try {
      const creatives = await searchGoogleAds(advertiser, country, settings.serpApiKey);
      const ads = creatives.map((creative, index) => normalizeCreative(creative, advertiser, index));
      if (ads.length) {
        const { error } = await admin.from('ads').upsert(ads, { onConflict: 'source,external_ad_id' });
        if (error) throw new Error(`광고 저장 실패: ${error.message}`);
      }
      const { error: updatedError } = await admin.from('advertisers').update({ last_collected_at: new Date().toISOString() }).eq('id', advertiser.id);
      if (updatedError) throw new Error(`수집 시각 갱신 실패: ${updatedError.message}`);
      results.push({ advertiserId: advertiser.id, name: advertiser.name, collected: ads.length });
    } catch (error) {
      results.push({ advertiserId: advertiser.id, name: advertiser.name, collected: 0, error: error.message || '수집에 실패했습니다.' });
    }
  }

  const collected = results.reduce((total, item) => total + item.collected, 0);
  const failed = results.filter((item) => item.error).length;
  return Response.json({ source: GOOGLE_SOURCE, country, advertisers: results.length, collected, failed, results });
}

// Vercel Cron invokes the configured route with GET.  Manual collection keeps
// using POST and administrator session authorization above.
export async function GET(request) {
  return POST(request);
}
