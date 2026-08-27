import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireInstagramConfig } from '../../../../../lib/instagram-server.js';

export async function GET() {
  try {
    const config = requireInstagramConfig();
    const state = crypto.randomBytes(32).toString('base64url');
    const authorize = new URL('https://www.instagram.com/oauth/authorize');
    authorize.search = new URLSearchParams({
      enable_fb_login: '0',
      force_authentication: '1',
      client_id: config.appId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'instagram_business_basic,instagram_business_content_publish',
      state,
    });
    const response = NextResponse.redirect(authorize);
    response.cookies.set('instagram_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL(`/login?instagram_error=${encodeURIComponent(error.message)}`, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }
}
