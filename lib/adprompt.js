/**
 * 직관형(D) — **카드가 아니라 이미지 프롬프트를 만든다.**
 *
 * A·B·C 는 캔버스가 배경 위에 글자를 얹는 템플릿이다. 직관형은 그게 아니다.
 * 요청자가 준 레퍼런스(바탕화면 `concept_직관형` 9장)는 **글자까지 이미지 안에 들어가 있는**
 * 한국형 성과 광고 배너다 — 말풍선 후킹 · 극태 헤드라인 · 큰 숫자 · 체크리스트 · 하단 CTA 바가
 * 한 장에 다 있다. 캔버스로 흉내 낼 수 있는 배치가 아니라서 템플릿으로 만들지 않았다.
 *
 * 요청자 판단(2026-08-20): "이건 템플릿보다 이미지 프롬프트를 원하는 개수에 따라 만들어주는 게 맞다."
 * 그래서 이 파일은 **원하는 장수만큼 프롬프트 묶음**을 돌려준다. 실제 그림은 밖에서 만든다.
 *
 * ⚠️ **여기서는 `no text` 를 쓰지 않는다.** `lib/imageprompt.js` 는 정반대다 — 거기서는 글자를
 *    빼야 4단계에서 얹을 수 있고 생성된 한글이 깨지기 때문이다. 직관형은 글자가 그림의 절반이라
 *    **한글을 그릴 수 있는 모델**에서 써야 한다. 화면에서 그렇게 안내한다.
 */

/**
 * 레퍼런스 9장에서 뽑은 배치 원형 4종.
 *
 * 장마다 다른 배치를 돌려서 같은 주제로 여러 장을 뽑아도 한 벌로 보이지 않게 한다
 * (`lib/imageprompt.js` 의 FRAMING 과 같은 생각이다). **난수를 쓰지 않는다** — 같은 번호는
 * 몇 번을 뽑아도 같은 배치가 나와야 다시 만들었을 때 앞뒤가 맞는다.
 */
export const AD_LAYOUTS = [
  {
    id: 'cutout',
    name: '인물 컷아웃형',
    desc: '크림색 배경 · 오른쪽에 웃는 한국인 모델 컷아웃 · 왼쪽에 말풍선과 극태 헤드라인.',
    scene: [
      'square 1:1 Korean direct-response social ad banner',
      'right 40% of the frame: a cheerful Korean model cut out on a flat background, waist-up, bright studio lighting, one index finger raised or holding a phone, big open smile, looking straight at the camera',
      'left 60%: a rounded speech-bubble hook at the top, then a stacked extra-bold headline where one line sits inside a solid rounded color block',
      'below the headline: a dashed-outline rounded box holding the number line at huge size',
      'bottom left: a slightly tilted note card with a short check list, flat vector check marks',
      'a full-width solid CTA bar pinned to the very bottom edge with a circular phone icon on the left and a circular arrow button on the right',
    ].join(', '),
  },
  {
    id: 'compare',
    name: '비교 만화형',
    desc: '왼쪽 고민 / 오른쪽 해결. 두 칸 만화 일러스트에 빨간 화살표, 아래 숫자 띠.',
    scene: [
      'square 1:1 Korean direct-response ad built as a two-panel comparison comic',
      'top half split into two panels: the left panel is desaturated grey and shows a worried Korean person at a desk with small grey thought bubbles, the right panel is a bright yellow radiating background showing the same person smiling and giving an OK hand sign while holding a clipboard',
      'a thick red arrow between the two panels pointing right',
      'bottom third: a white band with the number line at enormous size, plus a small highlighted phrase and two check items on one row',
      'a full-width solid CTA bar pinned to the very bottom edge with a circular phone icon and a circular arrow button',
      'clean flat cartoon illustration, thick clean outlines, simple cel shading',
    ].join(', '),
  },
  {
    id: 'iconrow',
    name: '아이콘 그리드형',
    desc: '모델 + 검정 숫자 박스 + 하단 원형 아이콘 4칸. 해시태그가 붙는 CTA 바.',
    scene: [
      'square 1:1 Korean direct-response social ad banner',
      'upper right: a smiling Korean model cut out, waist-up, index finger raised, on a flat two-tone background with a diagonal color wedge behind them',
      'upper left: a small speech-bubble hook, then a two-line extra-bold headline with the second line in an accent color and a hand-drawn underline swash',
      'middle left: a solid dark rounded box containing the number line in huge accent-colored figures',
      'lower area: a row of four circular white badges, each with a simple flat vector icon and a short caption under it',
      'a full-width solid CTA bar pinned to the very bottom edge, with small rounded hashtag pills sitting on it and a circular arrow button at the right',
    ].join(', '),
  },
  {
    id: 'scene',
    name: '실사 장면형',
    desc: '실제 매장·사무실 사진 위에 붓터치 헤드라인. 흰 아이콘 카드 + 네이비 하단 띠.',
    scene: [
      'square 1:1 Korean direct-response ad over a real photograph',
      'background: a warm, bright, realistic Korean small-business interior photo (counter, shelves, plants, pendant lights) with the relevant products arranged neatly on the counter on the right side',
      'left side: an extra-bold headline stack where the strongest line sits on a rough painted brush-stroke shape, plus a handwritten-style accent line',
      'top right: a hand-painted circular badge holding the number line',
      'lower area: a wide white rounded card with four evenly spaced flat vector icons, each with a two-line caption',
      'a full-width solid deep-navy strip pinned to the very bottom edge with four short icon captions in a row',
    ].join(', '),
  },
];

/**
 * 색 조합 3종 — 레퍼런스에서 그대로 뽑았다.
 * ⚠️ 배치와 **따로 돌린다.** 배치 4 × 색 3 이라 12장까지 같은 조합이 안 나온다.
 */
export const AD_PALETTES = [
  {
    id: 'cream-green',
    name: '크림 · 딥그린',
    spec: 'background cream #FAF3E3, primary deep green #1F7A45, alert red #E8391F, highlight yellow #FFD84D, text near-black #111111',
  },
  {
    id: 'cream-yellow',
    name: '크림 · 옐로우',
    spec: 'background cream #FCF6E8, primary yellow #FFD400, alert red #E8214A, text near-black #111111, deep black bars #111111',
  },
  {
    id: 'white-navy',
    name: '화이트 · 네이비',
    spec: 'background off-white #FFFFFF, primary deep navy #16305C, highlight yellow #FFC81E, alert red #E23A2E, text near-black #14181F',
  },
];

/** 만들 수 있는 장수 — 1장(단일 배너)부터 8장(같은 주제로 여러 벌)까지 */
export const AD_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];
export const DEFAULT_AD_COUNT = 4;

/* ---------------- 문구 뽑기 ---------------- */

const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();

/**
 * 상한을 넘으면 **어절 경계에서** 끊는다.
 *
 * ⚠️ **글자 수로 그냥 자르지 말 것.** 이 프로젝트가 같은 자리에서 두 번 데였다 —
 *    8-11 의 `trimWords()`, 8-25 의 「중앙일보 연합광고와 포브스…」. 여기 문구는
 *    **광고 이미지에 큰 글씨로 박히는** 것이라 어절 중간에서 끊기면 그대로 사고다.
 * ⚠️ 첫 어절 하나가 이미 상한을 넘으면 끊을 자리가 없다. 그때만 그대로 돌려준다 —
 *    자르는 것보다 길게 두는 편이 낫다(줄바꿈은 이미지 모델이 알아서 한다).
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

/**
 * 숫자가 들어간 근거 한 줄. 레퍼런스의 「1건당 40~80만원」 자리다.
 *
 * ⚠️ **지어내지 않는다.** 상품 자료(`facts`)에 숫자가 있으면 그것을 쓰고, 없으면 이 줄을 통째로
 *    비운다. 광고 이미지에 큰 글씨로 찍히는 숫자라 틀리면 그대로 사고다.
 */
function numberLine(product, card) {
  const hasNum = /\d/;
  const fromCard = clean(card && card.body).split(/(?:[.!?])\s|\n/).find((x) => hasNum.test(x));
  const fromFacts = (product.facts || []).find((x) => hasNum.test(String(x)));
  /**
   * ⚠️ **통째로 들어가는 것만 쓴다.** 어절 경계에서 끊어도 「심사 배점 1,000점 중 고객만족도가」
   *    같은 조각이 남는데, 이 줄은 그림에서 **가장 큰 글씨**라 조각이면 바로 눈에 띈다.
   *    맞는 게 없으면 이 줄을 통째로 비운다 — 없는 편이 잘린 것보다 낫다.
   */
  const fits = [fromFacts, fromCard].map(clean).filter((x) => x && x.length <= NUMBER_MAX);
  return fits[0] || '';
}
const NUMBER_MAX = 32;

/**
 * 체크 리스트 — 승인된 기본 특전에서 **칸에 통째로 들어가는 것만** 앞 세 개.
 * 셋이 안 되면 그만큼만 넣는다. 「수상 인증 엠블럼 5종과」처럼 조사에서 끊긴 항목을 만들지 않는다.
 */
const BULLET_MAX = 16;
const bulletsOf = (product) => (product.benefits || [])
  .map(clean).filter((x) => x && x.length <= BULLET_MAX).slice(0, 3);

/**
 * 하단 바 문구 — 승인된 CTA 목록에서 돌려 쓴다.
 *
 * ⚠️ **자르지 않는다.** 승인된 CTA 는 23~32자인데(8-25) 하단 바에 들어가는 길이는 그보다 짧다.
 *    어절 경계에서 끊어도 「…프로필 링크에서」처럼 **동사가 날아간 조각**이 남는다.
 *    그래서 **통째로 들어가는 것만 쓰고**, 안 들어가면 행동 안내 한 줄로 넘긴다.
 *    이 한 줄은 사실 주장이 아니라 다음 행동 안내라 승인 목록과 무관하다(사실성 원칙 4번은
 *    마무리 **문장**에 걸리는 규칙이고, 그건 여기가 아니라 카드 본문 자리다).
 */
const CTA_MAX = 26;
const CTA_FALLBACK = '지금 문의하고 시작하세요';

function ctaOf(product, i) {
  const list = (product.voice && product.voice.ctas ? product.voice.ctas : [])
    .map(clean).filter(Boolean);
  const fits = list.filter((x) => x.length <= CTA_MAX);
  if (!fits.length) return CTA_FALLBACK;
  return fits[i % fits.length];
}

/**
 * 말풍선 후킹 — 레퍼런스의 「직장인도 OK!」·「초기 비용 걱정 끝!」 자리다.
 *
 * ⚠️ 말풍선은 짧다. 여기서도 **통째로 들어가는 것만** 쓴다 — 「중소기업도 참여할 수 있는」처럼
 *    수식어에서 끊긴 조각이 말풍선에 들어가면 무슨 말인지 알 수 없다.
 *    맞는 소구점이 없으면 **브랜드 짧은 이름**을 넣는다(레퍼런스의 노란 말풍선도 짧은 사실 한 조각이다).
 */
const HOOK_MAX = 14;
function hookOf(product, card, i) {
  const pool = [...(product.appeals || []), card && card.title]
    .map(clean).filter((x) => x && x.length <= HOOK_MAX);
  return pool.length ? pool[i % pool.length] : clean(product.short);
}

/* ---------------- 프롬프트 ---------------- */

/**
 * @param {{product:object, topic:string, deck:Array, count:number}} ctx
 * @returns {Array<{n:number, layout:object, palette:object, copy:object, prompt:string}>}
 */
export function buildAdPrompts({ product, topic, deck = [], count = DEFAULT_AD_COUNT }) {
  const max = AD_COUNTS[AD_COUNTS.length - 1];
  const total = Math.max(1, Math.min(max, Number(count) || DEFAULT_AD_COUNT));
  return Array.from({ length: total }, (_, i) => {
    const card = deck.length ? deck[i % deck.length] : null;
    const layout = AD_LAYOUTS[i % AD_LAYOUTS.length];
    const palette = AD_PALETTES[i % AD_PALETTES.length];

    const [line1, line2] = twoLines((card && card.title) || topic);
    const copy = {
      hook: hookOf(product, card, i),
      line1,
      line2,
      sub: firstSentence((card && card.body) || topic, 30),
      number: numberLine(product, card),
      bullets: bulletsOf(product),
      cta: ctaOf(product, i),
      hashtags: (product.hashtags || []).slice(0, 4).map((x) => clean(x)),
    };
    return { n: i + 1, layout, palette, copy, prompt: promptOf({ product, layout, palette, copy }) };
  });
}

/**
 * 프롬프트 한 벌.
 *
 * 지시는 영문, **찍을 글자는 한글 그대로** 따옴표에 넣는다. 번역하라고 두면 모델이 뜻만 살려
 * 제 마음대로 다시 쓴다 — 승인되지 않은 말이 광고에 찍힌다.
 */
function promptOf({ product, layout, palette, copy }) {
  const lines = [
    copy.hook && `speech bubble hook: "${copy.hook}"`,
    copy.line1 && `headline line 1: "${copy.line1}"`,
    copy.line2 && `headline line 2: "${copy.line2}"`,
    copy.sub && `supporting line: "${copy.sub}"`,
    copy.number && `big number line: "${copy.number}"`,
    copy.bullets.length ? `check list items: ${copy.bullets.map((b) => `"${b}"`).join(' / ')}` : '',
    copy.cta && `bottom CTA bar: "${copy.cta}"`,
    layout.id === 'iconrow' && copy.hashtags.length
      ? `hashtag pills: ${copy.hashtags.map((h) => `"${h}"`).join(' / ')}`
      : '',
  ].filter(Boolean).map((line) => `  - ${line}`).join('\n');

  return [
    layout.scene,
    `color palette: ${palette.spec}`,
    'typography: extra-bold rounded Korean gothic (heavy weight), thick white outline and a soft drop shadow on the largest lines, one key word per line filled with the accent color, numbers set far larger than the surrounding words',
    'flat vector graphic style composited with a clean photographic cut-out, crisp edges, no gradients except one soft radiating burst behind the subject, generous margins, everything inside a safe area away from the edges',
    'all people are Korean with East Asian faces, styled for a South Korean audience',
    '',
    'RENDER THIS KOREAN TEXT EXACTLY AS WRITTEN, character for character, and no other words anywhere in the image:',
    lines,
    '',
    `brand handle in small type at a corner: "${clean(product.handle || product.short)}"`,
    'negative: no English sentences, no invented text, no garbled or misspelled Hangul, no watermark, no stock-photo logo, no extra taglines beyond the list above',
  ].join('\n');
}
