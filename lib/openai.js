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

/** 조직 인증이 필요한 gpt-image-1 이 막히면 dall-e-3 으로 바꿔 쓸 수 있게 둔다 */
export const MODELS = [
  { id: 'gpt-image-1', label: 'gpt-image-1 (권장)', note: '지시를 잘 따르고 품질이 좋습니다. OpenAI 조직 인증이 필요할 수 있습니다.' },
  { id: 'dall-e-3', label: 'dall-e-3', note: 'gpt-image-1 이 권한 오류를 내면 이쪽으로 바꿔보세요.' },
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
    size: '1024x1024',
  };
  // 두 모델의 지원 옵션이 달라 모델별로 나눠서 넣는다
  if (model === 'gpt-image-1') body.quality = 'high';
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

function b64ToBlob(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}
