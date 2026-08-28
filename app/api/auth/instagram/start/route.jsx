import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { instagramAdmin, requireInstagramConfig } from '../../../../../lib/instagram-server.js';

function instagramAuthorizeUrl(config, state) {
  const authorize = new URL('https://www.instagram.com/oauth/authorize');
  authorize.search = new URLSearchParams({
    enable_fb_login: '0', force_authentication: '1', client_id: config.appId,
    redirect_uri: config.redirectUri, response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_content_publish', state,
  });
  return authorize;
}

function setOAuthCookies(response, state, intent, userId = '') {
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 };
  response.cookies.set('instagram_oauth_state', state, options);
  response.cookies.set('instagram_oauth_intent', intent, options);
  if (userId) response.cookies.set('instagram_oauth_user_id', userId, options);
  return response;
}

function signedUserId(userId, secret) {
  const signature = crypto.createHmac('sha256', secret).update(userId).digest('base64url');
  return `${userId}.${signature}`;
}

export async function POST(request) {
  try {
    const config = requireInstagramConfig();
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const admin = instagramAdmin(config);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const state = crypto.randomBytes(32).toString('base64url');
    const response = NextResponse.json({ url: instagramAuthorizeUrl(config, state).toString() });
    return setOAuthCookies(response, state, 'connect', signedUserId(data.user.id, config.appSecret));
  } catch (error) {
    return Response.json({ error: error.message || 'Instagram 연결을 시작하지 못했습니다.' }, { status: 503 });
  }
}

export async function GET(request) {
  try {
    const intent = new URL(request.url).searchParams.get('intent') === 'signup' ? 'signup' : 'login';
    const config = requireInstagramConfig();
    const state = crypto.randomBytes(32).toString('base64url');
    const authorize = instagramAuthorizeUrl(config, state);
    const response = NextResponse.redirect(authorize);
    return setOAuthCookies(response, state, intent);
  } catch (error) {
    return NextResponse.redirect(new URL(`/login?instagram_error=${encodeURIComponent(error.message)}`, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }
}
