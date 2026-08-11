/**
 * 글귀 생성 (텍스트) — OpenAI 전용
 *
 * 이 프로젝트는 AI 제공자를 OpenAI 하나로만 쓰기로 했다(요청자 결정, 2026-08-11).
 * 예전엔 Gemini 와 오가며 골라 쓰는 제공자 선택 레이어였는데, 이제 고를 게 없어서
 * openai.js 를 그대로 다시 내보내는 얇은 통로로 남긴다 — 호출부(pages/copy.js)는
 * 그대로 이 파일만 본다.
 */
/**
 * ⚠️ **서버 프록시 방식으로 전환 중** (요청자 결정 2026-08-11). `lib/serverapi.js` 의
 *    `isServerMode()` 가 켜져 있으면(배포본에서 `/api/health` 가 응답하면) 그쪽으로 보내고,
 *    아니면 예전처럼 브라우저가 직접 OpenAI 를 부른다 (`lib/openai.js`).
 *    로컬(`python -m http.server`)에는 `/api` 가 없어 항상 직접 호출로 남는다 — 두 모드를 함께 지원한다.
 */
import * as openai from './openai.js';
import { pinnedTextModel } from './localconfig.js';
import * as server from './serverapi.js';

export const MODELS = () => openai.TEXT_MODELS;
/** 서버 모드에서는 키가 서버에 있으므로 화면 쪽은 '있다'고 본다. */
export const hasKey = () => server.isServerMode() || openai.hasKey();
/** 서버 모드도 내장 키와 같다 — 사용자가 만질 입력칸이 없다. */
export const isBuiltInKey = () => server.isServerMode() || openai.isBuiltInKey();
export const maskedKey = () => openai.maskedKey();
export const setKey = (v) => openai.setKey(v);

/**
 * ⚠️ 모델 고정은 여기가 아니라 **`openai.js` 의 `getTextModel()` 안**에 있다.
 *    `generateText()` 가 llm 을 거치지 않고 자기 `getTextModel()` 을 직접 부르기 때문이다.
 *    여기에만 넣으면 화면에는 Terra 로 보이는데 실제로는 다른 모델이 호출된다.
 */
export const getModel = () => openai.getTextModel();
export const isModelPinned = () => {
  const pinned = pinnedTextModel();
  return Boolean(pinned && openai.TEXT_MODELS.some((m) => m.id === pinned));
};
export const setModel = (v) => openai.setTextModel(v);
export const generateText = (prompt, opts) => (server.isServerMode()
  ? server.generateText(prompt, { ...opts, provider: 'openai', model: openai.getTextModel() })
  : openai.generateText(prompt, opts));
