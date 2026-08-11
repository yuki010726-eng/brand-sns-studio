/**
 * 글귀 생성 (텍스트) — OpenAI 전용
 *
 * 이 프로젝트는 AI 제공자를 OpenAI 하나로만 쓰기로 했다(요청자 결정, 2026-08-11).
 * 예전엔 Gemini 와 오가며 골라 쓰는 제공자 선택 레이어였는데, 이제 고를 게 없어서
 * openai.js 를 그대로 다시 내보내는 얇은 통로로 남긴다 — 호출부(pages/copy.js)는
 * 그대로 이 파일만 본다.
 */
/**
 * ⚠️ **키는 각자 발급받아 각자 넣는다** (요청자 결정 2026-08-10).
 *    PART 2 에서 만든 서버 프록시(`api/`, `lib/serverapi.js`)는 **쓰지 않는다.**
 *    파일은 남겨 뒀다 — 공용 키 방식으로 되돌리려면 여기서 다시 갈래를 만들면 된다.
 */
import * as openai from './openai.js';
import { pinnedTextModel } from './localconfig.js';

export const MODELS = () => openai.TEXT_MODELS;
export const hasKey = () => openai.hasKey();
export const isBuiltInKey = () => openai.isBuiltInKey();
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
export const generateText = (prompt, opts) => openai.generateText(prompt, opts);
