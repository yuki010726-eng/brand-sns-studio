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
/**
 * ⚠️ **2026-08-20 — 이 줄이 모든 그림을 사무실 사진으로 만들고 있었다.**
 *
 * 예전 값: `all people are Korean, East Asian faces, Korean business setting in South Korea`
 * 장면에 사람이 없어도 **무조건** 붙었다. "Korean business setting" 이 들어가는 순간
 * 모델은 사무실과 사람을 그려 넣는다. 요청자 지적: "주제와 관련이 없고 느낌만 있는 이미지가 나온다."
 *
 * 이제 **장면에 사람이 있을 때만** 인물 국적을 못박고, 없으면 장소만 한국으로 둔다.
 * ⚠️ "business setting" 을 기본값으로 되살리지 말 것. 사물·질감 컷이 전부 사무실로 끌려간다.
 */
/**
 * ⚠️ `customer` · `client` 를 넣지 말 것. `customer satisfaction`(고객만족도)처럼 **사람이 아닌 항목명**에
 *    흔히 붙어서, 채점표 클로즈업 같은 사물 컷까지 인물 사진으로 끌고 간다(실제로 걸렸다).
 *    사람이 진짜 나오는 장면이면 person·shopper·owner 같은 말이 따로 붙는다.
 */
const PEOPLE = /\b(person|people|man|men|woman|women|owner|staff|team|employee|worker|shopper|hand|hands|shoulder|portrait|founder|manager|colleague)\b/i;
const localeFor = (shot) => (PEOPLE.test(String(shot || ''))
  ? 'all people are Korean with East Asian faces, shot in South Korea'
  : 'shot in South Korea, no people in frame');

/**
 * 카드마다 **거리감을 다르게** 돌린다 (2026-08-20).
 *
 * 장면(shot)이 비슷하게 나와도 프레이밍이 다르면 6장이 한 벌로 보이지 않는다.
 * 아웃라인이 촬영 방식을 고르게 시켜 뒀지만(outline.js 3단계), 모델이 안 지킬 때를 위한 안전망이다.
 *
 * ⚠️ **결정적이어야 한다.** 같은 카드는 몇 번을 뽑아도 같은 프레이밍이 나와야
 *    이미지를 다시 만들었을 때 앞뒤가 맞는다. 그래서 난수를 쓰지 않고 카드 번호로 고른다.
 */
const FRAMING = [
  'wide environmental shot, subject small in the frame',
  'tight macro close-up of a single detail, shallow depth of field',
  'top-down flat lay of objects arranged on a surface',
  'over-the-shoulder view looking toward a screen or document',
  'medium still-life of a few objects on a plain surface',
  'low-angle shot of a space, strong perspective lines',
];

export function buildPrompt(card, conceptId, opts = {}) {
  const concept = getConcept(conceptId);
  if (concept.id === 'note') return noteIconPrompt(card, opts.title, opts.subject);

  const framing = FRAMING[(Number(opts.index) || 0) % FRAMING.length];
  return [
    opts.subject
      ? `the photo must show what this Korean sentence is about: "${opts.subject}". Show the concrete object or action it refers to, not a mood or an atmosphere. Never render the sentence as text in the image`
      : '',
    card.shot,
    framing,
    localeFor(card.shot),
    SPACE[card.kind] || SPACE.body,
    concept.style,
    /**
     * ⚠️ **이 부정 지시를 빼지 말 것** (2026-08-20).
     * 요청자 지적: "주제와 관련이 없고 느낌만 있는 이미지가 나온다."
     * 이미지 모델은 지시가 추상적이면 자기가 아는 가장 안전한 그림 — 사무실에서 생각하는 사람 — 으로 돌아간다.
     * 장면을 구체적으로 적는 것(outline.js 3단계)과 **여기서 기본값을 막는 것**이 짝이다. 둘 다 있어야 한다.
     */
    'avoid generic stock-photo scenes: no person posing thoughtfully, no meeting room, no laptop on a desk unless the scene specifically calls for it',
    'vertical 4:5 portrait composition',
  ].filter(Boolean).join('. ');
}

/*
 * 덱 전체 프롬프트를 한 번에 뽑던 `buildPromptSheet()` 는 지웠다 (2026-08-10).
 * 「전체 복사」 버튼과 함께 쓰이던 함수인데 그 버튼을 없앴다 — 카드는 한 장씩 만들기 때문에
 * 여섯 장 프롬프트를 한 덩어리로 받아도 쓸 데가 없었다.
 * 다시 필요해지면 `buildPrompt()` 를 덱에 map 하면 된다.
 */
