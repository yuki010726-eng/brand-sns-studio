/**
 * 로컬 설정 — 이 PC 에만 있는 값을 앱이 시작할 때 한 번 읽는다
 *
 * 목적: **API 키를 화면에서 매번 넣지 않게 하는 것** (요청자 요구 2026-08-11 "api 내장").
 *
 * ⚠️ **키를 저장소에 넣는 방식이 아니다.** 넣을 수 없다 — 이 저장소는 Public 이고,
 *    CLAUDE.md 7절이 "키를 코드·저장소·문서에 절대 넣지 않는다" 를 못박고 있다.
 *    공개 저장소에 올라간 OpenAI 키는 봇이 수 분 안에 긁어가고 요금은 키 주인이 문다.
 *
 * 대신 `config.local.js` 를 **`.gitignore` 에 넣어** 두고 거기서 읽는다.
 * 파일은 이 PC 를 벗어나지 않으므로 커밋될 일이 없고, 쓰는 사람은 키를 한 번만 적으면 된다.
 *
 *   1. `config.example.js` 를 복사해 `config.local.js` 로 이름을 바꾼다
 *   2. 키를 적는다
 *   3. 새로고침하면 2·3단계의 키 입력칸이 「내장됨」으로 바뀐다
 *
 * ⚠️ 파일이 없으면 콘솔에 `config.local.js` 404 가 한 줄 남는다. 고장이 아니라
 *    파일 유무를 판정하는 방식이다 (`/api/health` · `assets/logos/*.png` 와 같은 성격).
 *
 * ⚠️ 이 값은 **localStorage 에 쓰지 않는다.** 쓰면 나중에 파일을 지워도 키가 브라우저에
 *    남아 "내장을 껐는데 아직 되네" 가 된다. 읽기 전용으로만 다룬다.
 */

/** @type {{openaiKey?:string, geminiKey?:string, textProvider?:string, textModel?:string}|null} */
let cfg = null;
let loaded = false;

/**
 * 앱 시작 시 **한 번** 부른다. 실패해도 앱은 그대로 동작한다 (키를 화면에서 넣으면 된다).
 * @returns {Promise<object>}
 */
export async function loadLocalConfig() {
  if (loaded) return cfg || {};
  loaded = true;
  try {
    const m = await import('../config.local.js');
    cfg = m.default || m || {};
  } catch {
    cfg = {};   // 파일이 없는 것이 기본 상태다 — 조용히 넘어간다
  }
  return cfg;
}

/**
 * 내장 키. 아직 안 읽었거나 파일이 없으면 빈 문자열이다.
 *
 * ⚠️ **동기 함수로 유지할 것.** `hasKey()` 가 화면 곳곳에서 조건문으로 쓰여서
 *    비동기로 바꾸면 그 자리들이 전부 깨진다 (`isServerMode()` 와 같은 이유).
 *    그래서 `app.js` 가 첫 렌더 전에 `loadLocalConfig()` 를 await 한다.
 *
 * @param {'openai'|'gemini'} provider
 * @returns {string}
 */
export function builtInKey(provider) {
  const v = provider === 'gemini' ? cfg?.geminiKey : cfg?.openaiKey;
  return typeof v === 'string' ? v.trim() : '';
}

/** 내장 키로 돌고 있는지 — 화면이 입력칸 대신 안내를 보여줄지 판단한다 */
export const hasBuiltInKey = (provider) => builtInKey(provider).length > 0;

/** 설정 파일이 제공자·모델까지 고정했는지 (없으면 undefined — 저장된 값을 쓴다) */
export const pinnedProvider = () => cfg?.textProvider || '';
export const pinnedTextModel = () => cfg?.textModel || '';
