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
  // 프로필 탭 설정 — 게시물이 아니라 **계정** 정보라 resetFlow() 에서 지우지 않는다
  profile: null,       // { typeId, name, bio, slug, link, imagePrompt }
  profileSeed: 0,      // 「다시 뽑기」 횟수 — 누를 때마다 다른 조합이 나온다
  productId: null,
  /**
   * 지금 만들고 있는 **게시물의 신원** (2026-08-21). 카드 이미지 키에 들어간다
   * (`lib/imagestore.js` 의 `imageKey`). 새 게시물을 시작할 때마다 새로 만든다.
   *
   * ⚠️ **비어 있는 상태를 유지해야 하는 경우가 있다.** 이 값이 생기기 전에 저장된 작업은
   *    옛 키(`상품-템플릿-번호`)로 이미지를 갖고 있다. 여기서 값을 채워 버리면 그 이미지가
   *    통째로 안 보인다. 그래서 `load()` 는 채우지 않고 **새 게시물을 시작할 때만** 만든다.
   */
  postId: '',
  topic: '',
  focusPoint: '',     // 이번 게시물에서 특히 강조할 내용 (선택 입력)
  // "다른 이름으로 저장" 때 보관함에서만 쓰는 이름. 글 생성 주제와 분리한다.
  libraryTitle: '',
  tone: 'trust',
  channels: ['blog', 'instagram', 'threads'],
  cardCount: 6,        // 카드뉴스 장수 1~6 — API 비용을 줄이려고 요청자가 고르게 했다
  /**
   * ⚠️ **`adCount` 는 없앴다** (2026-08-20). 직관형 장수는 `cardCount` 하나가 정한다 —
   * 선택지를 두 곳에 두면 덱과 장수가 어긋난다 (`lib/adprompt.js` 머리말 참고).
   */
  /**
   * 직관형(D) 컨셉 — 인물·색·화풍 (2026-08-20). **주제 하나에 하나만 고른다.**
   * 장마다 돌리지 않는다 — 카드뉴스는 한 벌로 읽혀야 한다 (`lib/adprompt.js` 머리말 참고).
   */
  adConcept: 'woman-yellow',
  /**
   * `adConcept` 를 **직접 고른 시점의 톤** (2026-08-21). 지금 톤과 같을 때만 그 선택을 쓴다.
   * 비어 있으면 톤이 컨셉을 정한다 (`adConceptForTone`, `lib/adprompt.js`).
   */
  adConceptTone: '',
  drafts: {},
  generated: {},
  variants: {},        // 채널별 재생성 횟수 — 누를 때마다 다른 후킹·근거 조합이 나온다
  sources: {},         // 채널별 생성 방식 { [채널]: 'rule' | 'ai' } — 화면에 표시만 한다
  // autoAI 토글은 없앴다(2026-08-03). 키가 있으면 항상 AI 가 쓴다 — 요청자 지시.
  /**
   * AI가 마지막으로 쓴 시점의 프롬프트 지문 — **채널별로** 따로 둔다 (자동 재실행 방지).
   * 한 덩어리로 두면 카드 장수만 바꿔도 인스타·쓰레드까지 다시 생성된다.
   * 지문을 만드는 규칙은 `promptKeyOf()` (lib/copyai.js) 에 있다.
   * @type {{blog?:string, instagram?:string, threads?:string}}
   */
  aiKey: {},
  /**
   * AI 가 주제로 짠 글의 뼈대 (`lib/outline.js`). 세 채널과 카드뉴스 덱이 **함께** 본다.
   * 이게 있어야 글귀를 새로 뽑을 때 카드 문구도 같이 바뀐다.
   * @type {{key:string, data:object}|null}
   */
  outline: null,
  /**
   * 파생 1회에서 나온 **카드 전용 문구** (2026-08-20). `key` 가 지금 조건과 같을 때만 쓴다.
   * 블로그 소제목을 앞에서 자른 덱보다 낫다 — 글 전체를 보고 만든 것이라 카드만 넘겨도 말이 된다.
   * @type {{key:string, cards:Array<{title:string, body:string}>}|null}
   */
  cardCopy: null,
  /**
   * 모아 둔 블로그 스타일 (2026-08-20). 프로필처럼 **한 번 모아 두고 게시물마다 골라 쓴다.**
   * 목록 순서가 그대로 A타입 · B타입이 된다 (`lib/blogstyles.js`) — 순서를 함부로 섞지 말 것.
   * @type {Array<{id:string, name:string, guide:string, at:number, sources:string[]}>}
   */
  styles: [],
  /** 지금 고른 스타일 id. `null` 이면 스타일 없이 쓴다. */
  styleId: null,
  /** 블로그 연구에서 추출한 스타일. key가 현재 상품·주제와 같을 때만 AI 생성에 쓴다. */
  researchStyle: null, // { key, guide, at }
  /**
   * 「AI 생성」을 누를 때마다 제한 없이 쌓이는 결과물 (AI 1 · AI 2 · AI 3…).
   * `key` 는 `outlineKeyOf()`(상품·주제·톤)와 같은 지문이다. 주제가 바뀌면
   * 새 지문으로 결과 목록을 시작한다 — 결과 묶음은 **주제 단위**다.
   * @type {{key:string, groupId?:string, list:Array<{drafts:object, generated:object, core?:object, outlineRound?:number}>}}
   */
  aiRuns: { key: '', list: [] },
  /** 지금 화면에 보이는 게 aiRuns.list 의 몇 번째인지 (0-based) — 규칙 기반을 보고 있으면 null */
  activeAiRun: null,
  draftKey: '',
  concept: 'magazine', // 카드뉴스 템플릿 id (lib/concepts.js)
  accent: '#B9F73E',   // 매거진형 강조 색상 (lib/concepts.js 의 DEFAULT_ACCENT)
  mark: 'asterisk',    // 카드형 우상단 마크 (lib/concepts.js 의 MARKS)
  cardTheme: 'blue',   // 카드형 테마 색 — 한 곳에만 둔다. 바꾸면 모든 장이 함께 바뀐다.
  noteSymbol: 'flask',  // 노트형 좌상단 실험실 심볼 (lib/concepts.js 의 NOTE_SYMBOLS)
  notePaper: 'white',  // 노트형 종이 색
  noteInk: 'black',    // 노트형 글씨 색 (lib/concepts.js 의 NOTE_INKS · #RRGGBB 직접 입력도 받는다)
  noteGrain: 35,       // 종이 결 강도 0~100 (예전 0~3 값은 getNoteGrain 이 올려 준다)
  image: null,         // { variant, at } — 카드 문구 조합
  images: {},          // { [카드번호]: { source:'ai'|'upload', at } } · 실제 Blob 은 IndexedDB
  card: null,
  library: [],
};

/** 현재 입력 조합의 지문 — 상품·주제·톤이 바뀌면 초안이 낡았다고 판단한다 */
export const draftKeyOf = (s) => `${s.productId}|${s.topic.trim()}|${String(s.focusPoint || '').trim()}|${s.tone}|${s.cardCount}`;

/**
 * 3단계 게시물 제작 흐름 정의 — 스테퍼·라우터 가드가 함께 사용.
 *
 * 이미지 제작은 별도 단계였다가 템플릿 안으로 합쳤다.
 * 이미지가 필수가 아닌데 단계로 세워 두니 흐름을 막는 것처럼 보였기 때문이다.
 *
 * 프로필 세팅은 게시물마다 하는 일이 아니라 계정을 한 번 잡는 설정이라
 * 별도 상단 탭으로 분리한다. 따라서 이 목록에는 게시물 제작 단계만 둔다.
 */
/**
 * ⚠️ **스타일 수집은 단계가 아니다** (2026-08-20, 요청자 지시).
 *    8-20 에 2단계로 넣었는데, 게시물을 만들 때마다 검색·수집·분석을 다시 하게 돼 번거로웠다.
 *    프로필 세팅과 같은 성격이다 — **한 번 모아 두고 게시물마다 골라 쓰는 설정**이다.
 *    그래서 `/research` 는 단계에서 빠지고 헤더 메뉴로 옮겼다.
 */
export const STEPS = [
  { n: 1, path: '/',         label: '상품·주제 선택',  icon: 'sparkles' },
  { n: 2, path: '/copy',     label: '아이디어 문서화', icon: 'fileText' },
  { n: 3, path: '/template', label: '카드뉴스 템플릿', icon: 'layout' },
];

/**
 * 옛 저장분(`researchStyle`)을 스타일 목록으로 옮긴다 (2026-08-20).
 * 주제에 묶여 있던 값이라 그냥 두면 주제가 바뀌는 순간 못 쓰게 된다. 이름을 붙여 목록에 올린다.
 */
function migrateStyle(s) {
  if (!s || !s.researchStyle?.guide) return s;
  if (Array.isArray(s.styles) && s.styles.length) return s;
  return {
    ...s,
    styles: [{ id: 'st_legacy', name: '이전에 수집한 스타일', guide: s.researchStyle.guide, at: s.researchStyle.at || Date.now(), sources: [] }],
  };
}

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

    /**
     * aiKey 가 문자열이던 시절(채널 구분 없이 draftKeyOf 하나)의 값을 채널별로 편다.
     * 그냥 비우면 이미 AI 로 쓴 게시물을 열자마자 세 채널을 다시 생성한다 —
     * 낭비를 줄이려는 변경이 도리어 호출을 만드는 셈이라, 형태만 바꿔서 옮긴다.
     * 옛 키 = `상품|주제|톤|장수` 이고 블로그의 새 키와 정확히 같다. 나머지 둘은 장수를 뗀 것이다.
     */
    if (typeof s.aiKey === 'string') {
      const short = s.aiKey.split('|').slice(0, 3).join('|');
      s.aiKey = s.aiKey ? { blog: s.aiKey, instagram: short, threads: short } : {};
    }
    return migrateStyle(s);
  } catch {
    return { ...INITIAL };
  }
}

let state = load();
const listeners = new Set();

/**
 * 마지막 저장에서 난 오류. 보통은 용량 초과(QuotaExceededError)다.
 *
 * 화면 동작은 유지해야 하므로 여기서 던지지는 않는다. 다만 **삼키기만 하면**
 * 보관함처럼 "저장했다"고 말해 놓고 실제로는 안 남은 상황이 생긴다.
 * 그래서 흔적을 남겨 두고, 저장을 알리는 쪽에서 확인할 수 있게 한다.
 * @type {Error|null}
 */
let persistError = null;
export const lastPersistError = () => persistError;

/** @returns {AppState} 읽기 전용으로 취급할 것 */
export const getState = () => state;

/** @param {Partial<AppState>} patch */
export function setState(patch) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    persistError = null;
  } catch (e) {
    /* 용량 초과 등은 화면 동작을 막지 않는다 — 대신 흔적을 남긴다 */
    persistError = e;
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

/**
 * 새 게시물의 id — 이미지 키가 게시물마다 갈리게 하는 값이다.
 * ⚠️ 결정적일 필요가 없다. 겹치지만 않으면 된다.
 */
export const newPostId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function resetFlow() {
  setState({
    postId: newPostId(),
    productId: null, topic: '', focusPoint: '', libraryTitle: '', drafts: {}, generated: {}, variants: {}, sources: {},
    draftKey: '', aiKey: {}, outline: null, researchStyle: null,
    aiRuns: { key: '', list: [] }, activeAiRun: null,
    image: null, images: {}, card: null,
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
  // 연구는 참고 단계이므로 상품·주제를 정하면 문서화까지 이동할 수 있다.
  if (state.productId && state.topic.trim()) return 3;
  return 1;
}
