/**
 * 글귀 생성 제공자 선택 (텍스트)
 *
 * 이미지 쪽(lib/imagegen.js)과 같은 모양이지만 **제공자를 따로 고를 수 있게** 분리했다.
 * 글은 Gemini 무료 한도로 쓰고 이미지는 OpenAI로 뽑는 식의 조합이 실제로 유용하기 때문이다.
 *
 * API 키는 제공자별로 이미지와 **공유**한다 (같은 키 하나로 둘 다 된다).
 */
/**
 * ⚠️ **키는 각자 발급받아 각자 넣는다** (요청자 결정 2026-08-10).
 *    PART 2 에서 만든 서버 프록시(`api/`, `lib/serverapi.js`)는 **쓰지 않는다.**
 *    파일은 남겨 뒀다 — 공용 키 방식으로 되돌리려면 여기서 다시 갈래를 만들면 된다.
 */
import * as openai from './openai.js';
import * as gemini from './gemini.js';
import { pinnedProvider, pinnedTextModel } from './localconfig.js';

const STORE = 'bboggl.text-provider';

/**
 * ⚠️ **OpenAI 가 기본이다.** 쓰기로 정한 모델이 Terra(OpenAI)라 기본이 Gemini 면
 *    키 발급 안내도 Gemini 로 떠서 엉뚱한 키를 받아 오게 된다. 목록 순서가 곧 기본값이다.
 */
export const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    note: 'Terra 기준 게시물 1세트에 약 $0.08(약 107원). 크레딧을 충전해야 합니다.',
    free: false,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    note: '텍스트 모델은 무료 한도가 있어 결제 설정 없이 쓸 수 있습니다.',
    free: true,
  },
];

/**
 * ⚠️ `config.local.js` 가 제공자를 고정했으면 **그것이 이긴다.**
 *    "OpenAI · Terra 로 고정" 이 요청자 지시라(2026-08-11), 브라우저에 예전에 고른
 *    Gemini 가 남아 있어도 설정 파일이 있으면 그쪽을 따라야 한다.
 *    고정 값이 목록에 없으면 무시한다 — 오타 하나로 글쓰기가 통째로 죽으면 안 된다.
 */
export const getProvider = () => {
  const pinned = pinnedProvider();
  if (pinned && PROVIDERS.some((p) => p.id === pinned)) return pinned;
  return localStorage.getItem(STORE) || PROVIDERS[0].id;
};
export const setProvider = (v) => localStorage.setItem(STORE, v);
export const currentProvider = () => PROVIDERS.find((p) => p.id === getProvider()) || PROVIDERS[0];

/** 설정 파일이 제공자를 고정했는지 — 화면이 선택칸을 잠글지 판단한다 */
export const isProviderPinned = () => {
  const pinned = pinnedProvider();
  return Boolean(pinned && PROVIDERS.some((p) => p.id === pinned));
};

const api = () => (getProvider() === 'openai' ? openai : gemini);

export const MODELS = () => api().TEXT_MODELS;
export const hasKey = () => api().hasKey();
export const isBuiltInKey = () => api().isBuiltInKey();
export const maskedKey = () => api().maskedKey();
export const setKey = (v) => api().setKey(v);

/**
 * ⚠️ 모델 고정은 여기가 아니라 **`openai.js`·`gemini.js` 의 `getTextModel()` 안**에 있다.
 *    `generateText()` 가 llm 을 거치지 않고 자기 `getTextModel()` 을 직접 부르기 때문이다.
 *    여기에만 넣으면 화면에는 Terra 로 보이는데 실제로는 다른 모델이 호출된다.
 */
export const getModel = () => api().getTextModel();
export const isModelPinned = () => {
  const pinned = pinnedTextModel();
  return Boolean(pinned && api().TEXT_MODELS.some((m) => m.id === pinned));
};
export const setModel = (v) => api().setTextModel(v);
export const generateText = (prompt, opts) => api().generateText(prompt, opts);
