/**
 * 사용자가 연결해 둔 네이버 블로그 계정 메타데이터(blogId·별명)를 관리한다.
 *
 * ⚠️ **로그인 세션(쿠키)은 이 라우트가 다루지 않는다.** 여기서 하는 일은 "이 사용자가
 *    어떤 blogId를 쓸 수 있다고 등록했는가"뿐이다. 실제로 그 블로그에 자동으로 채워
 *    넣으려면 `.naver-profile/{id}/`에 그 계정으로 로그인한 세션이 따로 있어야 하고,
 *    그건 `npm run naver:setup -- {id}`로 사람이 직접 로그인해야 생긴다
 *    (`lib/naverPublish.js`·`supabase/026_create_naver_accounts.sql` 참고).
 * ⚠️ `naver_accounts` 테이블은 RLS는 켜져 있지만 정책이 없다(`insta_users`와 같은
 *    패턴) — anon/authenticated 클라이언트는 직접 접근할 수 없고, 이 라우트가
 *    service_role로 조회한 뒤 `user_id` 조건으로 직접 걸러낸다.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../../../lib/supabase.js';

const fail = (status, error) => Response.json({ error }, { status });

async function requireApprovedUser(request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: '로그인이 필요합니다.' };

  const supabaseUrl = process.env.SUPABASE_URL || SUPABASE.url;
  const anonKey = process.env.SUPABASE_ANON_KEY || SUPABASE.anonKey;
  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
    if (!userResponse.ok) return { ok: false, status: 401, error: '로그인 세션이 만료되었습니다.' };
    const user = await userResponse.json();
    if (!user?.id) return { ok: false, status: 401, error: '로그인 정보를 확인하지 못했습니다.' };

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=status`,
      { headers },
    );
    const [profile] = profileResponse.ok ? await profileResponse.json() : [];
    if (profile?.status !== 'approved') return { ok: false, status: 403, error: '승인된 계정만 사용할 수 있습니다.' };
    return { ok: true, userId: user.id };
  } catch {
    return { ok: false, status: 503, error: '로그인 상태를 확인하지 못했습니다.' };
  }
}

function adminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  return createClient(process.env.SUPABASE_URL || SUPABASE.url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// 네이버 아이디 형식을 엄격히 검증하진 않는다(정확한 규칙을 우리가 보장할 수 없다) — 다만
// 이 값이 나중에 URL 파라미터로 쓰이므로(`writeUrl(blogId)`) 공백·특수문자만 막아 둔다.
const BLOG_ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;

export async function GET(request) {
  const auth = await requireApprovedUser(request);
  if (!auth.ok) return fail(auth.status, auth.error);
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from('naver_accounts')
      .select('id,blog_id,label,created_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return Response.json({ accounts: data || [] });
  } catch (error) {
    return fail(503, error.message || '네이버 계정 목록을 불러오지 못했습니다.');
  }
}

export async function POST(request) {
  const auth = await requireApprovedUser(request);
  if (!auth.ok) return fail(auth.status, auth.error);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, '요청 내용을 읽지 못했습니다.');
  }
  const blogId = typeof body?.blogId === 'string' ? body.blogId.trim() : '';
  const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 60) : '';
  if (!blogId) return fail(400, '네이버 블로그 아이디를 입력해 주세요.');
  if (!BLOG_ID_RE.test(blogId)) return fail(400, '블로그 아이디에 공백이나 특수문자를 쓸 수 없습니다.');

  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from('naver_accounts')
      .insert({ user_id: auth.userId, blog_id: blogId, label: label || blogId })
      .select('id,blog_id,label,created_at')
      .single();
    if (error) {
      if (error.code === '23505') return fail(409, '이미 등록된 블로그 아이디입니다.');
      throw error;
    }
    return Response.json({ account: data });
  } catch (error) {
    return fail(503, error.message || '네이버 계정을 등록하지 못했습니다.');
  }
}

export async function DELETE(request) {
  const auth = await requireApprovedUser(request);
  if (!auth.ok) return fail(auth.status, auth.error);

  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return fail(400, '삭제할 계정이 없습니다.');

  try {
    const admin = adminClient();
    const { error } = await admin.from('naver_accounts').delete().eq('id', id).eq('user_id', auth.userId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return fail(503, error.message || '네이버 계정을 삭제하지 못했습니다.');
  }
}
