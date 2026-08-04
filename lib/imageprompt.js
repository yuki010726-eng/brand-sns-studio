/**
 * 카드별 이미지 프롬프트 생성
 *
 * 장면(shot)은 카드 데이터에, 화풍(style)은 컨셉에 있다. 둘을 합쳐 영문 프롬프트를 만든다.
 * 프롬프트를 영문으로 쓰는 이유: 이미지 모델이 영문 지시를 훨씬 정확하게 따른다.
 */

import { getConcept } from './concepts.js';

/** 텍스트를 얹을 자리를 비워두라는 지시 — 카드 종류마다 필요한 여백이 다르다 */
const SPACE = {
  cover: 'leave the lower third of the frame visually calm and uncluttered so large text can be placed there',
  body: 'keep the composition simple with a calm area in the middle of the frame for a text panel',
  note: 'quiet contemplative composition with plenty of empty space',
  outro: 'calm balanced composition with open space in the lower half',
};

/**
 * 노트형 전용 — 사진이 아니라 **아이콘**을 만든다.
 *
 * 레퍼런스(쓸모실험실)의 표지는 그 장의 대주제를 굵은 검은 선 아이콘 하나로 보여준다.
 * 예전엔 다른 컨셉과 같은 장면 프롬프트를 써서 사진 같은 그림이 나왔다 — 결이 전혀 달랐다.
 *
 * 대주제를 그대로 넣는다. 한국어라도 모델이 개념은 알아듣고, 영어로 옮기면 뜻이 흐려진다.
 * 배경을 흰색으로 못박아야 카드의 종이색 위에 얹었을 때 사각형 자국이 남지 않는다.
 */
function noteIconPrompt(card, title) {
  return [
    `a single centered pictogram that expresses this idea: "${title || card.shot}"`,
    card.shot ? `visual motif to draw from: ${card.shot}` : '',
    'bold hand-drawn marker illustration, thick uniform black outlines, flat solid black fills',
    'no shading, no gradient, no perspective, monochrome black and white only',
    'one simple friendly subject, rounded shapes, generous empty margin on all sides',
    'plain flat off-white background, centered, icon-like',
    'no text, no letters, no words, no watermark, no logo, no signature',
  ].filter(Boolean).join('. ');
}

/**
 * @param {{kind:string, shot:string}} card buildDeck() 결과의 한 항목
 * @param {string} conceptId
 * @param {{title?:string}} [opts] 지금 화면에 보이는 대주제 — 있으면 그림이 그 주제를 따른다
 * @returns {string} 프롬프트
 */
export function buildPrompt(card, conceptId, opts = {}) {
  const concept = getConcept(conceptId);
  if (concept.id === 'note') return noteIconPrompt(card, opts.title);

  return [
    card.shot,
    SPACE[card.kind] || SPACE.body,
    concept.style,
    'vertical 4:5 portrait composition',
  ].join('. ');
}

/** 덱 전체의 프롬프트 — 한 번에 복사할 때 쓴다 */
export function buildPromptSheet(deck, conceptId, titles = []) {
  const concept = getConcept(conceptId);
  return [
    `[컨셉 ${concept.badge} · ${concept.name}] 카드뉴스 이미지 프롬프트`,
    '',
    ...deck.map((card, i) => `${String(i + 1).padStart(2, '0')}. ${buildPrompt(card, conceptId, { title: titles[i] })}`),
  ].join('\n\n');
}
