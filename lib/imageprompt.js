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
function noteIconPrompt(card, title, subject) {
  return [
    `a single centered pictogram that expresses this idea: "${subject || title || card.shot}"`,
    subject ? `the pictogram must visually communicate the meaning of this Korean editorial caption: "${subject}"` : '',
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
/**
 * 사람과 공간을 **한국**으로 못박는다 (2026-08-13, 요청자 지적).
 *
 * 예전에는 국적을 한 번도 적지 않았다. 이미지 모델의 기본값이 서양이라
 * "a small business owner at a desk" 는 거의 항상 백인·서양식 사무실로 나왔다.
 * 국내 중소기업을 대상으로 하는 콘텐츠라 등장인물이 외국인이면 설득력이 떨어진다.
 *
 * ⚠️ **화풍·무드는 건드리지 않는다** (요청자 지시: "무드나 이런 건 괜찮으니 그대로").
 *    concept.style 은 그대로 두고 인물·장소만 지정한다.
 * ⚠️ 사람이 없는 장면(사물·공간만)에도 붙여도 해가 없다 — 모델이 무시한다.
 *    조건부로 넣으려면 shot 에 사람이 있는지 판별해야 하는데, 자연어라 정확히 못 가른다.
 */
const LOCALE = 'all people are Korean, East Asian faces, Korean business setting in South Korea';

export function buildPrompt(card, conceptId, opts = {}) {
  const concept = getConcept(conceptId);
  if (concept.id === 'note') return noteIconPrompt(card, opts.title, opts.subject);

  return [
    opts.subject
      ? `primary editorial subject: visually depict the meaning of this Korean caption, "${opts.subject}"; use it as the main scene direction, not as text inside the image`
      : '',
    card.shot,
    LOCALE,
    SPACE[card.kind] || SPACE.body,
    concept.style,
    'vertical 4:5 portrait composition',
  ].filter(Boolean).join('. ');
}

/*
 * 덱 전체 프롬프트를 한 번에 뽑던 `buildPromptSheet()` 는 지웠다 (2026-08-10).
 * 「전체 복사」 버튼과 함께 쓰이던 함수인데 그 버튼을 없앴다 — 카드는 한 장씩 만들기 때문에
 * 여섯 장 프롬프트를 한 덩어리로 받아도 쓸 데가 없었다.
 * 다시 필요해지면 `buildPrompt()` 를 덱에 map 하면 된다.
 */
