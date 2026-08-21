/**
 * 직관형(D) — **카드가 아니라 이미지 프롬프트를 만든다.**
 *
 * A·B·C 는 캔버스가 배경 위에 글자를 얹는 템플릿이다. 직관형은 그게 아니다.
 * 요청자가 준 레퍼런스(바탕화면 `concept_직관형` 9장)는 **글자까지 이미지 안에 들어가 있는**
 * 한국형 성과 광고 배너다 — 말풍선 후킹 · 극태 헤드라인 · 큰 숫자 · 체크리스트 · 하단 CTA 바가
 * 한 장에 다 있다. 캔버스로 흉내 낼 수 있는 배치가 아니라서 템플릿으로 만들지 않았다.
 *
 * ⚠️ **여기서는 `no text` 를 쓰지 않는다.** `lib/imageprompt.js` 는 정반대다 — 거기서는 글자를
 *    빼야 4단계에서 얹을 수 있고 생성된 한글이 깨지기 때문이다. 직관형은 글자가 그림의 절반이라
 *    **한글을 그릴 수 있는 모델**에서 써야 한다. 화면에서 그렇게 안내한다.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ **2026-08-20 전면 개편 — 처음 만든 방식이 틀렸다.**
 *
 * 처음에는 레퍼런스 9장에서 배치 4종·색 3종을 뽑아 **장마다 돌려 썼다.** 의도는
 * "여러 장을 뽑아도 한 벌로 보이지 않게"였는데, 그게 정확히 거꾸로였다. 요청자 지적:
 * "이미 만들어진 이미지를 재활용하는 느낌이야. 하나의 컨셉으로 만들면 그 주제에서 생성되는
 *  카드뉴스의 컨셉은 통일 시켜줘."
 *
 * 원인이 둘이었다.
 *   ① **`card.shot` 을 한 번도 안 썼다.** 덱에는 아웃라인이 주제에 맞춰 지은 영문 장면이
 *      들어 있는데(`lib/outline.js` 3단계) 그걸 버리고 내 고정 배치 문구만 넣었다.
 *      그래서 주제를 바꿔도 그림에 찍히는 것이 안 바뀌었다 — '재활용' 은 이 얘기다.
 *   ② **배치·색을 장마다 돌렸다.** 카드뉴스는 한 벌로 읽혀야 하는데 6장이 6개의 다른 광고가 됐다.
 *
 * 지금 구조는 축이 둘로 갈라져 있다.
 *   **컨셉(고정)** — 인물·색·화풍. 주제 하나에 하나. 전 장이 공유한다.
 *   **장면(가변)** — 그 카드가 말하는 것. `card.shot` 과 카드 문구에서 나온다.
 *
 * ⚠️ 이 둘을 다시 섞지 말 것. 컨셉을 장마다 돌리면 ②로 돌아가고,
 *    장면을 고정하면 ①로 돌아간다.
 */

/**
 * 컨셉 — **주제 하나에 하나만 고른다.** 전 장이 같은 인물·같은 색·같은 화풍을 쓴다.
 *
 * `cast` 는 이미지 모델이 매 장 같은 사람을 그리게 하는 근거다. 그래서 **얼굴·머리·옷을
 * 구체적으로** 적는다 — "웃는 한국 여성" 처럼 두루뭉술하면 장마다 다른 사람이 나온다.
 *
 * ⚠️ `cast` 에서 나이·성별·의상 중 하나라도 빼지 말 것. 이 셋이 인물 동일성을 잡는 축이다.
 */
export const AD_CONCEPTS = [
  {
    id: 'woman-yellow',
    name: '웃는 여성 모델',
    who: '20대 여성이 손짓하며 말을 거는 사진',
    when: '처음 알리는 글 · 눈길을 끌어야 할 때',
    swatch: ['#FCF6E8', '#FFD400', '#E8214A'],
    person: true,
    cast: 'a Korean woman in her late twenties, dark brown hair pulled into a loose bun with soft bangs, warm open smile with visible teeth, wearing a mustard-yellow ribbed knit sweater, raising one index finger in an explaining gesture',
    palette: 'background warm cream #FCF6E8, primary yellow #FFD400, alert red #E8214A, deep black bars and pills #111111, body text near-black #111111',
    art: 'photographic cut-out of the model composited onto flat vector graphics, crisp cut edges, one soft radiating burst behind her, small hand-drawn sparkle and motion marks',
  },
  {
    id: 'man-navy',
    name: '정장 남성 모델',
    who: '30대 남성이 차분하게 설명하는 사진',
    when: '숫자·근거로 믿음을 줘야 할 때',
    swatch: ['#FFFFFF', '#16305C', '#FFC81E'],
    person: true,
    cast: 'a Korean man in his late thirties, short neatly-parted black hair, calm confident half-smile, wearing a white dress shirt under a navy blazer with no tie, one open palm presenting toward the text',
    palette: 'background off-white #FFFFFF, primary deep navy #16305C, highlight yellow #FFC81E, alert red #E23A2E, body text near-black #14181F',
    art: 'photographic cut-out of the model composited onto flat vector graphics with thin navy rule lines, crisp cut edges, hand-painted circular badge shapes',
  },
  {
    id: 'duo-cartoon',
    name: '두 사람 만화',
    who: '고민하는 사람과 알려주는 사람 그림',
    when: '「이런 고민 → 이렇게 해결」 구성',
    swatch: ['#FAF3E3', '#FFD84D', '#9AA0A6'],
    person: true,
    cast: 'two Korean cartoon characters — a worried office worker in a grey shirt with round glasses, and a cheerful advisor in a yellow cardigan holding a clipboard',
    palette: 'background warm cream #FAF3E3, desaturated grey #9AA0A6 for the problem side, bright yellow #FFD84D for the solution side, alert red #E8391F, text near-black #111111',
    art: 'clean flat cartoon illustration, thick even outlines, simple cel shading, no photographic elements anywhere',
  },
  {
    id: 'scene-real',
    name: '매장 사진',
    who: '사람 없이 매장·사무실 실제 사진',
    when: '제품이나 현장을 보여줄 때',
    swatch: ['#EFE7DC', '#16305C', '#FFC81E'],
    person: false,
    cast: 'no people in frame; a warm, bright Korean small-business interior — pale wood counter, white subway tile, black pendant lights, a few potted plants — even daylight from the left',
    palette: 'natural warm photo tones, deep navy #16305C panels and bars, highlight yellow #FFC81E, text near-black #14181F on white cards',
    art: 'realistic interior photograph as the background with flat vector text panels, brush-stroke shapes, and rounded white cards composited on top',
  },
  {
    id: 'icon-flat',
    name: '아이콘 그림',
    who: '사람 없이 아이콘과 도형만',
    when: '절차·항목을 정리해 보여줄 때',
    swatch: ['#FAF3E3', '#1F7A45', '#FFD84D'],
    person: false,
    cast: 'no people and no photographs anywhere; flat vector icons with rounded 2px strokes, solid fills, and a consistent 8px corner radius',
    palette: 'background cream #FAF3E3, primary deep green #1F7A45, alert red #E8391F, highlight yellow #FFD84D, text near-black #111111',
    art: 'pure flat vector graphic design, no photographs, no gradients, generous white space, simple geometric shapes',
  },
];

export const DEFAULT_AD_CONCEPT = AD_CONCEPTS[0].id;
export const getAdConcept = (id) => AD_CONCEPTS.find((c) => c.id === id) || AD_CONCEPTS[0];

/**
 * 톤앤매너 → 컨셉 (2026-08-21, 요청자 지시: "톤앤매너 선택에서 ~형에 따라 알맞은 스타일이
 * 직관형에 적용되도록").
 *
 * 1단계에서 이미 고른 것으로 정한다 — **같은 것을 두 번 고르게 하지 않는다.**
 * 8-31 ②에서 장수를 1단계로 넘긴 것과 같은 판단이다.
 *
 * | 톤 | 컨셉 | 왜 |
 * |---|---|---|
 * | trust 신뢰·정보형 | 정장 남성 | 숫자·근거로 믿음을 주는 자리 |
 * | hook 후킹·공감형 | 두 사람 만화 | 「이런 고민 → 이렇게 해결」이 곧 후킹 구성 |
 * | plain 담백·실무형 | 아이콘 그림 | 절차·항목만 남긴다. 인물이 없어야 요점이 산다 |
 * | celebrate 축하·발표형 | 웃는 여성 | 소식을 밝게 전하는 자리 |
 *
 * ⚠️ 매장 사진(`scene-real`)은 어느 톤에도 안 걸린다 — **고르는 사람이 직접 바꿀 때만** 쓴다.
 *    톤이 넷인데 컨셉이 다섯이라 그렇다. 톤을 늘리지 말고 이 표에 억지로 끼워 넣지도 말 것.
 */
const AD_CONCEPT_BY_TONE = {
  trust: 'man-navy',
  hook: 'duo-cartoon',
  plain: 'icon-flat',
  celebrate: 'woman-yellow',
};

/** 이 톤에 맞는 컨셉 id. 모르는 톤이면 기본값. */
export const adConceptForTone = (tone) => AD_CONCEPT_BY_TONE[tone] || DEFAULT_AD_CONCEPT;

/**
 * 카드의 **역할별 구도.** 컨셉이 아니라 이쪽이 장마다 달라진다.
 *
 * 레퍼런스도 표지와 본문의 짜임이 다르다 — 표지는 헤드라인이 화면 절반을 먹고,
 * 본문은 말하려는 물건이 커지고, 마무리는 행동 유도가 중심이다.
 */
const ROLE_FRAME = {
  cover: [
    'this is the cover card: the headline is the largest element and fills the left 60% of the frame',
    'a rounded speech-bubble hook sits above the headline',
    'the subject sits on the right, waist-up and prominent',
    'a dashed-outline rounded box holds the number line beneath the headline',
  ],
  body: [
    'this is a body card: the thing being explained is the largest element, centered and clearly readable',
    'the headline sits across the top in two lines, smaller than on the cover',
    'the subject appears smaller at one edge, gesturing toward the thing being explained',
    'a short caption strip sits directly under the main object',
  ],
  note: [
    'this is the objection card: split the frame into a muted left half and a bright right half',
    'the headline sits across the top, and a thick arrow points from the muted side to the bright side',
    'the subject appears on the bright side only',
  ],
  outro: [
    'this is the closing card: the call to action is the largest element, centered',
    'the subject is smaller and positioned to one side, gesturing toward the call to action',
    'a row of short check items sits beneath the call to action',
  ],
};

/**
 * ⚠️ **장수를 여기서 고르지 않는다** (2026-08-20, 요청자 지시: "직관형은 왜 8장이야?
 *    상품 주제에서 선택되도록 해줘"). 장수는 1단계 「카드뉴스 장수」(`state.cardCount`) 하나가 정하고,
 *    직관형은 덱 길이를 그대로 쓴다.
 *
 * 이렇게 하면 **덱과 장수가 어긋날 일이 없어진다** — 앞서 있던 '내용이 모자라 반복된다',
 * '뒤 항목이 빠진다' 문제가 통째로 사라진다. 선택지를 두 곳에 두지 말 것.
 */

/* ---------------- 문구 뽑기 ---------------- */

const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();

/**
 * 상한을 넘으면 **어절 경계에서** 끊는다.
 *
 * ⚠️ **글자 수로 그냥 자르지 말 것.** 이 프로젝트가 같은 자리에서 두 번 데였다 —
 *    8-11 의 `trimWords()`, 8-25 의 「중앙일보 연합광고와 포브스…」. 여기 문구는
 *    **광고 이미지에 큰 글씨로 박히는** 것이라 어절 중간에서 끊기면 그대로 사고다.
 */
function trimWords(text, max) {
  const t = clean(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return at > 0 ? t.slice(0, at) : t;
}

/** 문장 하나만 — 카드 본문은 여러 문장이라 그대로 넣으면 헤드라인이 안 된다 */
function firstSentence(text, max = 34) {
  const one = clean(text).split(/(?:[.!?…])\s|\n/)[0] || '';
  return trimWords(one.replace(/[.]+$/, ''), max);
}

/**
 * 헤드라인을 두 줄로 나눈다 — 레퍼런스는 전부 2~3줄 스택이다.
 * 띄어쓰기 기준으로 **가운데에 가장 가까운 자리**에서 끊는다. 한 덩어리면 그대로 한 줄이다.
 */
function twoLines(text, max = 26) {
  const t = trimWords(text, max * 2);
  const words = t.split(' ');
  if (words.length < 2) return [t, ''];
  const half = t.length / 2;
  let best = 1;
  let bestGap = Infinity;
  let run = 0;
  words.forEach((w, i) => {
    run += w.length + 1;
    if (i === words.length - 1) return;
    const gap = Math.abs(run - half);
    if (gap < bestGap) { bestGap = gap; best = i + 1; }
  });
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

const NUMBER_MAX = 32;
const BULLET_MAX = 16;
const CTA_MAX = 26;
const HOOK_MAX = 14;
const CTA_FALLBACK = '지금 문의하고 시작하세요';

/**
 * 숫자가 들어간 근거 한 줄. 레퍼런스의 「1건당 40~80만원」 자리다.
 *
 * ⚠️ **지어내지 않는다.** 상품 자료(`facts`)나 그 카드 본문에 숫자가 있으면 그것을 쓰고,
 *    없으면 이 줄을 통째로 비운다. 광고 이미지에 큰 글씨로 찍히는 숫자라 틀리면 그대로 사고다.
 * ⚠️ **통째로 들어가는 것만 쓴다.** 어절 경계에서 끊어도 「심사 배점 1,000점 중 고객만족도가」
 *    같은 조각이 남는데, 이 줄은 그림에서 가장 큰 글씨라 조각이면 바로 눈에 띈다.
 */
function numberLine(product, card) {
  const hasNum = /\d/;
  const fromCard = clean(card && card.body).split(/(?:[.!?])\s|\n/).find((x) => hasNum.test(x));
  const fromFacts = (product.facts || []).find((x) => hasNum.test(String(x)));
  const fits = [fromCard, fromFacts].map(clean).filter((x) => x && x.length <= NUMBER_MAX);
  return fits[0] || '';
}

/**
 * 체크 리스트 — 칸에 통째로 들어가는 특전만.
 * ⚠️ 표지·마무리에만 넣는다. 본문 카드까지 같은 목록을 반복하면 장마다 같은 그림이 된다.
 */
const bulletsOf = (product) => (product.benefits || [])
  .map(clean).filter((x) => x && x.length <= BULLET_MAX).slice(0, 3);

/**
 * 하단 바 문구 — 승인된 CTA 목록에서 고른다.
 *
 * ⚠️ **자르지 않는다.** 승인된 CTA 는 23~32자인데(8-25) 하단 바에 들어가는 길이는 그보다 짧다.
 *    어절 경계에서 끊어도 「…프로필 링크에서」처럼 **동사가 날아간 조각**이 남는다.
 *    통째로 들어가는 것만 쓰고, 없으면 행동 안내 한 줄로 넘긴다.
 * ⚠️ **한 벌 안에서는 같은 문구를 쓴다.** 장마다 다른 CTA 가 뜨면 한 벌로 안 읽힌다.
 */
function ctaOf(product) {
  const fits = (product.voice && product.voice.ctas ? product.voice.ctas : [])
    .map(clean).filter((x) => x && x.length <= CTA_MAX);
  return fits[0] || CTA_FALLBACK;
}

/** 말풍선 후킹 — 말풍선에 통째로 들어가는 것만. 없으면 브랜드 짧은 이름. */
function hookOf(product, card) {
  const pool = [card && card.title, ...(product.appeals || [])]
    .map(clean).filter((x) => x && x.length <= HOOK_MAX);
  return pool[0] || clean(product.short);
}

/**
 * 이 카드가 **무엇을 보여주는지** — 주제에서 나온다.
 *
 * ⚠️ 여기가 개편의 핵심이다. `card.shot` 은 아웃라인이 그 항목을 보고 지은 영문 장면이라
 *    주제가 바뀌면 같이 바뀐다. 이걸 안 쓰면 그림이 고정 배치 문구만 따라가서
 *    **주제와 무관한 같은 그림**이 나온다 (8-20 ②와 같은 실패다).
 */
function subjectOf(card, topic) {
  const shot = clean(card && card.shot);
  if (shot) return shot;
  // 아웃라인이 없는 경로(규칙 기반·옛 보관본)에서는 카드 제목이라도 넘긴다.
  const fallback = clean((card && card.title) || topic);
  return fallback ? `a concrete object or scene that represents: "${fallback}"` : '';
}

/** 몇 번째 카드가 어떤 역할인지 — 첫 장은 표지, 마지막 장은 마무리, 사이는 본문 */
function roleAt(i, total, card) {
  if (total === 1) return 'cover';
  if (i === 0) return 'cover';
  if (i === total - 1) return 'outro';
  if (card && card.kind === 'note') return 'note';
  return 'body';
}

/**
 * i 번째 장이 어느 덱 카드를 재료로 쓰는지.
 *
 * 표지는 덱 첫 장, 마무리는 덱 마지막 장으로 못박고 **사이는 본문 카드를 고르게 편다.**
 *
 * ⚠️ 요청 장수가 덱과 다를 수 있다 (덱은 1~6장, 프롬프트는 1~8장). 두 방향 다 함정이 있다.
 *    - **덱보다 적게** 뽑을 때 앞에서부터 자르면 뒤 항목이 통째로 빠진다.
 *      그래서 `Math.floor` 로 **고르게 건너뛴다** — 6장 덱에서 4장이면 ①②④⑥.
 *    - 장수는 이제 덱 길이와 항상 같으므로(1단계가 정한다) **덱보다 많이 뽑는 경우 자체가 없다.**
 *      장수 선택지를 다시 만들면 그 문제가 되살아난다.
 */
function cardAt(i, total, deck) {
  if (!deck.length) return null;
  if (i === 0) return deck[0];
  if (i === total - 1) return deck[deck.length - 1];
  const middle = deck.slice(1, -1);
  if (!middle.length) return deck[0];
  const slots = Math.max(1, total - 2);
  return middle[Math.min(middle.length - 1, Math.floor(((i - 1) * middle.length) / slots))];
}



/* ---------------- 프롬프트 ---------------- */

/**
 * @param {{product:object, topic:string, deck:Array, conceptId:string}} ctx
 * @returns {Array<{n:number, role:string, concept:object, copy:object, prompt:string}>}
 */
export function buildAdPrompts({ product, topic, deck = [], conceptId }) {
  const total = Math.max(1, deck.length);   // 장수 = 덱 길이 (1단계에서 정한 카드 장수)
  const concept = getAdConcept(conceptId);
  const cta = ctaOf(product);          // 한 벌에서 하나만 쓴다
  const bullets = bulletsOf(product);

  return Array.from({ length: total }, (_, i) => {
    const card = cardAt(i, total, deck);
    const role = roleAt(i, total, card);
    const [line1, line2] = twoLines((card && card.title) || topic);

    const copy = {
      hook: role === 'cover' ? hookOf(product, card) : '',
      line1,
      line2,
      sub: firstSentence((card && card.body) || topic, 30),
      number: role === 'cover' ? numberLine(product, card) : '',
      // 체크 리스트는 표지·마무리에만. 본문마다 반복하면 같은 그림이 된다.
      bullets: role === 'cover' || role === 'outro' ? bullets : [],
      cta,
      hashtags: (product.hashtags || []).slice(0, 4).map((x) => clean(x)),
    };

    return {
      n: i + 1,
      role,
      concept,
      copy,
      prompt: promptOf({ product, concept, role, copy, subject: subjectOf(card, topic), index: i, total }),
    };
  });
}

const ROLE_LABEL = { cover: '표지', body: '본문', note: '반론', outro: '마무리' };
export const roleLabel = (role) => ROLE_LABEL[role] || '본문';

/**
 * 프롬프트 한 벌.
 *
 * 지시는 영문, **찍을 글자는 한글 그대로** 따옴표에 넣는다. 번역하라고 두면 모델이 뜻만 살려
 * 제 마음대로 다시 쓴다 — 승인되지 않은 말이 광고에 찍힌다.
 *
 * ⚠️ **`SERIES` 절을 빼지 말 것.** 이미지 모델은 한 장씩 따로 그리므로, 같은 벌이라고
 *    말해 주지 않으면 장마다 다른 사람·다른 색이 나온다. 인물 동일성은 이 절이 잡는다.
 */
function promptOf({ product, concept, role, copy, subject, index, total }) {
  const lines = [
    copy.hook && `speech bubble hook: "${copy.hook}"`,
    copy.line1 && `headline line 1: "${copy.line1}"`,
    copy.line2 && `headline line 2: "${copy.line2}"`,
    copy.sub && `supporting line: "${copy.sub}"`,
    copy.number && `big number line: "${copy.number}"`,
    copy.bullets.length ? `check list items: ${copy.bullets.map((b) => `"${b}"`).join(' / ')}` : '',
    copy.cta && `bottom CTA bar: "${copy.cta}"`,
    role === 'outro' && copy.hashtags.length
      ? `hashtag pills: ${copy.hashtags.map((h) => `"${h}"`).join(' / ')}`
      : '',
  ].filter(Boolean).map((line) => `  - ${line}`).join('\n');

  return [
    'Create a brand-new square 1:1 Korean direct-response social ad card from this description alone.',
    /**
     * ⚠️ **참조할 그림이 있다고 말하지 않는다** (2026-08-21, 요청자 지적).
     *    예전에는 `SERIES: … keep them identical across the set` · `SUBJECT (identical on every card)`
     *    처럼 **다른 그림을 가리키는 말**로 통일을 지시했다. 그런데 그 그림은 존재하지 않는다.
     *    그래서 모델이 "기준이 될 캐릭터를 주세요" 라고 되묻거나 **이미지 편집 작업으로 오해**했다.
     *
     *    통일은 참조로 잡는 게 아니라 **묘사로 잡는다.** 인물·색·화풍을 매 장 똑같은 문장으로
     *    적어 두면 따로 그려도 같은 그림이 나온다 — 그게 `cast`·`palette`·`art` 가 있는 이유다.
     *    ⚠️ `cast` 에 「the same … throughout」 같은 말을 다시 넣지 말 것. 그 순간 참조 요구가 된다.
     */
    'This is a text-to-image request. No reference image is provided and none is needed —'
      + ' do not ask for one, and do not treat this as editing an existing image.',
    ...(total > 1 ? [
      `This card is number ${index + 1} of ${total} in a series. The series look is fully written out below,`
        + ' so follow it exactly and the cards will match even though each one is drawn separately.',
    ] : []),
    `SUBJECT: ${concept.cast}`,
    `WHAT THIS CARD SHOWS: ${subject}`,
    `LAYOUT: ${ROLE_FRAME[role].join(', ')}`,
    `COLOR PALETTE: ${concept.palette}`,
    `STYLE: ${concept.art}`,
    'typography: extra-bold rounded Korean gothic (heavy weight), thick white outline and a soft drop shadow on the largest lines, one key word per line filled with the accent color, numbers set far larger than the surrounding words',
    'a full-width solid CTA bar is pinned to the very bottom edge with a circular icon on the left and a circular arrow button on the right',
    'generous margins, everything inside a safe area away from the edges',
    ...(concept.person ? ['all people are Korean with East Asian faces, styled for a South Korean audience'] : []),
    '',
    'RENDER THIS KOREAN TEXT EXACTLY AS WRITTEN, character for character, and no other words anywhere in the image:',
    lines,
    '',
    `brand handle in small type at a corner: "${clean(product.handle || product.short)}"`,
    'negative: no English sentences, no invented text, no garbled or misspelled Hangul, no watermark, no stock-photo logo, no extra taglines beyond the list above, no request for a reference image, no blank placeholder frames',
  ].join('\n');
}
