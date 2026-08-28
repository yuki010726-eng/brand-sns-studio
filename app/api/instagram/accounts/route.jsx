import { instagramAdmin, requireInstagramConfig } from '../../../../lib/instagram-server.js';

const fail = (status, error) => Response.json({ error }, { status });

async function authenticatedUser(request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return null;
  const admin = instagramAdmin(requireInstagramConfig());
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return { user: data.user, admin };
}

export async function GET(request) {
  try {
    const auth = await authenticatedUser(request);
    if (!auth?.user) return fail(401, '로그인이 필요합니다.');
    const { data, error } = await auth.admin.from('insta_users')
      .select('instagram_user_id,username,account_type,profile_picture_url,token_expires_at,created_at')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return Response.json({ accounts: data || [] });
  } catch (error) {
    return fail(503, error.message || 'Instagram 연결 정보를 불러오지 못했습니다.');
  }
}

export async function DELETE(request) {
  try {
    const auth = await authenticatedUser(request);
    if (!auth?.user) return fail(401, '로그인이 필요합니다.');
    const id = new URL(request.url).searchParams.get('instagram_user_id') || '';
    if (!id) return fail(400, '연결 해제할 계정이 없습니다.');
    const { error } = await auth.admin.from('insta_users')
      .delete().eq('user_id', auth.user.id).eq('instagram_user_id', id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return fail(503, error.message || 'Instagram 계정 연결을 해제하지 못했습니다.');
  }
}
