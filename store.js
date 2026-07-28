/**
 * 전역 스토어 — 아주 얇은 pub/sub + localStorage 영속화
 * 프레임워크 없이 쓰므로 상태 변경은 반드시 setState() 를 통해서만 한다.
 */

import { CONCEPTS } from './lib/concepts.js';

const KEY = 'bboggl.sns-studio.v1';
const CONCEPT_IDS = CONCEPTS.map((c) => c.id);

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
  concept: 'magazine', // 카드뉴스 템플릿 id (lib/concepts.js)
  accent: '#B9F73E',   // 매거진형 강조 색상 (lib/concepts.js 의 DEFAULT_ACCENT)
  mark: 'asterisk',    // 카드형 우상단 마크 (lib/concepts.js 의 MARKS)
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
    const s = raw ? { ...INITIAL, ...JSON.parse(raw) } : { ...INITIAL };

    // 템플릿 개편(2026-07-28) 이전에 저장된 값 정리.
    // 없어진 컨셉 id(photo/mono/cinematic)가 남아 있으면 4단계 문구 슬롯이 조용히 어긋난다.
    if (!CONCEPT_IDS.includes(s.concept)) {
      s.concept = INITIAL.concept;
      s.card = null;
    }
    return s;
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
  // 배경 이미지는 선택 사항이다 — 없으면 컨셉별 기본 배경으로 그리므로
  // 글귀만 있으면 템플릿까지 진행할 수 있다.
  if (Object.keys(state.drafts).length) return 4;
  if (state.productId && state.topic.trim()) return 2;
  return 1;
}
