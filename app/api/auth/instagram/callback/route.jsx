import { NextResponse } from 'next/server';
import {
  exchangeInstagramCode,
  exchangeLongLivedToken,
  getInstagramProfile,
  instagramAdmin,
  requireInstagramConfig,
} from '../../../../../lib/instagram-server.js';

const loginUrl = (request, params = {}) => {
  const url = new URL('/login', request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
};

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const savedState = request.cookies.get('instagram_oauth_state')?.value || '';
  console.log(
    '[instagram-debug] callback hit',
    'fullUrl:', request.url,
    'codePrefix:', code.slice(0, 12),
    'codeLength:', code.length,
    'stateMatches:', Boolean(savedState) && state === savedState,
    'at:', new Date().toISOString(),
  );
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(loginUrl(request, { instagram_error: 'Instagram 인증 요청이 만료되었거나 올바르지 않습니다.' }));
  }

  try {
    const config = requireInstagramConfig();
    const short = await exchangeInstagramCode(code, config);
    const long = await exchangeLongLivedToken(short.access_token, config);
    const profile = await getInstagramProfile(long.access_token);
    const admin = instagramAdmin(config);

    const { data: existing, error: lookupError } = await admin
      .from('insta_users')
      .select('user_id')
      .eq('instagram_user_id', profile.instagramUserId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    let userId = existing?.user_id;
    const syntheticEmail = `instagram_${profile.instagramUserId}@users.invalid`;
    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: { name: profile.username, auth_provider: 'instagram' },
      });
      if (error) throw error;
      userId = created.user.id;
    }

    const expiresAt = new Date(Date.now() + Number(long.expires_in || 0) * 1000).toISOString();
    const { error: saveError } = await admin.from('insta_users').upsert({
      user_id: userId,
      instagram_user_id: profile.instagramUserId,
      username: profile.username || '',
      account_type: profile.account_type || '',
      profile_picture_url: profile.profile_picture_url || '',
      access_token: long.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'instagram_user_id' });
    if (saveError) throw saveError;

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: syntheticEmail,
      options: { redirectTo: new URL('/login', request.url).toString() },
    });
    if (linkError || !link?.properties?.hashed_token) throw linkError || new Error('사이트 로그인 링크를 만들지 못했습니다.');

    const complete = new URL('/login/instagram/complete', request.url);
    complete.searchParams.set('token_hash', link.properties.hashed_token);
    const response = NextResponse.redirect(complete);
    response.cookies.delete('instagram_oauth_state');
    return response;
  } catch (error) {
    const response = NextResponse.redirect(loginUrl(request, { instagram_error: error.message || 'Instagram 로그인에 실패했습니다.' }));
    response.cookies.delete('instagram_oauth_state');
    return response;
  }
}
