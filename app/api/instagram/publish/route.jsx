import { SUPABASE } from '../../../../lib/supabase.js';
import { instagramAdmin, requireInstagramConfig } from '../../../../lib/instagram-server.js';

const fail = (status, error) => Response.json({ error }, { status });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requireApprovedUser(request) {
  const supabaseUrl = process.env.SUPABASE_URL || SUPABASE.url || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || SUPABASE.anonKey || '';
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!supabaseUrl || !anonKey || !token) return { ok: false, status: 401, error: '로그인이 필요합니다.' };
  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  try {
    const who = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
    if (!who.ok) return { ok: false, status: 401, error: '로그인이 만료되었습니다.' };
    const user = await who.json();
    const profile = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=status`, { headers });
    const [row] = profile.ok ? await profile.json() : [];
    if (row?.status !== 'approved') return { ok: false, status: 403, error: '승인된 계정만 게시할 수 있습니다.' };
    return { ok: true, user };
  } catch {
    return { ok: false, status: 503, error: '로그인 상태를 확인하지 못했습니다.' };
  }
}

async function graph(path, params, accessToken, version, baseUrl) {
  const response = await fetch(`${baseUrl}/${version}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, access_token: accessToken }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    const message = body?.error?.error_user_msg || body?.error?.message || 'Meta API 요청에 실패했습니다.';
    throw Object.assign(new Error(message), { status: response.status || 502 });
  }
  return body;
}

async function waitUntilReady(containerId, accessToken, version, baseUrl) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch(`${baseUrl}/${version}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`);
    const body = await response.json().catch(() => ({}));
    if (body.status_code === 'FINISHED') return;
    if (body.status_code === 'ERROR' || body.status_code === 'EXPIRED') {
      throw new Error(body.status || 'Instagram이 게시 이미지를 처리하지 못했습니다.');
    }
    await sleep(1000);
  }
  throw new Error('Instagram 이미지 처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
}

export async function POST(request) {
  const auth = await requireApprovedUser(request);
  if (!auth.ok) return fail(auth.status, auth.error);

  const version = process.env.META_GRAPH_VERSION || '';
  const baseUrl = (process.env.META_GRAPH_BASE_URL || 'https://graph.instagram.com').replace(/\/$/, '');
  if (!version) {
    return fail(503, 'Instagram 서버 설정이 완료되지 않았습니다.');
  }

  let connection;
  try {
    const admin = instagramAdmin(requireInstagramConfig());
    const { data, error } = await admin
      .from('insta_users')
      .select('instagram_user_id,access_token,token_expires_at')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error) throw error;
    connection = data;
  } catch (error) {
    return fail(503, error.message || 'Instagram 연결 정보를 확인하지 못했습니다.');
  }
  if (!connection) return fail(409, '연결된 Instagram 계정이 없습니다. 다시 연결해 주세요.');
  if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() <= Date.now()) {
    return fail(401, 'Instagram 연결이 만료되었습니다. 계정을 다시 연결해 주세요.');
  }
  const accessToken = connection.access_token;
  const accountId = connection.instagram_user_id;

  let body;
  try { body = await request.json(); } catch { return fail(400, '요청을 읽을 수 없습니다.'); }
  const imageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls.filter((url) => /^https:\/\//.test(url)) : [];
  const caption = typeof body?.caption === 'string' ? body.caption.trim() : '';
  if (!imageUrls.length || imageUrls.length > 10) return fail(400, '이미지는 1장 이상 10장 이하여야 합니다.');
  if (caption.length > 2200) return fail(400, '캡션은 2,200자 이하여야 합니다.');

  try {
    if (imageUrls.length === 1) {
      const container = await graph(`${accountId}/media`, { image_url: imageUrls[0], caption }, accessToken, version, baseUrl);
      await waitUntilReady(container.id, accessToken, version, baseUrl);
      const published = await graph(`${accountId}/media_publish`, { creation_id: container.id }, accessToken, version, baseUrl);
      return Response.json({ id: published.id });
    }

    const childIds = [];
    for (const imageUrl of imageUrls) {
      const child = await graph(`${accountId}/media`, { image_url: imageUrl, is_carousel_item: 'true' }, accessToken, version, baseUrl);
      await waitUntilReady(child.id, accessToken, version, baseUrl);
      childIds.push(child.id);
    }
    const carousel = await graph(`${accountId}/media`, {
      media_type: 'CAROUSEL', children: childIds.join(','), caption,
    }, accessToken, version, baseUrl);
    await waitUntilReady(carousel.id, accessToken, version, baseUrl);
    const published = await graph(`${accountId}/media_publish`, { creation_id: carousel.id }, accessToken, version, baseUrl);
    return Response.json({ id: published.id });
  } catch (error) {
    return fail(error.status || 502, error.message || 'Instagram 게시에 실패했습니다.');
  }
}
