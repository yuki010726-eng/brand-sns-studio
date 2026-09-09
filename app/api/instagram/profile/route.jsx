import { instagramAdmin, requireInstagramConfig } from '../../../../lib/instagram-server.js';

const fail = (status, error) => Response.json({ error }, { status });

async function authenticatedUser(request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return null;
  const admin = instagramAdmin(requireInstagramConfig());
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, admin };
}

async function graphGet(path, params, accessToken, version, baseUrl) {
  const url = new URL(`${baseUrl}/${version}/${path}`);
  Object.entries({ ...params, access_token: accessToken }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw Object.assign(new Error(body?.error?.error_user_msg || body?.error?.message || 'Instagram 프로필을 불러오지 못했습니다.'), { status: response.status || 502 });
  }
  return body;
}

export async function GET(request) {
  try {
    const auth = await authenticatedUser(request);
    if (!auth) return fail(401, '로그인이 필요합니다.');

    const instagramUserId = new URL(request.url).searchParams.get('instagram_user_id') || '';
    if (!instagramUserId) return fail(400, 'Instagram 계정을 선택해 주세요.');

    const { data: connection, error } = await auth.admin.from('insta_users')
      .select('instagram_user_id,access_token,token_expires_at')
      .eq('user_id', auth.user.id)
      .eq('instagram_user_id', instagramUserId)
      .maybeSingle();
    if (error) throw error;
    if (!connection) return fail(404, '연결된 Instagram 계정을 찾을 수 없습니다.');
    if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() <= Date.now()) {
      return fail(401, 'Instagram 연결이 만료되었습니다. 계정을 다시 연결해 주세요.');
    }

    const version = process.env.META_GRAPH_VERSION || '';
    const baseUrl = (process.env.META_GRAPH_BASE_URL || 'https://graph.instagram.com').replace(/\/$/, '');
    if (!version) return fail(503, 'Instagram 서버 설정이 완료되지 않았습니다.');

    const [profile, media] = await Promise.all([
      graphGet(connection.instagram_user_id, {
        fields: 'id,user_id,username,name,biography,website,account_type,profile_picture_url,followers_count,follows_count,media_count',
      }, connection.access_token, version, baseUrl),
      graphGet(`${connection.instagram_user_id}/media`, {
        fields: 'id,media_type,media_url,thumbnail_url,permalink,timestamp', limit: '9',
      }, connection.access_token, version, baseUrl),
    ]);

    return Response.json({ profile, media: media.data || [] });
  } catch (error) {
    return fail(error.status || 503, error.message || 'Instagram 프로필을 불러오지 못했습니다.');
  }
}
