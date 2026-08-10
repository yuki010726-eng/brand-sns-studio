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

export const getProvider = () => localStorage.getItem(STORE) || PROVIDERS[0].id;
export const setProvider = (v) => localStorage.setItem(STORE, v);
export const currentProvider = () => PROVIDERS.find((p) => p.id === getProvider()) || PROVIDERS[0];

const api = () => (getProvider() === 'openai' ? openai : gemini);

export const MODELS = () => api().TEXT_MODELS;
export const hasKey = () => api().hasKey();
export const maskedKey = () => api().maskedKey();
export const setKey = (v) => api().setKey(v);
export const getModel = () => api().getTextModel();
export const setModel = (v) => api().setTextModel(v);
export const generateText = (prompt, opts) => api().generateText(prompt, opts);
