/**
 * 글귀 생성 제공자 선택 (텍스트)
 *
 * 이미지 쪽(lib/imagegen.js)과 같은 모양이지만 **제공자를 따로 고를 수 있게** 분리했다.
 * 글은 Gemini 무료 한도로 쓰고 이미지는 OpenAI로 뽑는 식의 조합이 실제로 유용하기 때문이다.
 *
 * API 키는 제공자별로 이미지와 **공유**한다 (같은 키 하나로 둘 다 된다).
 */
import * as openai from './openai.js';
import * as gemini from './gemini.js';

const STORE = 'bboggl.text-provider';

export const PROVIDERS = [
  {
    id: 'gemini',
    name: 'Gemini',
    note: '텍스트 모델은 무료 한도가 있어 결제 설정 없이 쓸 수 있습니다.',
    free: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    note: '무료 한도가 없습니다. 게시물 1세트에 약 $0.03(Luna 기준).',
    free: false,
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
