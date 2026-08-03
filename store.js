/**
 * 전역 스토어 — 아주 얇은 pub/sub + localStorage 영속화
 * 프레임워크 없이 쓰므로 상태 변경은 반드시 setState() 를 통해서만 한다.
 */

import { CONCEPTS } from './lib/concepts.js';
import { scheduleSync, isApplying } from './lib/sync.js';

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
  // 1단계 프로필 세팅 — 게시물이 아니라 **계정** 정보라 resetFlow() 에서 지우지 않는다
  profile: null,       // { typeId, name, bio, slug, link, imagePrompt }
  profileSeed: 0,      // 「다시 뽑기」 횟수 — 누를 때마다 다른 조합이 나온다
  productId: null,
  topic: '',
  tone: 'trust',
  channels: ['blog', 'instagram', 'threads'],
  cardCount: 6,        // 카드뉴스 장수 1~6 — API 비용을 줄이려고 요청자가 고르게 했다
  drafts: {},
  generated: {},
  variants: {},        // 채널별 재생성 횟수 — 누를 때마다 다른 후킹·근거 조합이 나온다
  sources: {},         // 채널별 생성 방식 { [채널]: 'rule' | 'ai' } — 화면에 표시만 한다
  // autoAI 토글은 없앴다(2026-08-03). 키가 있으면 항상 AI 가 쓴다 — 요청자 지시.
  aiKey: '',           // AI가 마지막으로 쓴 시점의 상품·주제·톤 조합 (자동 재실행 방지)
  draftKey: '',
  concept: 'magazine', // 카드뉴스 템플릿 id (lib/concepts.js)
  accent: '#B9F73E',   // 매거진형 강조 색상 (lib/concepts.js 의 DEFAULT_ACCENT)
  mark: 'asterisk',    // 카드형 우상단 마크 (lib/concepts.js 의 MARKS)
  cardTheme: 'blue',   // 카드형 테마 색 — 한 곳에만 둔다. 바꾸면 모든 장이 함께 바뀐다.
  noteSymbol: 'flask', // 노트형 좌상단 실험실 심볼 (lib/concepts.js 의 NOTE_SYMBOLS)
  notePaper: 'white',  // 노트형 종이 색
  noteGrain: 1,        // 종이 결(자글자글) 강도 0~3
  image: null,         // { variant, at } — 카드 문구 조합
  images: {},          // { [카드번호]: { source:'ai'|'upload', at } } · 실제 Blob 은 IndexedDB
  card: null,
  library: [],
};

/** 현재 입력 조합의 지문 — 상품·주제·톤이 바뀌면 초안이 낡았다고 판단한다 */
export const draftKeyOf = (s) => `${s.productId}|${s.topic.trim()}|${s.tone}|${s.cardCount}`;

/**
 * 4단계 흐름 정의 — 스테퍼·라우터 가드가 함께 사용.
 *
 * 이미지 제작은 별도 단계였다가 템플릿 안으로 합쳤다.
 * 이미지가 필수가 아닌데 단계로 세워 두니 흐름을 막는 것처럼 보였기 때문이다.
 *
 * 프로필 세팅은 2026-08-03에 **맨 앞에** 붙였다. 게시물마다 하는 일이 아니라
 * 계정을 한 번 세팅하는 단계라서 **건너뛸 수 있다** — reachedStep() 참고.
 */
export const STEPS = [
  { n: 1, path: '/profile',  label: '프로필 세팅',     icon: 'sparkles' },
  { n: 2, path: '/',         label: '상품·주제 선택',  icon: 'sparkles' },
  { n: 3, path: '/copy',     label: '아이디어 문서화', icon: 'fileText' },
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

  /**
   * 로그인돼 있으면 서버에도 올린다. 로그인 전이거나 서버 내용을 받아 얹는 중이면 아무 일도 안 한다.
   * 타이핑 한 글자마다 올라가지 않도록 sync 쪽에서 모아 보낸다.
   */
  if (!isApplying()) scheduleSync(state);
}

/** @param {(s: AppState) => void} fn @returns {() => void} 구독 해제 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetFlow() {
  setState({
    productId: null, topic: '', drafts: {}, generated: {}, variants: {}, sources: {},
    draftKey: '', aiKey: '', image: null, images: {}, card: null,
  });
}

/** 해시 라우팅 이동 */
export function navigate(path) {
  if (location.hash === `#${path}`) return;
  location.hash = `#${path}`;
}

/** 현재까지 진행된 단계 수 (스테퍼 활성/비활성 판단용) */
export function reachedStep() {
  // 이미지는 선택 사항이다 — 없으면 템플릿 기본 배경으로 그리므로
  // 글귀만 있으면 템플릿까지 진행할 수 있다.
  if (Object.keys(state.drafts).length) return 4;
  if (state.productId && state.topic.trim()) return 3;
  // 프로필 세팅은 계정을 한 번 잡는 단계라 **필수가 아니다.**
  // 여기서 1을 돌려주면 프로필을 만들기 전에는 상품 선택으로 못 넘어간다.
  return 2;
}
