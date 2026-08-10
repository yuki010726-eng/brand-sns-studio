/**
 * 서버 프록시 클라이언트 (PART 2)
 *
 * 배포본에서는 브라우저가 OpenAI·Gemini 를 직접 부르지 않는다. 같은 출처의 `/api/…` 를 부르고
 * 키는 서버에만 둔다. 브라우저에 키가 없으므로 개발자 도구로 꺼낼 것도 없다.
 *
 * ⚠️ **로컬 실행도 계속 되어야 한다.** `python -m http.server` 에는 `/api` 가 없다.
 *    그래서 시작할 때 `/api/health` 를 한 번 찔러 보고 **서버 모드 / 로컬 모드**를 정한다.
 *    로컬 모드에서는 예전처럼 각자 키를 넣어 직접 부른다 (lib/openai.js · lib/gemini.js).
 *
 * ⚠️ 판정은 **동기로 읽을 수 있어야 한다.** `hasKey()` 가 화면 곳곳에서 조건문으로 쓰이는데
 *    비동기로 바꾸면 그 자리들이 전부 깨진다. 그래서 `detect()` 를 앱 시작 때 한 번 await 하고
 *    이후에는 `isServerMode()` 로 즉시 읽는다.
 */
import { accessToken } from './auth.js';

/** null = 아직 확인 전 */
let mode = null;
let info = null;

export const isServerMode = () => mode === true;
export const serverInfo = () => info;

/**
 * 서버가 있는지 한 번만 확인한다. app.js 가 첫 렌더 전에 부른다.
 * 실패하면 로컬 모드로 둔다 — 서버 확인 때문에 앱이 멈추면 안 된다.
 */
export async function detect() {
  if (mode !== null) return mode;
  try {
    const res = await fetch('/api/health', { headers: { Accept: 'application/json' } });
    if (!res.ok) { mode = false; return mode; }
    const json = await res.json();
    // 정적 서버가 index.html 을 200 으로 돌려주는 경우가 있어 내용까지 확인한다
    mode = json?.ok === true;
    info = mode ? json : null;
  } catch {
    mode = false;
  }
  return mode;
}

/** 어느 제공자의 키가 서버에 꽂혀 있는지 */
export const serverHasProvider = (provider) => Boolean(info?.providers?.[provider]);

async function authHeaders() {
  const token = await accessToken();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/** 서버가 돌려준 오류 메시지를 그대로 쓴다 — 사람이 읽을 문장으로 만들어 보낸다 */
async function readError(res) {
  try {
    const j = await res.json();
    return j?.error || `요청에 실패했습니다 (${res.status}).`;
  } catch {
    return `요청에 실패했습니다 (${res.status}).`;
  }
}

/**
 * @param {string} prompt
 * @param {{provider:string, model:string, system?:string, temperature?:number,
 *          maxOutputTokens?:number, signal?:AbortSignal, onUsage?:(u:object)=>void}} opts
 * @returns {Promise<string>}
 */
export async function generateText(prompt, opts = {}) {
  let res;
  try {
    res = await fetch('/api/text', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        provider: opts.provider,
        model: opts.model,
        prompt,
        system: opts.system,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
      }),
      signal: opts.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error(e.message.includes('로그인') ? e.message : '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.');
  }

  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();
  if (json.usage) opts.onUsage?.(json.usage);
  if (!json.text) throw new Error('응답에 글이 없습니다.');
  return String(json.text).trim();
}

/**
 * @param {string} prompt
 * @param {{provider:string, model:string, signal?:AbortSignal}} opts
 * @returns {Promise<Blob>} PNG
 */
export async function generateImage(prompt, opts = {}) {
  let res;
  try {
    res = await fetch('/api/image', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ provider: opts.provider, model: opts.model, prompt }),
      signal: opts.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error(e.message.includes('로그인') ? e.message : '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.');
  }

  if (!res.ok) throw new Error(await readError(res));
  return res.blob();   // 서버가 PNG 바이트를 그대로 보낸다 (base64 아님)
}
