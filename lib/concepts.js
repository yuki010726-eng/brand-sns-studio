/**
 * 카드뉴스 템플릿 3종
 * 바탕화면 '브랜드 sns 스타일 레퍼런스 자료' 의 세 계정에서 뽑아낸 스타일 정의.
 *
 * - style : 이미지 생성 프롬프트에 붙는 영문 스타일 지시어
 * - layout: 4단계 렌더러(lib/cardrender.js)가 쓰는 색·배치 값
 *
 * 이미지 프롬프트에는 항상 '글자를 넣지 말 것'을 명시한다.
 * 텍스트는 4단계에서 얹어야 수정이 가능하고, 생성 이미지의 한글은 깨진다.
 */

/** 모든 컨셉에 공통으로 붙는 금지 지시어 */
const NO_TEXT = 'no text, no letters, no words, no typography, no watermark, no logo, no signature';

/**
 * 매거진형 강조 색상 후보.
 * 하단 검정 그라데이션(거의 #000) 위에 올라가므로 전부 명도 대비 4.5:1 을 넘긴다.
 */
export const ACCENTS = [
  { id: 'lime', name: '형광 초록', hex: '#B9F73E' },
  { id: 'yellow', name: '형광 노랑', hex: '#FDF25C' },
  { id: 'orange', name: '오렌지', hex: '#FFA23A' },
  { id: 'red', name: '레드', hex: '#FF6B6B' },
  { id: 'cyan', name: '시안', hex: '#5FE1FF' },
  { id: 'white', name: '화이트', hex: '#FFFFFF' },
];

export const DEFAULT_ACCENT = ACCENTS[0].hex;

/**
 * 카드형 우상단 마크.
 * 레퍼런스는 파란 별표 하나뿐이지만 계정 성격에 맞춰 고를 수 있게 후보를 둔다.
 * draw 는 캔버스로 직접 그리는 도형(선명하고 색이 브랜드 컬러를 따른다),
 * glyph 는 시스템 이모지 폰트로 그린다.
 */
export const MARKS = [
  { id: 'asterisk', name: '별표', draw: 'asterisk' },
  { id: 'sparkle', name: '반짝임', draw: 'sparkle' },
  { id: 'star', name: '별', draw: 'star' },
  { id: 'dot', name: '점', draw: 'dot' },
  { id: 'plus', name: '십자', draw: 'plus' },
  { id: 'fire', name: '🔥 불꽃', glyph: '🔥' },
  { id: 'bulb', name: '💡 전구', glyph: '💡' },
  { id: 'check', name: '✅ 체크', glyph: '✅' },
  { id: 'point', name: '👉 손가락', glyph: '👉' },
  { id: 'none', name: '없음' },
];

export const DEFAULT_MARK = MARKS[0].id;

/**
 * 카드형 테마 색.
 *
 * 요청자 요구(2026-08-03): 파랑 말고 초록·노랑 같은 색도 고를 수 있게 하고,
 * **한 장을 바꾸면 나머지 장도 같이 바뀌게** 할 것. 그래서 색은 카드마다가 아니라
 * `state.cardTheme` 한 곳에만 둔다.
 *
 * ⚠️ 전부 흰 글씨가 올라가는 색이다. 명도 대비 4.5:1 을 넘겨야 한다.
 *    색을 추가하면 반드시 다시 계산할 것 — 노랑 계열을 밝게 쓰면 바로 미달이다.
 *    그래서 '노랑'은 밝은 노랑이 아니라 짙은 호박색이다.
 */
export const CARD_THEMES = [
  { id: 'blue', name: '파랑', hex: '#2673D2', light: '#8FC4FB' },
  { id: 'green', name: '초록', hex: '#17795C', light: '#8FE0C4' },
  { id: 'amber', name: '노랑', hex: '#9A6700', light: '#FFD98A' },
  { id: 'violet', name: '보라', hex: '#6D46C8', light: '#C9B6FF' },
  { id: 'rose', name: '자주', hex: '#C2185B', light: '#FFB3CE' },
  { id: 'ink', name: '먹색', hex: '#333D4B', light: '#AEB8C4' },
];

export const DEFAULT_CARD_THEME = CARD_THEMES[0].id;

/** @param {string} id */
export const getCardTheme = (id) => CARD_THEMES.find((t) => t.id === id) || CARD_THEMES[0];

/**
 * 노트형 좌상단 심볼.
 *
 * 레퍼런스(쓸모실험실)의 심볼은 **실험실 컨셉의 아이콘**이다 — 굵은 검은 실루엣, 평면, 그림자 없음.
 * 요청자 요구(2026-08-03): 그 무드에 맞는 아이콘을 여러 개 넣어 고를 수 있게 할 것.
 *
 * 실제 브랜드 로고가 아니라 **같은 결의 대체 아이콘**이다. 로고 파일이 생기면
 * 이미지 슬롯으로 넣으면 되고, 그때는 이 심볼 대신 이미지가 그려진다.
 */
export const NOTE_SYMBOLS = [
  { id: 'flask', name: '플라스크' },
  { id: 'beaker', name: '비커' },
  { id: 'tube', name: '시험관' },
  { id: 'bulb', name: '전구' },
  { id: 'microscope', name: '현미경' },
  { id: 'magnifier', name: '돋보기' },
  { id: 'atom', name: '원자' },
  { id: 'gear', name: '톱니바퀴' },
  { id: 'clip', name: '클립보드' },
  { id: 'none', name: '없음' },
];

export const DEFAULT_NOTE_SYMBOL = NOTE_SYMBOLS[0].id;

/**
 * 노트형 종이 색.
 * 기존 #F2F2F0 은 누런(브라운) 회색이라는 지적이 있어 계열을 나눴다.
 * 셋 다 밝아서 본문색(#3F3F3D)·부제색(#5F5F5D) 대비는 그대로 유지된다.
 */
export const NOTE_PAPERS = [
  { id: 'white', name: '흰색', hex: '#FAFAF9' },
  { id: 'gray', name: '회색', hex: '#EFEFEE' },
  { id: 'blue', name: '블루 그레이', hex: '#ECF0F4' },
];

export const DEFAULT_NOTE_PAPER = NOTE_PAPERS[0].id;
export const getNotePaper = (id) => NOTE_PAPERS.find((x) => x.id === id) || NOTE_PAPERS[0];

/** 종이 결(자글자글) 강도 — 0 은 매끈한 단색 */
export const NOTE_GRAINS = [
  { id: 0, name: '없음', dots: 0, alpha: 0 },
  { id: 1, name: '약하게', dots: 900, alpha: 0.016 },
  { id: 2, name: '보통', dots: 2600, alpha: 0.026 },
  { id: 3, name: '강하게', dots: 6000, alpha: 0.036 },
];

export const DEFAULT_NOTE_GRAIN = 1;
export const getNoteGrain = (id) => NOTE_GRAINS.find((x) => x.id === Number(id)) || NOTE_GRAINS[1];

/** @param {string} id */
export const getNoteSymbol = (id) => NOTE_SYMBOLS.find((s) => s.id === id) || NOTE_SYMBOLS[0];

/** @param {string} id */
export const getMark = (id) => MARKS.find((m) => m.id === id) || MARKS[0];

export const CONCEPTS = [
  {
    id: 'magazine',
    badge: 'A',
    name: '매거진형',
    ref: 'ai.brief.kr',
    desc: '실사 사진 위 하단 검정 그라데이션. 상단 중앙 계정명, 흰 제목 + 형광색 강조 한 줄.',
    mood: '후킹 최강. 스크롤을 멈춰 세워야 하는 뉴스·이슈형 콘텐츠에 잘 맞습니다.',
    accentPicker: true,        // 강조 색상을 고를 수 있는 유일한 컨셉
    style: [
      'cinematic editorial news photograph, dramatic directional lighting, rich saturated colors',
      'wide dynamic composition, high detail, magazine cover quality',
      'darker tone toward the bottom of the frame for text legibility',
      NO_TEXT,
    ].join(', '),
    layout: {
      surface: '#0B0F14',
      titleColor: '#FFFFFF',
      bodyColor: '#FFFFFF',
      subColor: 'rgba(255,255,255,0.92)',
      overlay: 'bottom-dark',
    },
  },
  {
    id: 'card',
    badge: 'B',
    name: '카드형',
    ref: 'soosangmarket',
    desc: '하단 파랑 그라데이션. 2페이지부터 파란 박스(대주제) + 흰 박스(소주제), 마지막은 파랑 단색 팔로우 유도.',
    mood: '정보 전달. 순서대로 읽히는 정리형 콘텐츠에 잘 맞습니다.',
    style: [
      'bright natural documentary photograph, clear daylight, open sky or wide scene',
      'clean uncluttered composition with generous empty space in the middle and lower area',
      'cool blue leaning color grading',
      NO_TEXT,
    ].join(', '),
    /**
     * 레퍼런스의 파랑은 #3B93F7 이지만 흰 글씨 대비가 3.13:1 이라 요청자 지정 기준(4.5:1)에 못 미친다.
     * 큰 글씨만 올라가서 WCAG 기준으로는 통과하지만(3:1) 여유가 없어 한 단계 낮춘 값을 쓴다 — 4.7:1.
     * 레퍼런스 색으로 되돌리려면 아래 두 줄만 #3B93F7 / #2E8BF7 로 바꾸면 된다.
     */
    layout: {
      surface: '#2673D2',      // 마무리 카드의 단색 배경
      brand: '#2673D2',        // 대주제 박스 · 그라데이션 · 별표 마크
      titleColor: '#FFFFFF',
      bodyColor: '#191F28',    // 흰 박스 안 검은 글씨
      panel: '#FFFFFF',
      overlay: 'bottom-brand',
    },
  },
  {
    id: 'note',
    badge: 'C',
    name: '노트형',
    ref: 'sslmo.lab',
    desc: '종이 배경에 검은 글씨. 미니멀 아이콘 + 대주제 + 본문. 번호·강조로 끊어 읽게 만듭니다.',
    mood: '담백·솔직. 정보를 조곤조곤 풀어주는 콘텐츠에 잘 맞습니다.',
    style: [
      'hand-drawn black ink illustration, thick bold outlines, flat monochrome, no color',
      'single simple centered subject on a plain off-white background, generous empty space',
      'minimal icon-like shape, high contrast, no shading',
      NO_TEXT,
    ].join(', '),
    layout: {
      surface: '#F2F2F0',      // 종이
      titleColor: '#111111',
      bodyColor: '#3F3F3D',
      // #8A8A88 은 종이 배경에서 2.9:1 이라 부제에 쓸 수 없다 → 5.6:1 인 값으로 올렸다
      subColor: '#5F5F5D',
      accent: '#111111',
      overlay: 'paper',
    },
  },
];

/** @param {string} id */
export const getConcept = (id) => CONCEPTS.find((c) => c.id === id) || CONCEPTS[0];

/** 매거진형만 강조 색상을 쓴다. 나머지는 자기 레이아웃 색을 유지한다. */
export function accentOf(concept, chosen) {
  if (!concept.accentPicker) return concept.layout.accent || concept.layout.brand || '#FFFFFF';
  return chosen || DEFAULT_ACCENT;
}
