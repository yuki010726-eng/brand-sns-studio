/**
 * 이미지 생성 제공자 선택
 *
 * 화면(components/imagepanel.js)은 이 파일만 보면 된다.
 * 제공자를 바꾸면 키·모델도 그쪽 것으로 함께 바뀐다 — 키는 제공자별로 따로 저장되므로
 * 둘 다 넣어 두고 오가며 써도 서로 지워지지 않는다.
 *
 * 제공자를 추가할 때는 아래 세 곳만 손대면 된다: import → PROVIDERS → api().
 */
import * as openai from './openai.js';
import * as gemini from './gemini.js';
import * as server from './serverapi.js';

const STORE = 'bboggl.image-provider';

export const PROVIDERS = [
  {
    id: 'gemini',
    name: 'Gemini',
    keyHint: 'aistudio.google.com/apikey 에서 발급한 키 (AIza… 로 시작)',
    note: '4:5 세로 규격을 그대로 지원합니다. Google AI Pro·Ultra 구독 크레딧을 쓸 수 있습니다.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    keyHint: 'platform.openai.com 에서 발급한 키 (sk-… 로 시작)',
    note: '장당 단가는 더 낮지만 세로 규격이 정확히 4:5가 아니라 살짝 잘립니다.',
  },
];

export const getProvider = () => localStorage.getItem(STORE) || PROVIDERS[0].id;
export const setProvider = (v) => localStorage.setItem(STORE, v);
export const currentProvider = () => PROVIDERS.find((p) => p.id === getProvider()) || PROVIDERS[0];

const api = () => (getProvider() === 'openai' ? openai : gemini);

/* 아래는 전부 현재 제공자에게 그대로 넘긴다 (서버 모드면 서버로) */
export const MODELS = () => api().MODELS;

/** 서버 모드에서는 키가 서버에만 있다 — lib/llm.js 의 hasKey() 와 같은 규칙이다 */
export const hasKey = () => (server.isServerMode() ? server.serverHasProvider(getProvider()) : api().hasKey());

export const maskedKey = () => (server.isServerMode() ? '' : api().maskedKey());
export const setKey = (v) => api().setKey(v);
export const getModel = () => api().getModel();
export const setModel = (v) => api().setModel(v);

export const generateImage = (prompt, opts) => (server.isServerMode()
  ? server.generateImage(prompt, { ...opts, provider: getProvider(), model: getModel() })
  : api().generateImage(prompt, opts));

/** 어느 제공자를 쓸 수 있는지 — 설정 화면 안내용 */
export const keyStatus = () => PROVIDERS.map((p) => ({
  id: p.id,
  name: p.name,
  ready: server.isServerMode() ? server.serverHasProvider(p.id) : (p.id === 'openai' ? openai : gemini).hasKey(),
}));
