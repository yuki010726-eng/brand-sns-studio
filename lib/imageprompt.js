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
 * @param {{kind:string, shot:string}} card buildDeck() 결과의 한 항목
 * @param {string} conceptId
 * @returns {string} 영문 프롬프트
 */
export function buildPrompt(card, conceptId) {
  const concept = getConcept(conceptId);
  return [
    card.shot,
    SPACE[card.kind] || SPACE.body,
    concept.style,
    'square 1:1 composition',
  ].join('. ');
}

/** 덱 전체의 프롬프트 — 한 번에 복사할 때 쓴다 */
export function buildPromptSheet(deck, conceptId) {
  const concept = getConcept(conceptId);
  return [
    `[컨셉 ${concept.badge} · ${concept.name}] 카드뉴스 이미지 프롬프트`,
    '',
    ...deck.map((card, i) => `${String(i + 1).padStart(2, '0')}. ${buildPrompt(card, conceptId)}`),
  ].join('\n\n');
}
