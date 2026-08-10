/**
 * Gemini(Nano Banana) 이미지 생성 클라이언트 (브라우저 직접 호출)
 *
 * ⚠️ 보안 주의 — openai.js 와 같다.
 * 키가 브라우저에 그대로 들어간다. **개인·내부용 로컬 실행 전용**이다.
 * Gemini 키는 결제 계정이 붙어 있어 노출되면 크레딧이 소진되고 카드로 넘어간다.
 * 외부 배포 시에는 서버 프록시로 옮기고 키를 서버에만 둔다 (PART 2).
 *
 * 키는 코드·저장소에 넣지 않는다. 사용자가 화면에서 입력하고 localStorage 에만 남는다.
 *
 * Imagen 은 2026-08-17 종료 예정이라 쓰지 않는다. Nano Banana 계열만 둔다.
 */

const KEY_STORE = 'bboggl.gemini-key';
const MODEL_STORE = 'bboggl.gemini-model';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/** 가격은 1K 기준 (2026-07 공식 가격표) */
export const MODELS = [
  { id: 'gemini-3.1-flash-lite-image', label: 'Nano Banana 2 Lite (저렴)', note: '장당 약 $0.034. 카드 6장에 약 $0.20.' },
  { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2 (권장)', note: '장당 약 $0.067. 지시를 더 정확히 따릅니다.' },
  { id: 'gemini-3-pro-image', label: 'Nano Banana Pro (고급)', note: '장당 약 $0.134. 복잡한 장면·정교한 묘사에 씁니다.' },
];

export const getKey = () => localStorage.getItem(KEY_STORE) || '';
export const hasKey = () => getKey().trim().length > 0;
export const setKey = (v) => (v ? localStorage.setItem(KEY_STORE, v.trim()) : localStorage.removeItem(KEY_STORE));

export const getModel = () => localStorage.getItem(MODEL_STORE) || MODELS[0].id;
export const setModel = (v) => localStorage.setItem(MODEL_STORE, v);

/** 화면에 보여줄 때는 앞뒤 일부만 — 전체를 노출하지 않는다 */
export function maskedKey() {
  const k = getKey();
  if (!k) return '';
  return k.length <= 12 ? '••••' : `${k.slice(0, 6)}••••••••${k.slice(-4)}`;
}

/**
 * 이미지 1장 생성
 *
 * OpenAI 와 달리 **정확히 4:5 를 지원한다** — 카드 규격 그대로 받아서 잘라낼 필요가 없다.
 *
 * @param {string} prompt 영문 프롬프트
 * @param {{signal?: AbortSignal}} [opts]
 * @returns {Promise<Blob>}
 */
export async function generateImage(prompt, opts = {}) {
  const key = getKey();
  if (!key) throw new Error('Gemini API 키가 없습니다. 설정에서 먼저 입력해 주세요.');

  const body = {
    model: getModel(),
    input: [{ type: 'text', text: prompt }],
    response_format: {
      type: 'image',
      mime_type: 'image/png',
      aspect_ratio: '4:5',   // 카드 규격(1080x1350)과 같다
      image_size: '1K',
    },
  };

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Gemini 에 연결하지 못했습니다. 네트워크 또는 브라우저 차단(CORS)을 확인해 주세요.');
  }

  if (!res.ok) throw new Error(await readError(res));

  const json = await res.json();
  const part = findImagePart(json);
  if (!part) throw new Error('응답에 이미지 데이터가 없습니다. 프롬프트가 안전 필터에 걸렸을 수 있습니다.');
  return b64ToBlob(part.data, part.mime_type || 'image/png');
}

/**
 * 응답 어디에 이미지가 들어오든 찾아낸다.
 * 문서상 경로는 steps[].content[] 지만, 모델·버전에 따라 한 단계씩 다를 수 있어
 * 트리를 훑어 type === 'image' 인 첫 조각을 쓴다.
 */
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

/**
 * Gemini 오류를 사람이 읽을 수 있는 문장으로 바꾼다.
 * 본문이 `{error:…}` 일 때도 있고 `[{error:…}]` 배열일 때도 있어 둘 다 받는다.
 */
async function readError(res) {
  let detail = '';
  let reason = '';
  try {
    const raw = await res.json();
    const j = Array.isArray(raw) ? raw[0] : raw;
    detail = j?.error?.message || '';
    reason = j?.error?.details?.find((d) => d.reason)?.reason || '';
  } catch { /* 본문이 JSON 이 아닐 수 있다 */ }

  if (reason === 'API_KEY_INVALID' || /API key not valid/i.test(detail)) {
    return 'API 키가 올바르지 않습니다. 앞뒤 공백까지 포함해 다시 붙여넣어 주세요.';
  }
  if (/billing|quota|not have access/i.test(detail)) {
    return `결제 설정이 필요합니다. 이미지 모델은 무료 한도가 없습니다. ${detail}`;
  }
  if (res.status === 400 && /API key/i.test(detail)) return 'API 키가 올바르지 않습니다. 설정에서 다시 확인해 주세요.';
  if (res.status === 401 || res.status === 403) {
    return `이 키로는 해당 모델을 쓸 수 없습니다. 결제 설정이 끝났는지 확인해 주세요. ${detail}`;
  }
  if (res.status === 429) {
    return '요청이 너무 잦거나 크레딧·결제 한도에 걸렸습니다. 이미지 모델은 무료 한도가 없어 결제 설정이 필요합니다.';
  }
  return `이미지 생성에 실패했습니다 (${res.status}). ${detail}`;
}

/* ============================================================
   글귀 생성 (텍스트)

   이미지와 달리 **텍스트 모델에는 무료 한도가 있다.** 결제 설정 없이 키만 있으면 된다.
   같은 API 키를 쓰므로 키 저장소는 위와 공유하고 모델만 따로 기억한다.
   ============================================================ */

const TEXT_MODEL_STORE = 'bboggl.gemini-text-model';

export const TEXT_MODELS = [
  { id: 'gemini-3.6-flash', label: '3.6 Flash (권장)', note: '무료 한도 있음. 속도와 품질이 균형 잡혀 있습니다.' },
  { id: 'gemini-2.5-pro', label: '2.5 Pro (고품질)', note: '무료 한도 있음. 길고 촘촘한 글에 유리하지만 느립니다.' },
  { id: 'gemini-3.5-flash-lite', label: '3.5 Flash Lite (빠름)', note: '무료 한도 있음. 가장 빠릅니다.' },
];

export const getTextModel = () => localStorage.getItem(TEXT_MODEL_STORE) || TEXT_MODELS[0].id;
export const setTextModel = (v) => localStorage.setItem(TEXT_MODEL_STORE, v);

/**
 * @param {string} prompt
 * @param {{system?:string, temperature?:number, maxOutputTokens?:number, signal?:AbortSignal}} [opts]
 * @returns {Promise<string>}
 */
export async function generateText(prompt, opts = {}) {
  const key = getKey();
  if (!key) throw new Error('Gemini API 키가 없습니다. 설정에서 먼저 입력해 주세요.');

  const body = {
    model: getTextModel(),
    input: prompt,
    generation_config: { temperature: opts.temperature ?? 0.9 },
  };
  // 무료 한도 안에서 쓰더라도 상한은 건다 — 한도를 아껴야 하는 건 같다 (openai.js 와 같은 이유)
  if (opts.maxOutputTokens) body.generation_config.max_output_tokens = opts.maxOutputTokens;
  if (opts.system) body.system_instruction = opts.system;

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Gemini 에 연결하지 못했습니다. 네트워크 또는 브라우저 차단(CORS)을 확인해 주세요.');
  }

  if (!res.ok) throw new Error(await readError(res));

  const json = await res.json();
  const text = json?.output_text || findText(json);
  if (!text) throw new Error('응답에 글이 없습니다. 안전 필터에 걸렸을 수 있습니다.');
  return String(text).trim();
}

/** output_text 가 없을 때 steps[].content[] 를 훑는다 */
function findText(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text' && typeof node.text === 'string') return node.text;
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

function b64ToBlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
