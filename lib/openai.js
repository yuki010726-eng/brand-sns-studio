/**
 * OpenAI 이미지 생성 클라이언트 (브라우저 직접 호출)
 *
 * ⚠️ 보안 주의
 * 이 방식은 API 키가 브라우저에 그대로 들어간다. 개발자 도구를 열면 누구나 볼 수 있으므로
 * **개인·내부용으로 로컬에서 쓸 때만** 사용한다. 외부에 배포할 때는 서버 프록시를 두고
 * 키를 서버에만 둬야 한다 (PART 2).
 *
 * 키는 코드나 저장소에 절대 넣지 않는다. 사용자가 설정 화면에서 직접 입력하고
 * localStorage 에만 남는다.
 */

const KEY_STORE = 'bboggl.openai-key';
const MODEL_STORE = 'bboggl.openai-model';
const ENDPOINT = 'https://api.openai.com/v1/images/generations';

/**
 * 2026-07 기준. gpt-image-1 은 가장 비싼 구형이라 뺐다.
 * 조직 인증이 필요해 막히는 경우가 있어 dall-e-3 폴백은 남겨 둔다.
 */
export const MODELS = [
  { id: 'gpt-image-1-mini', label: 'gpt-image-1-mini (저렴)', note: '장당 약 $0.005. 카드 6장에 약 $0.03 — 가장 쌉니다.' },
  { id: 'gpt-image-2', label: 'gpt-image-2 (권장)', note: '장당 약 $0.03. 현재 플래그십으로 지시를 가장 잘 따릅니다.' },
  { id: 'dall-e-3', label: 'dall-e-3 (폴백)', note: '위 모델이 권한 오류를 내면 이쪽으로 바꿔보세요.' },
];

export const getKey = () => localStorage.getItem(KEY_STORE) || '';
export const hasKey = () => getKey().trim().length > 0;
export const setKey = (v) => (v ? localStorage.setItem(KEY_STORE, v.trim()) : localStorage.removeItem(KEY_STORE));

/** 없어진 모델이 저장돼 있으면 기본값으로 돌린다 (getTextModel 과 같은 이유) */
export const getModel = () => {
  const saved = localStorage.getItem(MODEL_STORE);
  return MODELS.some((m) => m.id === saved) ? saved : MODELS[0].id;
};
export const setModel = (v) => localStorage.setItem(MODEL_STORE, v);

/** 화면에 보여줄 때는 앞뒤 일부만 — 전체를 노출하지 않는다 */
export function maskedKey() {
  const k = getKey();
  if (!k) return '';
  return k.length <= 12 ? '••••' : `${k.slice(0, 6)}••••••••${k.slice(-4)}`;
}

/**
 * 이미지 1장 생성
 * @param {string} prompt 영문 프롬프트
 * @param {{signal?: AbortSignal}} [opts]
 * @returns {Promise<Blob>} PNG Blob
 */
export async function generateImage(prompt, opts = {}) {
  const key = getKey();
  if (!key) throw new Error('API 키가 없습니다. 설정에서 먼저 입력해 주세요.');

  const model = getModel();
  const body = {
    model,
    prompt,
    n: 1,
    // 카드가 4:5 세로형이라 세로 이미지를 받는다. OpenAI 에는 정확히 4:5인 옵션이 없어서
    // 가장 가까운 세로 규격을 쓰고, 렌더러가 cover 로 살짝 잘라 맞춘다.
    // (Gemini 는 4:5 를 그대로 지원한다 — lib/gemini.js)
    size: model.startsWith('gpt-image') ? '1024x1536' : '1024x1792',
  };
  // 계열별로 지원 옵션이 달라 나눠서 넣는다
  if (model.startsWith('gpt-image')) body.quality = 'high';
  else body.response_format = 'b64_json';

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('OpenAI 에 연결하지 못했습니다. 네트워크 또는 브라우저 차단(CORS)을 확인해 주세요.');
  }

  if (!res.ok) throw new Error(await readError(res));

  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error('응답에 이미지 데이터가 없습니다.');
  return b64ToBlob(b64);
}

/** OpenAI 오류 메시지를 사람이 읽을 수 있는 문장으로 바꾼다 */
async function readError(res) {
  let detail = '';
  try {
    const j = await res.json();
    detail = j?.error?.message || '';
  } catch { /* 본문이 JSON 이 아닐 수 있다 */ }

  if (res.status === 401) return 'API 키가 올바르지 않습니다. 설정에서 다시 확인해 주세요.';
  if (res.status === 403) return `이 키로는 해당 모델을 쓸 수 없습니다. 다른 모델로 바꿔보세요. ${detail}`;
  if (res.status === 429) return '요청이 너무 잦거나 크레딧이 부족합니다. 잠시 후 다시 시도해 주세요.';
  return `이미지 생성에 실패했습니다 (${res.status}). ${detail}`;
}

/* ============================================================
   글귀 생성 (텍스트) — Responses API
   ============================================================ */

const TEXT_ENDPOINT = 'https://api.openai.com/v1/responses';
const TEXT_MODEL_STORE = 'bboggl.openai-text-model';

/**
 * 2026-08 공식 가격표 기준. 출력 단가가 입력의 6배라 비용은 사실상 출력이 결정한다.
 *
 * ⚠️ **Luna 는 뺐다 (요청자 결정 2026-08-10). Terra 이상만 쓴다.**
 *    블로그 형식 지시가 9단계 구조 + 이미지 자리 6줄 + 캡션 6줄이라 지시 준수력이 필요하고,
 *    저가 모델은 검수에 걸려 재시도가 늘면 가격 이점도 함께 사라진다.
 *    되살리려면 이 목록과 `api/_shared.mjs` 의 `ALLOWED_TEXT_MODELS` 를 함께 고쳐야 한다.
 */
export const TEXT_MODELS = [
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra (권장)', note: '입력 $2 / 출력 $12 per 1M. 게시물 1세트에 약 $0.08(약 107원).' },
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol (고품질)', note: '입력 $5 / 출력 $30 per 1M. 게시물 1세트에 약 $0.19(약 267원).' },
];

/**
 * 목록에 없는 값이 저장돼 있으면 기본값으로 돌린다.
 * 예전에 고른 Luna 가 그대로 남아 있으면 없앤 모델을 계속 부르게 된다.
 */
export const getTextModel = () => {
  const saved = localStorage.getItem(TEXT_MODEL_STORE);
  return TEXT_MODELS.some((m) => m.id === saved) ? saved : TEXT_MODELS[0].id;
};
export const setTextModel = (v) => localStorage.setItem(TEXT_MODEL_STORE, v);

/**
 * 추론 강도.
 *
 * ⚠️ **추론 토큰은 출력 요금으로 과금된다.** 안 보내면 모델 기본값이 걸리는데, 그 기본이
 *    medium 이면 요청하지도 않은 비용이 매 호출마다 붙는다. 이 작업은 정해진 형식에 맞춰
 *    쓰는 일이라 긴 추론이 필요 없다. 낮게 못박는다.
 */
const REASONING_EFFORT = 'low';

/**
 * 모델이 받지 않는 파라미터를 기억해 둔다.
 *
 * 모델마다 지원 범위가 다르다 — 추론 모델은 `temperature` 를 받지 않는 경우가 있다.
 * 파라미터 하나 때문에 글쓰기 전체가 죽으면 안 되므로, 한 번 거절당한 것은 빼고 다시 보낸다.
 * 두 번째부터는 처음부터 빼고 보내서 헛호출이 반복되지 않는다.
 * @type {Map<string, Set<string>>} 모델 id → 빼야 할 파라미터
 */
const unsupported = new Map();

/** 거절당하면 뺄 수 있는 것들. 없어도 글은 나온다(비용·문체만 기본값으로 돌아간다). */
const OPTIONAL_PARAMS = ['temperature', 'reasoning', 'max_output_tokens'];

/** 400 응답에서 어떤 파라미터가 문제였는지 골라낸다 */
function blamedParam(detail, param) {
  if (OPTIONAL_PARAMS.includes(param)) return param;
  return OPTIONAL_PARAMS.find((p) => new RegExp(`\\b${p}\\b`).test(detail)) || null;
}

/**
 * @param {string} prompt
 * @param {{system?:string, temperature?:number, maxOutputTokens?:number,
 *          signal?:AbortSignal, onUsage?:(usage:object)=>void}} [opts]
 *   `onUsage` 는 응답에 실려 온 **실제 토큰 사용량**을 넘긴다. 글자 수로 어림하지 않고
 *   추론 토큰까지 정확히 셀 수 있는 유일한 경로다 (tools/bench.html 이 쓴다).
 * @returns {Promise<string>}
 */
export async function generateText(prompt, opts = {}) {
  const key = getKey();
  if (!key) throw new Error('OpenAI API 키가 없습니다. 설정에서 먼저 입력해 주세요.');

  const model = getTextModel();
  const full = { model, input: prompt, reasoning: { effort: REASONING_EFFORT } };
  if (opts.system) full.instructions = opts.system;
  if (opts.temperature !== undefined) full.temperature = opts.temperature;
  // 상한이 곧 비용 상한이다. 안 걸면 모델이 길게 뽑는 만큼 그대로 과금된다.
  if (opts.maxOutputTokens) full.max_output_tokens = opts.maxOutputTokens;

  // 이 모델이 이미 거절했던 파라미터는 처음부터 뺀다
  const send = { ...full };
  for (const p of unsupported.get(model) || []) delete send[p];

  const post = async (body) => {
    try {
      return await fetch(TEXT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new Error('OpenAI 에 연결하지 못했습니다. 네트워크 또는 브라우저 차단(CORS)을 확인해 주세요.');
    }
  };

  let body = send;
  let res = await post(body);

  // 지원하지 않는 파라미터 때문이면 그것만 빼고 한 번 더 — 최대 세 번(선택 파라미터 수만큼)
  for (let i = 0; i < OPTIONAL_PARAMS.length && !res.ok && res.status === 400; i++) {
    const { detail, param } = await readErrorParts(res);
    const blamed = blamedParam(detail, param);
    if (!blamed || !(blamed in body)) break;

    if (!unsupported.has(model)) unsupported.set(model, new Set());
    unsupported.get(model).add(blamed);
    console.warn(`[openai] ${model} 이 '${blamed}' 를 받지 않아 빼고 다시 보냅니다.`);

    body = { ...body };
    delete body[blamed];
    res = await post(body);
  }

  if (!res.ok) throw new Error(await readError(res));

  const json = await res.json();
  if (json?.usage) opts.onUsage?.(json.usage);
  const text = json?.output_text || findText(json);
  if (!text) {
    // max_output_tokens 안에서 추론만 하다 끝나면 본문이 비어서 온다
    if (json?.status === 'incomplete') {
      throw new Error('출력 상한에 걸려 글이 완성되지 않았습니다. 상한을 올리거나 추론 강도를 낮춰 주세요.');
    }
    throw new Error('응답에 글이 없습니다.');
  }
  return String(text).trim();
}

/** 400 본문에서 메시지와 param 을 꺼낸다. 응답을 한 번만 읽을 수 있어 따로 둔다. */
async function readErrorParts(res) {
  try {
    const j = await res.clone().json();
    return { detail: j?.error?.message || '', param: j?.error?.param || '' };
  } catch {
    return { detail: '', param: '' };
  }
}

/** output_text 가 없을 때 output_items[].content[] 를 훑는다 */
function findText(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'output_text' && typeof node.text === 'string') return node.text;
  let out = '';
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const v of value) out += findText(v);
    } else if (value && typeof value === 'object') {
      out += findText(value);
    }
  }
  return out;
}

function b64ToBlob(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}
