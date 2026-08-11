/**
 * 서버 프록시 공용 코드 (PART 2)
 *
 * 왜 서버가 생겼나
 * PART 1 에서는 브라우저가 OpenAI·Gemini 를 **직접** 불렀다. 키가 localStorage 에 있어서
 * 개발자 도구를 열면 누구나 꺼내 쓸 수 있었고, 그래서 "개인·내부용 로컬 실행 전용"이었다.
 * 배포하려면 키가 서버에만 있어야 한다. 이 폴더가 그 역할이다.
 *
 * ⚠️ **빌드 도구를 쓰지 않는다는 원칙은 그대로다.** 그래서 package.json 을 만들지 않고
 *    `.mjs` 확장자로 ESM 을 쓴다. npm install 이 필요한 의존성은 하나도 없다 —
 *    Node 18+ 의 내장 fetch 만 쓴다.
 *
 * ⚠️ 파일 이름이 `_` 로 시작하면 Vercel 이 엔드포인트로 만들지 않는다. 공용 코드는 반드시 `_` 로 시작할 것.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

/**
 * 부를 수 있는 모델을 못박는다.
 *
 * ⚠️ 이게 없으면 **누구든 요청 본문에 비싼 모델을 적어 넣을 수 있다.** 키가 서버에 있으므로
 *    그 비용은 전부 우리가 낸다. 화면에서 고를 수 있는 것만 여기 둔다.
 */
/** ⚠️ Luna 는 뺐다 — Terra 이상만 쓴다. lib/openai.js 의 `TEXT_MODELS` 와 같이 유지할 것. */
export const ALLOWED_TEXT_MODELS = ['gpt-5.6-terra', 'gpt-5.6-sol', 'gemini-3.6-flash', 'gemini-2.5-pro', 'gemini-3.5-flash-lite'];
export const ALLOWED_IMAGE_MODELS = ['gpt-image-1-mini', 'gpt-image-2', 'dall-e-3', 'gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image', 'gemini-3-pro-image'];

/** 벤치마크에서 고르지 않으면 이걸 쓴다 (요청자 결정 2026-08-10: 전 채널 Terra) */
export const DEFAULT_TEXT_MODEL = process.env.TEXT_MODEL || 'gpt-5.6-terra';

/**
 * 서버가 강제하는 상한. **클라이언트가 올릴 수 없다.**
 * 브라우저 값을 그대로 믿으면 상한을 두는 의미가 없다 — 요청 본문은 누구나 고칠 수 있다.
 */
export const MAX_PROMPT_CHARS = 24000;   // 실측 최대 5,300자(블로그) 대비 넉넉히
export const MAX_OUTPUT_TOKENS = 6000;   // 채널 최대 4,500 + 추론 여유

export const json = (res, status, body) => res.status(status).json(body);
export const fail = (res, status, message) => json(res, status, { error: message });

/** POST 만 받는다. GET 으로 프롬프트가 주소창·로그에 남는 것을 막는다. */
export function requirePost(req, res) {
  if (req.method === 'POST') return true;
  res.setHeader('Allow', 'POST');
  fail(res, 405, 'POST 로만 요청할 수 있습니다.');
  return false;
}

/**
 * 승인된 계정인지 확인한다.
 *
 * ⚠️ **이 관문이 없으면 주소를 아는 사람 누구나 우리 크레딧을 쓸 수 있다.**
 *    화면에서 로그인을 막는 것으로는 부족하다 — 서버 주소는 그냥 부르면 된다.
 *
 * 호출자의 토큰을 그대로 Supabase 에 되물어 확인한다. 그래서 **service_role 키가 필요 없다** —
 * users 테이블은 RLS 로 '자기 행만 읽기'가 열려 있고, 그 권한으로 status 를 읽는다.
 * service_role 키를 서버에 두지 않는 편이 사고 시 피해가 훨씬 작다.
 *
 * 결과를 캐시하지 않는다. 관리자가 승인을 취소하면 **다음 요청부터 바로** 막혀야 한다.
 * 확인에 드는 시간은 100ms 안팎이고, 뒤이을 생성 호출이 20초라 의미 있는 비용이 아니다.
 */
export async function requireApprovedUser(req) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, status: 500, message: '서버에 Supabase 설정(SUPABASE_URL / SUPABASE_ANON_KEY)이 없습니다.' };
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, message: '로그인이 필요합니다.' };

  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };

  let user;
  try {
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
    if (!who.ok) return { ok: false, status: 401, message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };
    user = await who.json();
  } catch {
    return { ok: false, status: 503, message: '로그인 확인 서버에 연결하지 못했습니다.' };
  }
  if (!user?.id) return { ok: false, status: 401, message: '로그인 정보를 확인하지 못했습니다.' };

  let row;
  try {
    const q = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=status`, { headers });
    if (!q.ok) return { ok: false, status: 403, message: '승인 상태를 확인하지 못했습니다.' };
    [row] = await q.json();
  } catch {
    return { ok: false, status: 503, message: '승인 상태 확인에 실패했습니다.' };
  }

  // 조회 실패나 행 누락을 승인으로 취급하지 않는다 (lib/auth.js 와 같은 원칙)
  if (row?.status !== 'approved') {
    return { ok: false, status: 403, message: '관리자 승인이 완료된 계정만 사용할 수 있습니다.' };
  }
  return { ok: true, user };
}

/** 프롬프트를 검사한다. 길이 상한은 비용 상한이기도 하다. */
export function readPrompt(body, field = 'prompt') {
  const value = typeof body?.[field] === 'string' ? body[field] : '';
  if (!value.trim()) return { ok: false, message: '프롬프트가 비어 있습니다.' };
  if (value.length > MAX_PROMPT_CHARS) {
    return { ok: false, message: `프롬프트가 너무 깁니다 (${value.length}자 / 상한 ${MAX_PROMPT_CHARS}자).` };
  }
  return { ok: true, value };
}

/** 허용 목록에 없으면 거절한다. 조용히 기본값으로 바꾸지 않는다 — 다른 모델이 쓰인 걸 모르면 안 된다. */
export function pickModel(requested, allowed, fallback) {
  if (!requested) return { ok: true, value: fallback };
  if (allowed.includes(requested)) return { ok: true, value: requested };
  return { ok: false, message: `허용되지 않은 모델입니다: ${String(requested).slice(0, 40)}` };
}

export const clampOutputTokens = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return MAX_OUTPUT_TOKENS;
  return Math.min(MAX_OUTPUT_TOKENS, Math.round(v));
};

export const providerOf = (body) => (body?.provider === 'gemini' ? 'gemini' : 'openai');

export const keyFor = (provider) =>
  (provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY) || '';
