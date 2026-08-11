/**
 * OpenAI 글귀 생성 클라이언트 (브라우저 직접 호출)
 *
 * 이 프로젝트가 쓰는 유일한 AI 제공자다(요청자 결정, 2026-08-11) — 이미지는 여기서
 * 만들지 않는다. 4단계는 프롬프트만 보여주고, 실제 이미지는 밖에서 만들어 올린다.
 *
 * ⚠️ 보안 주의
 * 이 방식은 API 키가 브라우저에 그대로 들어간다. 개발자 도구를 열면 누구나 볼 수 있으므로
 * **개인·내부용으로 로컬에서 쓸 때만** 사용한다. 외부에 배포할 때는 서버 프록시를 두고
 * 키를 서버에만 둬야 한다 (PART 2).
 *
 * 키는 코드나 저장소에 절대 넣지 않는다. 사용자가 설정 화면에서 직접 입력하면
 * localStorage 에 남는다.
 * localStorage 에 값이 없으면 lib/apikeys.local.js(git에 커밋되지 않는 로컬 전용 파일)의
 * 기본값으로 대체한다 — 그 파일이 없어도(신규 clone) 동적 import 실패를 잡아 빈 값으로 넘어간다.
 */

let LOCAL_KEYS = {};
try {
  LOCAL_KEYS = await import('./apikeys.local.js');
} catch {
  LOCAL_KEYS = {};
}

const KEY_STORE = 'bboggl.openai-key';
const TEXT_ENDPOINT = 'https://api.openai.com/v1/responses';
const TEXT_MODEL_STORE = 'bboggl.openai-text-model';

export const getKey = () => localStorage.getItem(KEY_STORE) || LOCAL_KEYS.OPENAI_KEY || '';
export const hasKey = () => getKey().trim().length > 0;
export const setKey = (v) => (v ? localStorage.setItem(KEY_STORE, v.trim()) : localStorage.removeItem(KEY_STORE));

/** 화면에 보여줄 때는 앞뒤 일부만 — 전체를 노출하지 않는다 */
export function maskedKey() {
  const k = getKey();
  if (!k) return '';
  return k.length <= 12 ? '••••' : `${k.slice(0, 6)}••••••••${k.slice(-4)}`;
}

export const TEXT_MODELS = [
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna (저렴)', note: '입력 $1 / 출력 $6 per 1M. 게시물 1세트에 약 $0.03.' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra (균형)', note: '입력 $2.5 / 출력 $15 per 1M.' },
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol (고품질)', note: '입력 $5 / 출력 $30 per 1M. 복잡한 지시를 가장 잘 따릅니다.' },
];

export const getTextModel = () => localStorage.getItem(TEXT_MODEL_STORE) || TEXT_MODELS[0].id;
export const setTextModel = (v) => localStorage.setItem(TEXT_MODEL_STORE, v);

/**
 * @param {string} prompt
 * @param {{system?:string, temperature?:number, signal?:AbortSignal}} [opts]
 * @returns {Promise<string>}
 */
export async function generateText(prompt, opts = {}) {
  const key = getKey();
  if (!key) throw new Error('OpenAI API 키가 없습니다. 설정에서 먼저 입력해 주세요.');

  const body = { model: getTextModel(), input: prompt };
  if (opts.system) body.instructions = opts.system;

  let res;
  try {
    res = await fetch(TEXT_ENDPOINT, {
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
  const text = json?.output_text || findText(json);
  if (!text) throw new Error('응답에 글이 없습니다.');
  return String(text).trim();
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
  return `글 생성에 실패했습니다 (${res.status}). ${detail}`;
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
