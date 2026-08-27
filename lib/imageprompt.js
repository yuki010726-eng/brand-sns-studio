/**
 * 카드별 이미지 프롬프트 생성
 *
 * 장면(shot)은 카드 데이터에, 화풍(style)은 컨셉에 있다. 둘을 합쳐 영문 프롬프트를 만든다.
 * 프롬프트를 영문으로 쓰는 이유: 이미지 모델이 영문 지시를 훨씬 정확하게 따른다.
 */

import { getConcept } from './concepts.js';

/**
 * 텍스트를 얹을 자리를 비워두라는 지시 — 카드 종류마다 필요한 여백이 다르다.
 *
 * ⚠️ **2026-08-28 교체 — 「어둡게」가 아니라 「비우라」로** (`MAGAZINE_IMAGE_PROMPT.md` 3절).
 *    예전 `note` 값은 `quiet contemplative composition` 이었는데, 그건 여백이 아니라 **무드 형용사**다.
 *    무드를 넣으면 주제가 뭐든 같은 사진이 된다 — 고정 블록에서 무드를 걷어낸 것과 같은 이유다.
 */
const SPACE = {
  cover: 'keep the lower third of the frame free of clutter and important detail so text can be placed there',
  body: 'keep the composition simple with a calm area in the middle of the frame for a text panel',
  note: 'keep the composition simple with a calm area in the middle of the frame for a text panel',
  outro: 'calm balanced composition with open space in the lower half',
};

/**
 * 노트형 전용 그림체 — **빈티지 손그림 펠트펜** (2026-08-28 교체, 명세는 `NOTE_ICON_PROMPT.md` 2절).
 *
 * 요청자 지정: "빈티지스러우면서도 손그림 같은 느낌이 중요하다."
 * 이전 값 `bold hand-drawn marker illustration, thick uniform black outlines` 는 선 굵기가 한 종류라
 * 뭉툭했고, 그다음 판의 `clean editorial pictogram … crisp corners` 는 자로 그은 아이콘팩이 됐다.
 *
 * ⚠️ **손그림이라고 거칠게 만들면 안 된다.** `dry-brush` · `scratchy` · `sketchy` 는 지저분해지고
 *    배경 제거까지 망가진다. **선이 흔들리되 가장자리는 깨끗한 것**이 목표라 그 둘을 같이 못박았다.
 * ⚠️ **`no hatching` 이하 부정 7종을 빼지 말 것.** 손그림을 지시하는 순간 모델이 빗금·점묘로
 *    채우려 든다 — 실제로 모래를 점묘로 그려서 걸렸다.
 * ⚠️ `uniform` · `crisp` · `precise` · `geometric` 을 되살리지 말 것. 아이콘팩으로 돌아간다.
 */
const NOTE_STYLE = [
  'hand-drawn ink illustration in black line on transparent background',
  'drawn with a felt-tip marker at an even medium thickness — thicker than a fineliner, thinner than a brush pen, every stroke is one confident continuous pass whose edge waves and wobbles clearly enough to read as hand-drawn, but the edge stays clean: no rough dry-brush texture, no scratchy or broken edges, no blobs, line weight stays consistent across the whole drawing',
  'FLAT FILLS ONLY with no texture, no hatching, no cross-hatching, no stippling, no sketchy fill strokes, no scribbles, no shading, no gradient, no cast shadows, no drop shadows, no 3D volume, no perspective, flat front-on view',
  'simple clear shapes, the whole illustration reads as ONE connected silhouette, elements overlap and touch',
  'generous even margin, nothing touching the frame edges',
  '1:1 square, transparent background, isolated cutout with no outline or halo around it',
  'not taken from an icon library, no icon-pack look, no white outline around the shape',
  'no floating disconnected elements',
  'no text, no letters, no numbers, no watermark, no logo, no signature',
].join(', ');

/**
 * 노트형 전용 — 사진이 아니라 **그림**을 만든다.
 *
 * 레퍼런스(쓸모실험실)의 표지는 그 장의 대주제를 굵은 검은 선 그림 하나로 보여준다.
 * 예전엔 다른 컨셉과 같은 장면 프롬프트를 써서 사진 같은 그림이 나왔다 — 결이 전혀 달랐다.
 *
 * 대주제를 그대로 넣는다. 한국어라도 모델이 개념은 알아듣고, 영어로 옮기면 뜻이 흐려진다.
 *
 * ⚠️ **`card.icon` 을 먼저 본다** (`lib/outline.js` 가 만든다). 없으면 `card.shot` 으로 떨어지는데,
 *    그건 **실사 사진용 장면**이라 픽토그램 재료로는 결이 어긋난다. 기존 보관본을 위한 폴백일 뿐이다.
 */
function noteIconPrompt(card, title, subject) {
  const motif = card.icon || card.shot;
  return [
    `a single centered illustration that expresses this idea: "${subject || title || motif}"`,

    /**
     * ⚠️ **아래 세 줄이 「주제와 상관없는 그림」을 막는다. 제일 중요하다. 빼지 말 것.**
     *    같은 주제를 세 판 실패하며 나온 것이다 (`NOTE_ICON_PROMPT.md` 7절).
     */
    'draw what the sentence CLAIMS, not the objects it mentions. the picture must let a viewer restate the claim. never draw the opposite of the claim',
    'if the sentence is a question, show that the answer is not decided yet; if it is a statement, show it as already true',
    'use only symbols any reader understands without insider knowledge: a company is a building, an award is a trophy, an application is an envelope, a certification is a round badge, time is a clock',

    'if a Korean word in the sentence has more than one meaning, use the meaning the sentence intends. never picture a different sense of the word',
    'never depict the award, certificate or product being used casually, as a joke, or for an unintended purpose. it must look valuable',

    // ⚠️ 아래 세 줄이 「나열된 아이콘」과 「알아볼 수 없는 조연」을 막는다. 빼지 말 것.
    'draw ONE main object with at most one secondary element, and the secondary element must physically touch, overlap, wrap or rest on the main object',
    'describe them as a single action, never as a list of separate props',
    'never wrap or band a sheet of paper around another object — paper must keep its corners visible, half inserted into a slot or opening',

    // ⚠️ 흐름 기호를 막으면 주장이 뒤집힌다 — 모래시계 목을 막아 「시간이 멈췄다」가 나왔다 (7절 ①)
    'if the drawing contains anything that flows or progresses, it must be shown still flowing, never blocked or stopped',

    motif ? `visual motif to draw from: ${motif}` : '',

    // ⚠️ 무엇을 희게 비우고 무엇을 회색으로 채울지 안 적으면 전부 같은 무게로 그려져 주연이 안 보인다 (3절)
    'FILL: the object that carries the claim is left WHITE and empty inside so it stands out; the supporting object is filled with one flat mid-grey (#DCDCDC) so it sits back; solid black only for the outlines and the smallest details. no stars, no sparkles, no rays',

    NOTE_STYLE,
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

/*
 * `FRAMING` 배열은 지웠다 (2026-08-28, `MAGAZINE_IMAGE_PROMPT.md` 2절).
 *
 * 카드 번호로만 거리감을 돌리던 배열이다 — 1번은 언제나 wide, 2번은 언제나 macro.
 * **주제가 뭐든 6장 구성이 항상 같아서 「다 비슷하다」의 구조적 원인**이었다.
 * 게다가 아웃라인이 이미 촬영 방식을 고르게 시키므로(outline.js 3단계)
 * **두 곳에서 프레이밍을 지시하면 서로 싸운다.** 카메라는 이제 `shot` 이 직접 갖는다.
 *
 * ⚠️ 되살리지 말 것. 6장이 비슷해 보이면 손댈 곳은 여기가 아니라 `shot` 이다.
 * ⚠️ 호출부가 아직 `opts.index` 를 넘기지만 쓰지 않는다 — 넘겨도 해가 없어 그대로 뒀다.
 */

/**
 * 조립 순서 — **화풍이 먼저, 주제가 마지막이다** (2026-08-28).
 *
 * 예전에는 주제를 맨 앞에 두고 화풍을 뒤에 뒀다. **뒤에 오는 지시가 이기므로 화풍이 늘 주제를 덮었다.**
 * (텍스트 프롬프트는 이 원리를 이미 배웠다 — `CLAUDE.md` 8-34 에서 스타일 블록을 채널 규칙 뒤로
 *  옮긴 이유가 같다. 이미지 프롬프트만 반대로 돼 있었다.)
 *
 * 이제 순서가 이렇다:
 *   고정 블록(화풍·색) → 인물·장소 → 여백 → stock-photo 금지 → 비율 → 장면 → **주제 + 우선권 선언**
 *
 * ⚠️ 마지막 절의 「충돌하면 주제가 이긴다」를 빼지 말 것. 그 한 줄이 순서 뒤집기의 핵심이다.
 */
export function buildPrompt(card, conceptId, opts = {}) {
  const concept = getConcept(conceptId);
  if (concept.id === 'note') return noteIconPrompt(card, opts.title, opts.subject);

  return [
    concept.style,
    localeFor(card.shot),
    SPACE[card.kind] || SPACE.body,
    /**
     * ⚠️ **이 부정 지시를 빼지 말 것** (2026-08-20).
     * 요청자 지적: "주제와 관련이 없고 느낌만 있는 이미지가 나온다."
     * 이미지 모델은 지시가 추상적이면 자기가 아는 가장 안전한 그림 — 사무실에서 생각하는 사람 — 으로 돌아간다.
     * 장면을 구체적으로 적는 것(outline.js 3단계)과 **여기서 기본값을 막는 것**이 짝이다. 둘 다 있어야 한다.
     */
    'avoid generic stock-photo scenes: no person posing thoughtfully, no meeting room, no laptop on a desk unless the scene specifically calls for it',
    'vertical 4:5 portrait composition',
    card.shot,
    opts.subject
      ? `THE SUBJECT IS WHAT MATTERS MOST: the photo must show what this Korean sentence is about: "${opts.subject}". Show the concrete object or action it refers to. If the style above pulls toward a generic mood, the subject wins. Never render the sentence as text in the image`
      : '',
  ].filter(Boolean).join('. ');
}

/*
 * 덱 전체 프롬프트를 한 번에 뽑던 `buildPromptSheet()` 는 지웠다 (2026-08-10).
 * 「전체 복사」 버튼과 함께 쓰이던 함수인데 그 버튼을 없앴다 — 카드는 한 장씩 만들기 때문에
 * 여섯 장 프롬프트를 한 덩어리로 받아도 쓸 데가 없었다.
 * 다시 필요해지면 `buildPrompt()` 를 덱에 map 하면 된다.
 */
