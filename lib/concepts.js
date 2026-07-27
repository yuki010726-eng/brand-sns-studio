/**
 * 카드뉴스 컨셉 3종
 * 바탕화면 '브랜드 sns 계정 정보' 레퍼런스에서 뽑아낸 스타일 정의.
 *
 * - style : 이미지 생성 프롬프트에 붙는 영문 스타일 지시어
 * - layout: 4단계 템플릿에서 텍스트를 얹을 때 쓰는 값
 *
 * 이미지 프롬프트에는 항상 '글자를 넣지 말 것'을 명시한다.
 * 텍스트는 4단계에서 얹어야 수정이 가능하고, 생성 이미지의 한글은 깨진다.
 */

/** 모든 컨셉에 공통으로 붙는 금지 지시어 */
const NO_TEXT = 'no text, no letters, no words, no typography, no watermark, no logo, no signature';

export const CONCEPTS = [
  {
    id: 'photo',
    badge: 'A',
    name: '실사 사진형',
    ref: 'soosangmarket',
    desc: '풀블리드 실사 사진 위에 굵은 흰 텍스트. 본문 카드는 사진 위에 흰 카드 박스를 얹습니다.',
    mood: '신뢰감·정통성. 브랜드 어워즈처럼 근거를 말하는 콘텐츠에 잘 맞습니다.',
    style: [
      'professional editorial photography, realistic, natural daylight',
      'shallow depth of field, muted natural color grading, documentary feel',
      'clean uncluttered composition with generous negative space in the lower half for text overlay',
      NO_TEXT,
    ].join(', '),
    layout: {
      surface: '#FFFFFF',       // 본문 카드의 흰 박스
      titleColor: '#FFFFFF',
      bodyColor: '#191F28',
      accent: '#3182F6',
      overlay: 'bottom-dark',   // 하단 어둡게 깔고 흰 글씨
      bodyStyle: 'card',        // 본문은 흰 박스 안에
    },
  },
  {
    id: 'mono',
    badge: 'B',
    name: '모노톤 일러스트형',
    ref: 'sslmo.lab',
    desc: '종이 질감 배경에 흑백 손그림. 핵심 문장은 검정 하이라이트 박스로 계단처럼 배치합니다.',
    mood: '담백·솔직. 정보를 조곤조곤 풀어주는 콘텐츠에 잘 맞습니다.',
    style: [
      'hand-drawn black ink illustration, thick bold outlines, flat monochrome, no color',
      'off-white textured paper background, subtle paper grain',
      'single simple centered subject, generous empty space around it, minimal',
      NO_TEXT,
    ].join(', '),
    layout: {
      surface: '#F4F3F0',
      titleColor: '#111111',
      bodyColor: '#333333',
      accent: '#111111',
      overlay: 'none',          // 배경이 밝아 오버레이 없이 검은 글씨
      bodyStyle: 'highlight',   // 검정 하이라이트 박스
    },
  },
  {
    id: 'cinematic',
    badge: 'C',
    name: 'AI 시네마틱형',
    ref: 'ai.brief.kr',
    desc: '시네마틱한 AI 이미지 위에 흰색 + 네온그린 2줄 제목. 하단은 어둡게 깔아 가독성을 확보합니다.',
    mood: '후킹 최강. 스크롤을 멈추게 해야 하는 콘텐츠에 잘 맞습니다.',
    style: [
      'cinematic film still, dramatic directional lighting, rich saturated colors',
      'wide-angle dynamic composition, high detail, movie poster quality',
      'darker tone toward the bottom of the frame for text legibility',
      NO_TEXT,
    ].join(', '),
    layout: {
      surface: '#0B0F14',
      titleColor: '#FFFFFF',
      accentText: '#B9F73E',    // 레퍼런스의 네온그린 강조색
      bodyColor: '#FFFFFF',
      accent: '#B9F73E',
      overlay: 'bottom-dark',
      bodyStyle: 'overlay',
    },
  },
];

/** @param {string} id */
export const getConcept = (id) => CONCEPTS.find((c) => c.id === id) || CONCEPTS[0];
