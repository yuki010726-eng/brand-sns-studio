/**
 * 이미지 생성 제공자 선택
 *
 * 화면(components/imagepanel.js)은 이 파일만 보면 된다.
 * 제공자를 바꾸면 키·모델도 그쪽 것으로 함께 바뀐다 — 키는 제공자별로 따로 저장되므로
 * 둘 다 넣어 두고 오가며 써도 서로 지워지지 않는다.
 *
 * 제공자를 추가할 때는 아래 세 곳만 손대면 된다: import → PROVIDERS → api().
 */
/**
 * ⚠️ 키는 각자 넣는다 — 서버 프록시를 쓰지 않는다. 이유는 `lib/llm.js` 머리말 참고.
 */
import * as openai from './openai.js';
import * as gemini from './gemini.js';

const STORE = 'bboggl.image-provider';

/**
 * ⚠️ **OpenAI 가 기본이다.** 글귀도 OpenAI 를 쓰므로 키 하나로 둘 다 되는 쪽을 앞에 둔다.
 *    (lib/llm.js 의 PROVIDERS 와 순서를 맞출 것 — 어긋나면 화면마다 다른 키를 요구한다.)
 */
export const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    keyHint: 'platform.openai.com 에서 발급한 키 (sk-… 로 시작)',
    note: '글귀와 같은 키를 씁니다. 세로 규격이 정확히 4:5가 아니라 살짝 잘립니다.',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    keyHint: 'aistudio.google.com/apikey 에서 발급한 키 (AIza… 로 시작)',
    note: '4:5 세로 규격을 그대로 지원합니다. 별도의 Gemini 키가 필요합니다.',
  },
];

export const getProvider = () => localStorage.getItem(STORE) || PROVIDERS[0].id;
export const setProvider = (v) => localStorage.setItem(STORE, v);
export const currentProvider = () => PROVIDERS.find((p) => p.id === getProvider()) || PROVIDERS[0];

const api = () => (getProvider() === 'openai' ? openai : gemini);

/* 아래는 전부 현재 제공자에게 그대로 넘긴다 */
export const MODELS = () => api().MODELS;
export const hasKey = () => api().hasKey();
export const maskedKey = () => api().maskedKey();
export const setKey = (v) => api().setKey(v);
export const getModel = () => api().getModel();
export const setModel = (v) => api().setModel(v);
export const generateImage = (prompt, opts) => api().generateImage(prompt, opts);

/** 어느 제공자에 키가 들어 있는지 — 설정 화면 안내용 */
export const keyStatus = () =>
  PROVIDERS.map((p) => ({ id: p.id, name: p.name, ready: (p.id === 'openai' ? openai : gemini).hasKey() }));
