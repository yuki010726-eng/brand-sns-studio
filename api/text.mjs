/**
 * 글귀 생성 프록시 — 키는 여기서만 쓰이고 브라우저로 나가지 않는다
 *
 * 요청: POST { provider, model, prompt, system, temperature, maxOutputTokens }
 * 응답: { text, usage }
 *
 * `usage` 를 그대로 돌려주는 이유: tools/bench.html 이 **실제 토큰 사용량**으로 비용을 잰다.
 * 글자 수로 어림하면 추론 토큰을 놓친다.
 */
import {
  ALLOWED_TEXT_MODELS, DEFAULT_TEXT_MODEL, requirePost, requireApprovedUser,
  readPrompt, pickModel, clampOutputTokens, providerOf, keyFor, fail, json,
} from './_shared.mjs';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/**
 * 추론 강도. 추론 토큰은 출력 요금으로 과금되므로 서버에서 못박는다.
 * lib/openai.js 와 같은 값을 쓴다 — 한쪽만 바꾸면 로컬과 배포본의 비용이 달라진다.
 */
const REASONING_EFFORT = 'low';

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;

  const auth = await requireApprovedUser(req);
  if (!auth.ok) return fail(res, auth.status, auth.message);

  const body = req.body || {};
  const provider = providerOf(body);

  const key = keyFor(provider);
  if (!key) return fail(res, 503, `서버에 ${provider === 'gemini' ? 'GEMINI' : 'OPENAI'}_API_KEY 가 설정되지 않았습니다.`);

  const prompt = readPrompt(body);
  if (!prompt.ok) return fail(res, 400, prompt.message);

  const model = pickModel(body.model, ALLOWED_TEXT_MODELS, DEFAULT_TEXT_MODEL);
  if (!model.ok) return fail(res, 400, model.message);

  const maxOutputTokens = clampOutputTokens(body.maxOutputTokens);
  const system = typeof body.system === 'string' ? body.system : '';
  const temperature = Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : undefined;

  try {
    const out = provider === 'gemini'
      ? await callGemini({ key, model: model.value, prompt: prompt.value, system, temperature, maxOutputTokens })
      : await callOpenAI({ key, model: model.value, prompt: prompt.value, system, temperature, maxOutputTokens });
    return json(res, 200, out);
  } catch (e) {
    // 벤더 오류 메시지에 키가 섞여 나올 일은 없지만, 상태 코드는 그대로 전해 원인을 알 수 있게 한다
    return fail(res, e.status || 502, e.message || '글 생성에 실패했습니다.');
  }
}

/** 모델이 안 받는 선택 파라미터는 빼고 다시 보낸다 (lib/openai.js 와 같은 규칙) */
const OPTIONAL = ['temperature', 'reasoning', 'max_output_tokens'];

async function callOpenAI({ key, model, prompt, system, temperature, maxOutputTokens }) {
  const base = { model, input: prompt, reasoning: { effort: REASONING_EFFORT }, max_output_tokens: maxOutputTokens };
  if (system) base.instructions = system;
  if (temperature !== undefined) base.temperature = temperature;

  let body = base;
  let res = await post(OPENAI_URL, { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body);

  for (let i = 0; i < OPTIONAL.length && !res.ok && res.status === 400; i++) {
    const { message, param } = await errorParts(res);
    const blamed = OPTIONAL.includes(param) ? param : OPTIONAL.find((p) => new RegExp(`\\b${p}\\b`).test(message));
    if (!blamed || !(blamed in body)) break;
    body = { ...body };
    delete body[blamed];
    res = await post(OPENAI_URL, { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body);
  }

  const data = await ensureOk(res, '글 생성');
  const text = data.output_text || findText(data);
  if (!text) {
    if (data.status === 'incomplete') throw withStatus(502, '출력 상한에 걸려 글이 완성되지 않았습니다.');
    throw withStatus(502, '응답에 글이 없습니다.');
  }
  return { text: String(text).trim(), usage: data.usage || null };
}

async function callGemini({ key, model, prompt, system, temperature, maxOutputTokens }) {
  const body = {
    model,
    input: prompt,
    generation_config: { temperature: temperature ?? 0.9, max_output_tokens: maxOutputTokens },
  };
  if (system) body.system_instruction = system;

  const res = await post(GEMINI_URL, { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body);
  const data = await ensureOk(res, '글 생성');
  const text = data.output_text || findText(data);
  if (!text) throw withStatus(502, '응답에 글이 없습니다. 안전 필터에 걸렸을 수 있습니다.');
  return { text: String(text).trim(), usage: data.usage || data.usage_metadata || data.usageMetadata || null };
}

/* ---------------- 공통 ---------------- */

const post = (url, headers, body) => fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

const withStatus = (status, message) => Object.assign(new Error(message), { status });

async function errorParts(res) {
  try {
    const j = await res.clone().json();
    return { message: j?.error?.message || '', param: j?.error?.param || '' };
  } catch {
    return { message: '', param: '' };
  }
}

async function ensureOk(res, what) {
  if (res.ok) return res.json();
  const { message } = await errorParts(res);
  if (res.status === 401) throw withStatus(502, '서버에 설정된 API 키가 올바르지 않습니다. 관리자에게 알려 주세요.');
  if (res.status === 429) throw withStatus(429, '요청이 몰렸거나 크레딧이 부족합니다. 잠시 후 다시 시도해 주세요.');
  throw withStatus(502, `${what}에 실패했습니다 (${res.status}). ${message}`);
}

/** output_text 가 없을 때 중첩 구조를 훑는다 (lib/openai.js·gemini.js 와 같은 방식) */
function findText(node) {
  if (!node || typeof node !== 'object') return '';
  if ((node.type === 'output_text' || node.type === 'text') && typeof node.text === 'string') return node.text;
  let out = '';
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const v of value) out += findText(v);
    else if (value && typeof value === 'object') out += findText(value);
  }
  return out;
}
