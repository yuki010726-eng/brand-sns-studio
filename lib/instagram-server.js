import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from './supabase.js';

export function instagramConfig() {
  const appId = process.env.INSTAGRAM_APP_ID || '';
  const appSecret = process.env.INSTAGRAM_APP_SECRET || '';
  const redirectUri = process.env.INSTAGRAM_OAUTH_REDIRECT_URI || '';
  const supabaseUrl = process.env.SUPABASE_URL || SUPABASE.url || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { appId, appSecret, redirectUri, supabaseUrl, serviceRoleKey };
}

export function requireInstagramConfig() {
  const config = instagramConfig();
  const labels = {
    appId: 'INSTAGRAM_APP_ID',
    appSecret: 'INSTAGRAM_APP_SECRET',
    redirectUri: 'INSTAGRAM_OAUTH_REDIRECT_URI',
    supabaseUrl: 'SUPABASE_URL',
    serviceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => labels[key]);
  if (missing.length) throw new Error(`Instagram OAuth 서버 설정이 없습니다: ${missing.join(', ')}`);
  try {
    const redirect = new URL(config.redirectUri);
    if (!['http:', 'https:'].includes(redirect.protocol)) throw new Error();
  } catch {
    throw new Error('INSTAGRAM_OAUTH_REDIRECT_URI 주소 형식이 올바르지 않습니다.');
  }
  return config;
}

export const instagramAdmin = ({ supabaseUrl, serviceRoleKey }) => createClient(
  supabaseUrl,
  serviceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

export async function exchangeInstagramCode(code, config) {
  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
      code,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(body?.error_message || 'Instagram 인증 코드를 교환하지 못했습니다.');
  return body;
}

export async function exchangeLongLivedToken(shortToken, config) {
  const url = new URL('https://graph.instagram.com/access_token');
  url.search = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: config.appSecret,
    access_token: shortToken,
  });
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(body?.error?.message || 'Instagram 장기 토큰을 발급하지 못했습니다.');
  return body;
}

export async function getInstagramProfile(accessToken) {
  const url = new URL('https://graph.instagram.com/me');
  url.search = new URLSearchParams({
    fields: 'user_id,username,account_type,profile_picture_url',
    access_token: accessToken,
  });
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !(body.user_id || body.id)) throw new Error(body?.error?.message || 'Instagram 계정 정보를 가져오지 못했습니다.');
  return { ...body, instagramUserId: String(body.user_id || body.id) };
}
