/**
 * 전역 스토어 — 아주 얇은 pub/sub + localStorage 영속화
 * 프레임워크 없이 쓰므로 상태 변경은 반드시 setState() 를 통해서만 한다.
 */

const KEY = 'bboggl.sns-studio.v1';

/**
 * @typedef {Object} AppState
 * @property {string|null} productId   선택한 상품 id
 * @property {string} topic            광고하고 싶은 주제
 * @property {string} tone             톤앤매너 id
 * @property {string[]} channels       내보낼 채널 id 목록
 * @property {Object} drafts           2단계 결과 { blog, instagram, threads } — 사용자가 편집한 최종본
 * @property {Object} generated        마지막으로 자동 생성한 원본 (편집 여부 판별용)
 * @property {string} draftKey         drafts 를 만든 시점의 상품·주제·톤 조합
 * @property {Object|null} image       3단계 결과
 * @property {Object|null} card        4단계 카드뉴스
 * @property {Array} library           보관함 게시물
 */

/** @type {AppState} */
const INITIAL = {
  productId: null,
  topic: '',
  tone: 'trust',
  channels: ['blog', 'instagram', 'threads'],
  drafts: {},
  generated: {},
  variants: {},        // 채널별 재생성 횟수 — 누를 때마다 다른 후킹·근거 조합이 나온다
  draftKey: '',
  concept: 'photo',    // 카드뉴스 컨셉 id (lib/concepts.js)
  image: null,         // { variant, at } — 카드 문구 조합
  images: {},          // { [카드번호]: { source:'ai'|'upload', at } } · 실제 Blob 은 IndexedDB
  card: null,
  library: [],
};

/** 현재 입력 조합의 지문 — 상품·주제·톤이 바뀌면 초안이 낡았다고 판단한다 */
export const draftKeyOf = (s) => `${s.productId}|${s.topic.trim()}|${s.tone}`;

/** 4단계 흐름 정의 — 스테퍼·라우터 가드가 함께 사용 */
export const STEPS = [
  { n: 1, path: '/',         label: '상품·주제 선택',  icon: 'sparkles' },
  { n: 2, path: '/copy',     label: '아이디어 문서화', icon: 'fileText' },
  { n: 3, path: '/image',    label: '이미지 제작',     icon: 'image' },
  { n: 4, path: '/template', label: '카드뉴스 템플릿', icon: 'layout' },
];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...INITIAL, ...JSON.parse(raw) } : { ...INITIAL };
  } catch {
    return { ...INITIAL };
  }
}

let state = load();
const listeners = new Set();

/** @returns {AppState} 읽기 전용으로 취급할 것 */
export const getState = () => state;

/** @param {Partial<AppState>} patch */
export function setState(patch) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 용량 초과 등은 무시 — 화면 동작은 유지 */
  }
  listeners.forEach((fn) => fn(state));
}

/** @param {(s: AppState) => void} fn @returns {() => void} 구독 해제 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetFlow() {
  setState({
    productId: null, topic: '', drafts: {}, generated: {}, variants: {},
    draftKey: '', image: null, images: {}, card: null,
  });
}

/** 해시 라우팅 이동 */
export function navigate(path) {
  if (location.hash === `#${path}`) return;
  location.hash = `#${path}`;
}

/** 현재까지 진행된 단계 수 (스테퍼 활성/비활성 판단용) */
export function reachedStep() {
  if (Object.keys(state.images).length) return 4;   // 카드 이미지가 하나라도 있으면 템플릿으로
  if (Object.keys(state.drafts).length) return 3;
  if (state.productId && state.topic.trim()) return 2;
  return 1;
}
