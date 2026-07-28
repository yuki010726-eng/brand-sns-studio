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
