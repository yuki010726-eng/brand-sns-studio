/**
 * 이미지 생성 프록시
 *
 * 요청: POST { provider, model, prompt }
 * 응답: **PNG 바이트 그대로** (JSON 이 아니다)
 *
 * ⚠️ base64 로 감싸 JSON 으로 돌려주지 않는 이유: base64 는 용량이 33% 늘어난다.
 *    서버리스 응답에는 크기 상한(대략 4.5MB)이 있어서, 1024x1536 고품질 PNG 를 base64 로
 *    부풀리면 상한을 넘길 수 있다. 바이트로 그대로 보내면 그만큼 여유가 생긴다.
 *    그래도 상한을 넘기면 502 대신 아래 413 으로 이유를 알려준다.
 */
import {
  ALLOWED_IMAGE_MODELS, requirePost, requireApprovedUser,
  readPrompt, pickModel, providerOf, keyFor, fail,
} from './_shared.mjs';

const OPENAI_URL = 'https://api.openai.com/v1/images/generations';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const DEFAULT_IMAGE_MODEL = { openai: 'gpt-image-1-mini', gemini: 'gemini-3.1-flash-lite-image' };

/** 서버리스 응답 상한에 걸리기 전에 우리가 먼저 알아차린다 */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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

  const model = pickModel(body.model, ALLOWED_IMAGE_MODELS, DEFAULT_IMAGE_MODEL[provider]);
  if (!model.ok) return fail(res, 400, model.message);

  try {
    const { bytes, mime } = provider === 'gemini'
      ? await callGemini({ key, model: model.value, prompt: prompt.value })
      : await callOpenAI({ key, model: model.value, prompt: prompt.value });

    if (bytes.length > MAX_IMAGE_BYTES) {
      return fail(res, 413, '만들어진 이미지가 너무 커서 전달하지 못했습니다. 더 낮은 품질의 모델로 시도해 주세요.');
    }
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(bytes);
  } catch (e) {
    return fail(res, e.status || 502, e.message || '이미지 생성에 실패했습니다.');
  }
}

async function callOpenAI({ key, model, prompt }) {
  const body = {
    model,
    prompt,
    n: 1,
    // 카드가 4:5 인데 OpenAI 에는 정확히 4:5 가 없다. 가장 가까운 세로 규격을 받아 렌더러가 잘라 맞춘다.
    size: model.startsWith('gpt-image') ? '1024x1536' : '1024x1792',
  };
  if (model.startsWith('gpt-image')) body.quality = 'high';
  else body.response_format = 'b64_json';

  const res = await post(OPENAI_URL, { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body);
  const data = await ensureOk(res);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw withStatus(502, '응답에 이미지 데이터가 없습니다.');
  return { bytes: Buffer.from(b64, 'base64'), mime: 'image/png' };
}

async function callGemini({ key, model, prompt }) {
  const body = {
    model,
    input: [{ type: 'text', text: prompt }],
    // Gemini 는 4:5 를 그대로 지원한다 — 잘라낼 필요가 없다
    response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: '4:5', image_size: '1K' },
  };

  const res = await post(GEMINI_URL, { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body);
  const data = await ensureOk(res);
  const part = findImagePart(data);
  if (!part) throw withStatus(502, '응답에 이미지 데이터가 없습니다. 프롬프트가 안전 필터에 걸렸을 수 있습니다.');
  return { bytes: Buffer.from(part.data, 'base64'), mime: part.mime_type || 'image/png' };
}

/* ---------------- 공통 ---------------- */

const post = (url, headers, body) => fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
const withStatus = (status, message) => Object.assign(new Error(message), { status });

async function ensureOk(res) {
  if (res.ok) return res.json();
  let detail = '';
  try {
    const raw = await res.json();
    const j = Array.isArray(raw) ? raw[0] : raw;
    detail = j?.error?.message || '';
  } catch { /* 본문이 JSON 이 아닐 수 있다 */ }

  if (res.status === 401 || res.status === 403) {
    throw withStatus(502, '서버에 설정된 API 키로는 이 모델을 쓸 수 없습니다. 관리자에게 알려 주세요.');
  }
  if (res.status === 429) throw withStatus(429, '요청이 몰렸거나 크레딧이 부족합니다. 잠시 후 다시 시도해 주세요.');
  throw withStatus(502, `이미지 생성에 실패했습니다 (${res.status}). ${detail}`);
}

/** 응답 어디에 이미지가 들어오든 찾아낸다 (lib/gemini.js 와 같은 방식) */
function findImagePart(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'image' && typeof node.data === 'string') return node;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        const found = findImagePart(v);
        if (found) return found;
      }
    } else if (value && typeof value === 'object') {
      const found = findImagePart(value);
      if (found) return found;
    }
  }
  return null;
}
