import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../../lib/supabase.js';

const fail = (status, error) => Response.json({ error }, { status });
const thumbnailUrl = (snapshotUrl) => snapshotUrl ? `/api/ads-library/thumbnail?url=${encodeURIComponent(snapshotUrl)}` : '';

async function requireApprovedUser(request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: '로그인이 필요합니다.' };

  const headers = { apikey: process.env.SUPABASE_ANON_KEY || SUPABASE.anonKey, Authorization: `Bearer ${token}` };
  try {
    const userResponse = await fetch(`${process.env.SUPABASE_URL || SUPABASE.url}/auth/v1/user`, { headers });
    if (!userResponse.ok) return { ok: false, status: 401, error: '로그인 세션이 만료되었습니다.' };
    const user = await userResponse.json();
    const profileResponse = await fetch(
      `${process.env.SUPABASE_URL || SUPABASE.url}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=status,role`,
      { headers },
    );
    const [profile] = profileResponse.ok ? await profileResponse.json() : [];
    if (profile?.status === 'approved' && profile?.role === 'admin') return { ok: true };
    if (profile?.status === 'approved') return { ok: false, status: 403, error: '광고 검색은 관리자만 사용할 수 있습니다.' };
    if (profile?.status !== 'approved') return { ok: false, status: 403, error: '승인된 계정만 사용할 수 있습니다.' };
    return { ok: true };
  } catch {
    return { ok: false, status: 503, error: '로그인 상태를 확인하지 못했습니다.' };
  }
}

export async function GET(request) {
  const auth = await requireApprovedUser(request);
  if (!auth.ok) return fail(auth.status, auth.error);

  const accessToken = process.env.META_AD_LIBRARY_ACCESS_TOKEN || '';
  if (!accessToken) return fail(503, '광고 라이브러리 토큰이 설정되지 않았습니다. META_AD_LIBRARY_ACCESS_TOKEN을 서버 환경변수에 추가해 주세요.');

  const query = new URL(request.url).searchParams;
  const searchTerms = (query.get('q') || '').trim().slice(0, 100);
  const country = (query.get('country') || 'KR').trim().toUpperCase();
  const after = (query.get('after') || '').trim();
  if (!/^[A-Z]{2}$/.test(country)) return fail(400, '국가 코드는 두 글자여야 합니다.');
  if (!searchTerms) return fail(400, '검색어를 입력해 주세요.');

  const version = process.env.META_AD_LIBRARY_GRAPH_VERSION || 'v24.0';
  const baseUrl = (process.env.META_AD_LIBRARY_BASE_URL || 'https://graph.facebook.com').replace(/\/$/, '');
  const url = new URL(`${baseUrl}/${version}/ads_archive`);
  const params = {
    access_token: accessToken,
    search_terms: searchTerms,
    ad_reached_countries: JSON.stringify([country]),
    ad_type: 'ALL',
    limit: '20',
    fields: 'id,ad_creation_time,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,ad_creative_link_titles,ad_delivery_start_time,ad_delivery_stop_time,ad_snapshot_url,page_id,page_name,publisher_platforms,bylines',
  };
  Object.entries({ ...params, ...(after ? { after } : {}) }).forEach(([key, value]) => url.searchParams.set(key, value));

  try {
    const response = await fetch(url, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) {
      return fail(response.status || 502, body?.error?.error_user_msg || body?.error?.message || 'Meta 광고 라이브러리를 불러오지 못했습니다.');
    }
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!serviceRoleKey) return fail(500, '광고 저장을 위한 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
    const admin = createClient(process.env.SUPABASE_URL || SUPABASE.url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const data = (body.data || []).map((ad) => ({ ...ad, thumbnail_url: thumbnailUrl(ad.ad_snapshot_url) }));
    const records = data.map((ad) => ({
      source: 'meta_ad_library', external_ad_id: String(ad.id), advertiser_name: ad.page_name || ad.bylines?.[0] || null,
      format: null, platform: Array.isArray(ad.publisher_platforms) ? ad.publisher_platforms.join(', ') : null,
      headline: ad.ad_creative_link_titles?.filter(Boolean).join(' · ') || null,
      description: ad.ad_creative_bodies?.filter(Boolean).join('\n') || ad.ad_creative_link_descriptions?.filter(Boolean).join('\n') || null,
      thumbnail_url: ad.thumbnail_url || null, source_url: ad.ad_snapshot_url || `https://www.facebook.com/ads/library/?id=${encodeURIComponent(ad.id)}`,
      last_seen_at: new Date().toISOString(), raw_data: ad,
    }));
    if (records.length) {
      const { error } = await admin.from('ads').upsert(records, { onConflict: 'source,external_ad_id' });
      if (error) return fail(500, `광고 저장에 실패했습니다: ${error.message}`);
    }
    return Response.json({ data, paging: body.paging || {}, stored: records.length });
  } catch {
    return fail(503, 'Meta 광고 라이브러리에 연결하지 못했습니다.');
  }
}
