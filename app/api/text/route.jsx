import { SUPABASE } from '../../../lib/supabase.js';
import { normalizeOpenAIUsageType, recordOpenAIUsage } from '../../../lib/openaiusage.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MODEL = process.env.TEXT_MODEL || 'gpt-5.6-terra';
const MAX_PROMPT_CHARS = 24000;
const MAX_OUTPUT_TOKENS = 6000;
const OPTIONAL_PARAMS = ['temperature', 'reasoning', 'max_output_tokens'];

const fail = (status, message) => Response.json({ error: message }, { status });

async function requireApprovedUser(request) {
  const supabaseUrl = process.env.SUPABASE_URL || SUPABASE.url || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || SUPABASE.anonKey || '';
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, message: '서버에 Supabase 설정이 없습니다.' };
  }

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, message: '로그인이 필요합니다.' };

  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
    if (!userResponse.ok) {
      return { ok: false, status: 401, message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };
    }
    const user = await userResponse.json();
    if (!user?.id) return { ok: false, status: 401, message: '로그인 정보를 확인하지 못했습니다.' };

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=status`,
      { headers },
    );
    if (!profileResponse.ok) {
      return { ok: false, status: 403, message: '승인 상태를 확인하지 못했습니다.' };
    }
    const [profile] = await profileResponse.json();
    if (profile?.status !== 'approved') {
      return { ok: false, status: 403, message: '관리자 승인이 완료된 계정만 사용할 수 있습니다.' };
    }
    return { ok: true, user, token, supabaseUrl, anonKey };
  } catch {
    return { ok: false, status: 503, message: '로그인 확인 서버에 연결하지 못했습니다.' };
  }
}

const clampOutputTokens = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return MAX_OUTPUT_TOKENS;
  return Math.min(MAX_OUTPUT_TOKENS, Math.round(number));
};

export async function POST(request) {
  const auth = await requireApprovedUser(request);
  if (!auth.ok) return fail(auth.status, auth.message);

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) return fail(503, '서버에 OPENAI_API_KEY가 설정되지 않았습니다.');

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, '요청 본문을 읽을 수 없습니다.');
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim()) return fail(400, '프롬프트가 비어 있습니다.');
  if (prompt.length > MAX_PROMPT_CHARS) {
    return fail(400, `프롬프트가 너무 깁니다 (${prompt.length}자 / 최대 ${MAX_PROMPT_CHARS}자).`);
  }

  const requestBody = {
    model: MODEL,
    input: prompt,
    reasoning: { effort: 'low' },
    max_output_tokens: clampOutputTokens(body.maxOutputTokens),
  };
  if (typeof body.system === 'string' && body.system) requestBody.instructions = body.system;
  if (Number.isFinite(Number(body.temperature))) requestBody.temperature = Number(body.temperature);

  try {
    const result = await callOpenAI(apiKey, requestBody);
    await recordOpenAIUsage({
      supabaseUrl: auth.supabaseUrl,
      anonKey: auth.anonKey,
      token: auth.token,
      userId: auth.user.id,
      type: normalizeOpenAIUsageType(body.usageType),
      model: result.model,
      responseId: result.responseId,
      usage: result.usage,
    });
    return Response.json({ text: result.text, usage: result.usage });
  } catch (error) {
    return fail(error.status || 502, error.message || 'AI 글 생성에 실패했습니다.');
  }
}

async function callOpenAI(apiKey, initialBody) {
  let body = initialBody;
  let response = await post(apiKey, body);

  for (let index = 0; index < OPTIONAL_PARAMS.length && !response.ok && response.status === 400; index++) {
    const { message, param } = await errorParts(response);
    const blamed = OPTIONAL_PARAMS.includes(param)
      ? param
      : OPTIONAL_PARAMS.find((name) => new RegExp(`\\b${name}\\b`).test(message));
    if (!blamed || !(blamed in body)) break;
    body = { ...body };
    delete body[blamed];
    response = await post(apiKey, body);
  }

  if (!response.ok) throw await openAIError(response);
  const data = await response.json();
  const text = data.output_text || findText(data);
  if (!text) {
    if (data.status === 'incomplete') throw withStatus(502, '출력 한도에 걸려 글을 완성하지 못했습니다.');
    throw withStatus(502, 'AI 응답 내용이 없습니다.');
  }
  return {
    text: String(text).trim(),
    usage: data.usage,
    model: data.model || initialBody.model,
    responseId: data.id,
  };
}

const post = (apiKey, body) => fetch(OPENAI_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify(body),
});

const withStatus = (status, message) => Object.assign(new Error(message), { status });

async function errorParts(response) {
  try {
    const body = await response.clone().json();
    return { message: body?.error?.message || '', param: body?.error?.param || '' };
  } catch {
    return { message: '', param: '' };
  }
}

async function openAIError(response) {
  const { message } = await errorParts(response);
  if (response.status === 401) return withStatus(502, '서버에 설정된 OpenAI API 키가 올바르지 않습니다.');
  if (response.status === 429) {
    return withStatus(429, 'AI 요청이 몰렸거나 크레딧이 부족합니다. 잠시 후 다시 시도해 주세요.');
  }
  return withStatus(502, `AI 글 생성에 실패했습니다 (${response.status}). ${message}`);
}

function findText(node) {
  if (!node || typeof node !== 'object') return '';
  if ((node.type === 'output_text' || node.type === 'text') && typeof node.text === 'string') return node.text;
  let output = '';
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => { output += findText(item); });
    else if (value && typeof value === 'object') output += findText(value);
  }
  return output;
}
