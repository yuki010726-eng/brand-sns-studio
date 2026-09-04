import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
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

const profileUrl = (request, params = {}) => {
  const url = new URL('/library/profile', request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
};

function verifiedUserId(value, secret) {
  const separator = value.lastIndexOf('.');
  if (separator < 1) return '';
  const userId = value.slice(0, separator);
  const received = value.slice(separator + 1);
  const expected = crypto.createHmac('sha256', secret).update(userId).digest('base64url');
  if (received.length !== expected.length) return '';
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected)) ? userId : '';
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const savedState = request.cookies.get('instagram_oauth_state')?.value || '';
  const rawIntent = request.cookies.get('instagram_oauth_intent')?.value;
  const intent = rawIntent === 'signup' ? 'signup' : rawIntent === 'connect' ? 'connect' : 'login';
  const connectingUserCookie = request.cookies.get('instagram_oauth_user_id')?.value || '';
  console.log(
    '[instagram-debug] callback hit',
    'fullUrl:', request.url,
    'codePrefix:', code.slice(0, 12),
    'codeLength:', code.length,
    'stateMatches:', Boolean(savedState) && state === savedState,
    'at:', new Date().toISOString(),
  );
  if (!code || !state || !savedState || state !== savedState) {
    const target = intent === 'connect' ? profileUrl : loginUrl;
    return NextResponse.redirect(target(request, { instagram_error: 'Instagram 인증 요청이 만료되었거나 올바르지 않습니다.' }));
  }

  try {
    const config = requireInstagramConfig();
    const connectingUserId = intent === 'connect' ? verifiedUserId(connectingUserCookie, config.appSecret) : '';
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

    if (intent === 'connect' && !connectingUserId) throw new Error('앱 로그인 정보가 만료되었습니다. 다시 연결해 주세요.');
    if (intent === 'connect' && existing?.user_id && existing.user_id !== connectingUserId) {
      throw new Error('이 Instagram 계정은 다른 사용자에게 이미 연결되어 있습니다.');
    }
    if (existing?.user_id && intent === 'signup') {
      const response = NextResponse.redirect(loginUrl(request, { instagram_already_registered: '1' }));
      response.cookies.delete('instagram_oauth_state');
      response.cookies.delete('instagram_oauth_intent');
      return response;
    }

    if (!existing?.user_id && intent === 'login') {
      const response = NextResponse.redirect(loginUrl(request, { instagram_signup_required: '1' }));
      response.cookies.delete('instagram_oauth_state');
      response.cookies.delete('instagram_oauth_intent');
      return response;
    }

    let userId = intent === 'connect' ? connectingUserId : existing?.user_id;
    const syntheticEmail = `instagram_${profile.instagramUserId}@users.invalid`;
    // 로그인 링크는 이메일로만 만들 수 있다. userId 가 연결된 실제 계정(다른 이메일)일 수 있으므로
    // syntheticEmail 을 그대로 쓰면 안 되고, 그 userId 의 실제 이메일을 반드시 다시 조회한다.
    let loginEmail = syntheticEmail;
    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: { name: profile.username, auth_provider: 'instagram' },
      });
      if (error) throw error;
      userId = created.user.id;
      loginEmail = created.user.email || syntheticEmail;
    } else {
      const { data: found, error: getUserError } = await admin.auth.admin.getUserById(userId);
      if (getUserError) throw getUserError;
      loginEmail = found?.user?.email || syntheticEmail;
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

    if (intent === 'connect') {
      const response = NextResponse.redirect(new URL('/library/profile?instagram=connected', request.url));
      response.cookies.delete('instagram_oauth_state');
      response.cookies.delete('instagram_oauth_intent');
      response.cookies.delete('instagram_oauth_user_id');
      return response;
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
      options: { redirectTo: new URL('/login', request.url).toString() },
    });
    if (linkError || !link?.properties?.hashed_token) throw linkError || new Error('사이트 로그인 링크를 만들지 못했습니다.');

    const complete = new URL('/login/instagram/complete', request.url);
    complete.searchParams.set('token_hash', link.properties.hashed_token);
    const response = NextResponse.redirect(complete);
    response.cookies.delete('instagram_oauth_state');
    response.cookies.delete('instagram_oauth_intent');
    response.cookies.delete('instagram_oauth_user_id');
    return response;
  } catch (error) {
    const target = intent === 'connect' ? profileUrl : loginUrl;
    const response = NextResponse.redirect(target(request, { instagram_error: error.message || 'Instagram 로그인에 실패했습니다.' }));
    response.cookies.delete('instagram_oauth_state');
    response.cookies.delete('instagram_oauth_intent');
    response.cookies.delete('instagram_oauth_user_id');
    return response;
  }
}
