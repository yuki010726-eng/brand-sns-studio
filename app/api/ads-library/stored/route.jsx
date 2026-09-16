import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../../../lib/supabase.js';

const fail = (status, error) => Response.json({ error }, { status });
const settings = () => ({ url: (process.env.SUPABASE_URL || SUPABASE.url || '').trim(), anonKey: (process.env.SUPABASE_ANON_KEY || SUPABASE.anonKey || '').trim(), serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim() });
const thumbnailUrl = (snapshotUrl) => snapshotUrl ? `/api/ads-library/thumbnail?url=${encodeURIComponent(snapshotUrl)}` : '';

async function requireApprovedUser(request, config) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { status: 401, error: '로그인이 필요합니다.' };
  const headers = { apikey: config.anonKey, Authorization: `Bearer ${token}` };
  try {
    const userResponse = await fetch(`${config.url}/auth/v1/user`, { headers });
    if (!userResponse.ok) return { status: 401, error: '로그인 세션이 만료되었습니다.' };
    const user = await userResponse.json();
    const profileResponse = await fetch(`${config.url}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=status`, { headers });
    const [profile] = profileResponse.ok ? await profileResponse.json() : [];
    return profile?.status === 'approved' ? { ok: true } : { status: 403, error: '승인된 계정만 사용할 수 있습니다.' };
  } catch { return { status: 503, error: '로그인 상태를 확인하지 못했습니다.' }; }
}

function asMeta(ad) {
  const raw = ad.raw_data || {};
  return { id: ad.id, category: ad.advertisers?.category || '', page_name: ad.advertiser_name, ad_creative_bodies: ad.description ? [ad.description] : [], ad_creative_link_titles: ad.headline ? [ad.headline] : [], ad_delivery_start_time: raw.ad_delivery_start_time || ad.first_seen_at, ad_delivery_stop_time: raw.ad_delivery_stop_time || '', ad_snapshot_url: ad.source_url, thumbnail_url: ad.thumbnail_url || thumbnailUrl(ad.source_url), publisher_platforms: Array.isArray(raw.publisher_platforms) ? raw.publisher_platforms : (ad.platform ? [ad.platform] : []), bylines: [] };
}
function asGoogle(ad) {
  const raw = ad.raw_data || {};
  return { id: ad.id, category: ad.advertisers?.category || '', advertiser: ad.advertiser_name || '', firstShown: raw.first_shown_date || raw.first_shown || ad.first_seen_at, lastShown: raw.last_shown_date || raw.last_shown || ad.last_seen_at, text: ad.description || ad.headline || '', format: ad.format || '', image: ad.thumbnail_url || '', url: ad.source_url };
}

export async function GET(request) {
  const config = settings();
  if (!config.url || !config.anonKey || !config.serviceRoleKey) return fail(500, 'Supabase 서버 설정이 필요합니다.');
  const auth = await requireApprovedUser(request, config);
  if (!auth.ok) return fail(auth.status, auth.error);
  const platform = new URL(request.url).searchParams.get('platform') === 'google' ? 'google' : 'meta';
  const source = platform === 'google' ? 'google_ads_transparency' : 'meta_ad_library';
  const admin = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const pageSize = 1000;
  const data = [];
  let error;
  let from = 0;
  while (true) {
    const { data: page, error } = await admin.from('ads').select('*, advertisers(category)').eq('source', source).order('last_seen_at', { ascending: false }).range(from, from + pageSize - 1);
    if (error) return fail(500, `Failed to load stored ads: ${error.message}`);
    data.push(...(page || []));
    if (!page || page.length < pageSize) break;
    from += pageSize;
  }
  if (error) return fail(500, `저장된 광고를 불러오지 못했습니다: ${error.message}`);
  return Response.json({ data: (data || []).map(platform === 'google' ? asGoogle : asMeta) });
}
