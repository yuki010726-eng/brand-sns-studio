/**
 * 인스타그램 프로필 세팅 (1단계)
 *
 * 요청자가 준 레퍼런스 5개를 읽고 구조를 그대로 옮겼다.
 *
 *   브랜드 어워즈형 — @kbsnawards_official / @kbsnbrand_production / @kcstawards_official
 *     이름:  「브랜드명」 또는 「브랜드명 | 부제」
 *     소개:  『선언형 슬로건』 → 。(여백용 한 글자) → 🏆/▫️ 정보 → 📩 문의 → 🔗 링크
 *
 *   마케터형 — @thecontents_lab / @soosangmarket
 *     이름:  「이름 | 분야•분야」
 *     소개:  정체성 한 줄(숫자·개인 서사) → 무엇을 공유하는지 → 📨 연락처 → 🔗 링크
 *
 *   링크는 5곳 모두 litt.ly 다. **소개 맨 마지막 줄**에 넣는다 (요청자 지정).
 *
 * ⚠️ 어워즈형은 `data/products.js` 의 승인된 상품 4종에서 이름과 사실을 가져온다.
 *    예전에는 행사명을 무작위로 지어냈는데, 그러면 사실성 원칙에 걸린다.
 *    지금은 브랜드를 고르면 그 상품의 실제 이름·특전·접수 방식이 들어간다.
 */
import { PRODUCTS } from '../data/products.js';

/** 인스타 프로필 실제 제한 — 넘으면 잘린다 */
export const LIMITS = { name: 30, bio: 150 };

/** 레퍼런스가 여백 대신 쓰는 한 글자. 빈 줄은 인스타가 먹어버려서 이 글자를 넣는다. */
const SPACER = '。';

/** litt.ly 계정을 아직 안 만든 사람을 위한 가입 주소. 추적 파라미터는 떼고 짧게 둔다. */
export const LITTLY_SIGNUP = 'https://app.litt.ly/register';

const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

/**
 * 여러 재료를 자릿수처럼 돌린다 (mixed-radix). 자동차 주행거리계와 같은 방식이다.
 *
 * 모든 재료를 같은 seed 로 뽑으면 조합이 맞물려 돌아서 실제로는 몇 가지만 나온다.
 * 보폭을 서로 다르게 줘도 소용없다 — 재료 개수가 같으면 주기가 같이 돈다.
 */
function combo(seed, pools) {
  let n = Math.max(0, Math.floor(seed));
  return pools.map((arr) => {
    const item = arr[n % arr.length];
    n = Math.floor(n / arr.length);
    return item;
  });
}

/* ============================================================
   브랜드 어워즈형 — 승인된 상품 4종에 붙는다
   ============================================================ */

/**
 * 상품별 litt.ly 주소.
 * KBS N·KCST·AI 프로덕션은 요청자가 준 레퍼런스 계정에서 **실제로 쓰고 있는 주소**다.
 * 포브스만 확인된 주소가 없어 같은 규칙으로 지었다 — 실제 주소가 있으면 여기만 고치면 된다.
 */
const AWARD_SLUG = {
  kbsn: 'kbsn_awards',    // 레퍼런스 @kbsnawards_official 실제 주소
  kcst: '_kcst',          // 레퍼런스 @kcstawards_official 실제 주소
  aitvcf: 'kbsn_ai',      // 레퍼런스 @kbsnbrand_production 실제 주소
  forbes: 'forbes_awards', // ⚠️ 확인 안 된 추정값
};

const AWARDS = {
  subtitle: ['공식 어워즈', '브랜드 인증', '시상·브랜드 홍보', 'AI 프로덕션'],

  /**
   * 『』 안에 들어가는 선언형 한 줄. 성과를 약속하지 않는 표현만 둔다.
   *
   * ⚠️ slogan 7개 · contact 5개 · fact 4개는 **서로소로 맞춘 것**이다.
   *    6개·4개였을 때는 주기가 12로 짧아져 200번 뽑아도 소개가 12종뿐이었다.
   *    개수를 바꿀 때 서로 나누어떨어지지 않는지 확인할 것.
   */
  slogan: [
    '브랜드의 가치를 증명하는 공식 어워즈',
    '이름이 아니라 근거로 남는 브랜드',
    '심사로 확인하고, 기록으로 남깁니다',
    '브랜드를 설명하지 않고 보여줍니다',
    '고객이 먼저 알아보는 브랜드',
    '증명된 브랜드가 오래 남습니다',
    '말보다 기록이 앞서는 브랜드',
  ],

  contact: [
    '📩 심사·수상 특전 및 참가 안내',
    '📩 시상 안내 및 참가 신청',
    '📩 참여 조건 문의는 DM',
    '📩 접수 방법 안내드립니다',
    '📩 우리 업종이 되는지 물어보세요',
  ],
};

/** 상품 자료에서 소개에 쓸 한 줄을 뽑는다 — 지어내지 않는다 */
function awardFacts(product) {
  const out = [];
  if (product.intake) out.push(`▫️ ${product.intake}`);
  if (product.benefits?.length) out.push(`▫️ ${product.benefits.slice(0, 3).join('·')} 제공`);
  const open = (product.events || []).filter((e) => e.status === 'open')[0];
  if (open) out.push(`▫️ ${open.date} ${open.name}`);
  if (product.tagline) out.push(`▫️ ${product.tagline}`);
  return out.length ? out : ['▫️ 참여 조건은 프로필 링크에서'];
}

/* ============================================================
   마케터형
   ============================================================ */
const MARKETER = {
  persona: [
    '콘텐츠연구소', '브랜드기록소', '마케팅노트', '기록하는 마케터',
    '작은브랜드연구소', '브랜드살롱', '카피랩', '온기마케팅',
  ],
  field: ['마케팅', '브랜딩', '콘텐츠', '인사이트', 'SNS 운영', '퍼포먼스', '카피라이팅'],

  /**
   * 정체성 한 줄 — 레퍼런스는 숫자나 개인 서사로 연다 ("33살", "3년 차").
   * 요청자 지적: 연차 숫자만 바뀌고 문장이 늘 같았다. 그래서 **서사 자체가 다른** 문장을 늘렸다.
   * {n}=연차, {a}=나이 — 없는 문장도 있어야 한다.
   */
  identity: [
    '{n}년 차, 브랜드 옆에서 기록하는 사람',
    '{a}살, 남들보다 늦게 시작한 마케터',
    '작은 브랜드의 마케팅을 대신 고민합니다',
    '컨설팅을 품은 콘텐츠 마케팅 파트너',
    '대행사 {n}년, 이제는 제 이름으로 씁니다',
    '광고비보다 문장을 먼저 고칩니다',
    '팔리는 글이 뭔지 {n}년째 실험 중',
    '브랜드가 왜 안 팔리는지만 봅니다',
    '{a}살에 이직, {n}년 차 마케터가 됐습니다',
    '혼자 하는 사장님의 마케팅 파트너',
  ],

  share: [
    '💙 브랜드 마케팅 트렌드와 인사이트를 공유해요',
    '💪 실무에서 통한 것만 골라 적습니다',
    '📝 브랜드가 쌓은 기록을 정리해 둡니다',
    '📊 숫자로 확인한 것만 올립니다',
    '🧩 잘 되는 계정을 뜯어봅니다',
    '✍️ 하루 한 장, 카피 연습 기록',
    '🔍 광고 하나를 끝까지 분석합니다',
  ],

  contact: [
    '📨 협업·문의는 DM으로',
    '⬇ 도움받기 · 자료 받아가기',
    '📨 Contact. DM 또는 프로필 링크',
    '💬 궁금한 건 댓글이나 DM',
    '🤝 강의·컨설팅 문의 환영',
  ],

  slug: [
    'contents_lab', 'brand_note', 'marketing_log', 'brand_archive',
    'the_marketer', 'copy_lab', 'brand_salon', 'daily_market',
  ],
};

/** 유형 정의 — 화면의 선택지와 1:1 */
export const PROFILE_TYPES = [
  {
    id: 'awards',
    label: '브랜드 어워즈형',
    desc: '시상식·인증 계정. 선언형 슬로건과 참가 안내 중심',
    refs: '@kbsnawards_official · @kbsnbrand_production · @kcstawards_official',
  },
  {
    id: 'marketer',
    label: '마케터형',
    desc: '사람이 보이는 계정. 정체성과 인사이트 공유 중심',
    refs: '@thecontents_lab · @soosangmarket',
  },
];

/** 어워즈형에서 고르는 브랜드 — 승인된 상품 4종 그대로 */
export const AWARD_BRANDS = PRODUCTS.map((p) => ({
  id: p.id,
  label: p.name,
  short: p.short,
  slug: AWARD_SLUG[p.id] || p.id,
}));

/* ============================================================
   litt.ly 링크
   ============================================================ */

export function littlySlug(name, typeId) {
  const ascii = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return ascii || (typeId === 'awards' ? 'brand_awards' : 'marketer');
}

export const littlyUrl = (slug) => `https://litt.ly/${slug}`;

/** 소개 맨 마지막에 들어가는 줄. 이 형태를 바꾸면 replaceLinkLine() 도 같이 봐야 한다. */
export const linkLine = (slug) => `🔗 litt.ly/${slug}`;

/** 소개 안의 링크 줄만 갈아 끼운다 — 사용자가 주소를 고쳐도 편집한 소개를 지키기 위함 */
export function replaceLinkLine(bio, slug) {
  const lines = String(bio).split('\n');
  const i = lines.findIndex((l) => l.trim().startsWith('🔗'));
  if (i === -1) return `${bio}\n${linkLine(slug)}`;
  lines[i] = linkLine(slug);
  return lines.join('\n');
}

/* ============================================================
   프로필 이미지 프롬프트 (영문)
   ============================================================ */

/**
 * 이미지 모델은 영문 지시를 훨씬 정확히 따른다. 4단계 이미지 프롬프트와 같은 원칙이다.
 * 글자는 넣지 않는다 — 생성 이미지의 한글은 깨지고, 문구는 나중에 얹어야 고칠 수 있다.
 *
 * ⚠️ 어워즈형은 요청자 지시대로 **심볼을 고정하고 테두리·마감만 바꾼다.**
 *    같은 시상 계열로 읽히면서 계정끼리는 구분되게 하려는 것이다.
 *    그래서 심볼 / 테두리 / 색 / 마감을 따로 두고 조합한다 (7 × 8 × 6 × 5 = 1,680가지).
 */
const AWARD_IMAGE = {
  symbol: [
    'a laurel wreath award emblem',
    'a trophy cup emblem',
    'a star medal emblem',
    'a shield crest with a laurel',
    'a certificate seal with a ribbon',
    'a circular award medallion',
    'a laurel wreath framing a five-point star',
  ],
  frame: [
    'inside a thin double ring border',
    'inside a beaded circular border',
    'inside a hexagonal outline frame',
    'inside a rope-twist circular frame',
    'inside a squared corner-bracket frame',
    'inside a laurel-flanked oval frame',
    'with a thin outer ring and inner hairline',
    'with no frame, clean negative space around',
  ],
  palette: [
    'polished gold on deep navy',
    'brushed silver on charcoal',
    'antique bronze on cream',
    'matte gold on black',
    'rose gold on ivory',
    'platinum on midnight blue',
  ],
  finish: [
    'soft studio lighting, subtle metallic reflections',
    'flat vector style, crisp edges, no gradient',
    'embossed relief with soft shadow',
    'engraved line-art style, fine strokes',
    'glossy enamel finish with a highlight',
  ],
};

/**
 * 마케터형은 사람이 보이는 계정이다. 상패가 아니라 **일하는 사람의 자리**를 그린다.
 * 요청자 지적: 기존 프롬프트가 마케터처럼 안 보였다.
 */
const MARKETER_IMAGE = {
  subject: [
    'a friendly korean marketer smiling at a laptop',
    'hands writing sticky notes on a glass wall',
    'a person presenting a chart to a small team',
    'a marketer holding a coffee cup at a bright desk',
    'a person typing on a laptop with a notebook beside',
    'an open notebook with a pen and a phone showing a graph',
    'a desk flat lay with a laptop, notebook and coffee',
    'a person reviewing printed campaign layouts',
  ],
  setting: [
    'in a bright modern office by a window',
    'in a cozy cafe corner',
    'at a minimal white desk',
    'in a small studio with plants',
    'against a clean pastel backdrop',
    'in a warm home office',
  ],
  mood: [
    'warm natural daylight, friendly and approachable',
    'soft neutral tones, calm and professional',
    'bright airy lighting, energetic',
    'soft pastel palette, gentle and personal',
    'clean editorial lighting, confident',
  ],
  style: [
    'candid lifestyle photography, shallow depth of field',
    'clean flat illustration, simple shapes',
    'soft 3d render, rounded friendly forms',
    'editorial portrait photography, natural skin tones',
  ],
};

/** 정사각형 아바타라 가운데가 살아야 한다 — 프롬프트 끝에 규격을 못박는다 */
const IMAGE_SUFFIX = 'square 1:1 profile avatar, subject centered with margin, no text, no letters, no watermark';

function awardPrompt(seed) {
  const [symbol, frame, palette, finish] =
    combo(seed, [AWARD_IMAGE.symbol, AWARD_IMAGE.frame, AWARD_IMAGE.palette, AWARD_IMAGE.finish]);
  return `${symbol} ${frame}, ${palette}, ${finish}, centered symmetrical composition, ${IMAGE_SUFFIX}`;
}

function marketerPrompt(seed) {
  const [subject, setting, mood, style] =
    combo(seed, [MARKETER_IMAGE.subject, MARKETER_IMAGE.setting, MARKETER_IMAGE.mood, MARKETER_IMAGE.style]);
  return `${subject} ${setting}, ${mood}, ${style}, ${IMAGE_SUFFIX}`;
}

/* ============================================================
   생성
   ============================================================ */

/**
 * 유형에 맞는 프로필 초안을 만든다.
 *
 * @param {{typeId:'awards'|'marketer', brandId?:string, seed?:number}} opts
 * @returns {{typeId:string, brandId:string|null, name:string, bio:string,
 *            slug:string, link:string, imagePrompt:string}}
 */
export function buildProfile({ typeId, brandId, seed = 0 }) {
  const s = Math.max(0, Math.floor(seed));
  const type = PROFILE_TYPES.find((t) => t.id === typeId) ? typeId : 'awards';

  if (type === 'awards') {
    const brand = AWARD_BRANDS.find((b) => b.id === brandId) || AWARD_BRANDS[0];
    const { name, bio } = awardsDraft(s, brand);
    return {
      typeId: type, brandId: brand.id,
      name: clampName(name), bio, slug: brand.slug,
      link: littlyUrl(brand.slug), imagePrompt: awardPrompt(s),
    };
  }

  const slug = pick(MARKETER.slug, s);
  const { name, bio } = marketerDraft(s, slug);
  return {
    typeId: type, brandId: null,
    name: clampName(name), bio, slug,
    link: littlyUrl(slug), imagePrompt: marketerPrompt(s),
  };
}

/**
 * ⚠️ 이름과 소개에 **각각 독립된 조합**을 돌린다. 하나의 odometer 로 묶으면 안 된다.
 *
 * 묶었더니 문장 재료가 느린 자릿수로 밀려서, 「다시 뽑기」를 눌러도 소개는 그대로고
 * 연차 숫자만 바뀌었다. 요청자 지적 그대로다.
 * 지금은 소개 쪽 첫 자리에 문장을 둬서 **한 번 누를 때마다 문장이 바뀐다.**
 */
function awardsDraft(s, brand) {
  const product = PRODUCTS.find((p) => p.id === brand.id);
  const facts = awardFacts(product);
  // 재료 개수가 서로 달라서(6·4·4) 같은 seed 를 써도 세 줄이 각자 다른 주기로 돈다
  const slogan = pick(AWARDS.slogan, s);
  const contact = pick(AWARDS.contact, s);
  const subtitle = pick(AWARDS.subtitle, s);

  const name = s % 2 === 0 ? brand.label : `${brand.short} | ${subtitle}`;

  const bio = fitBio([
    { text: `『${slogan}』`, keep: true },
    { text: SPACER },
    { text: `🏆 ${brand.label}`, keep: true },
    { text: pick(facts, s) },
    { text: SPACER },
    { text: contact, keep: true },
    { text: linkLine(brand.slug), keep: true },
  ]);

  return { name, bio };
}

function marketerDraft(s, slug) {
  /**
   * 소개 세 줄을 각자 다른 주기로 돌린다.
   * 재료 개수를 서로소로 맞춰 뒀다 — identity 10개 · share 7개 · contact 5개.
   * 그래서 「다시 뽑기」를 한 번 누를 때마다 **세 줄이 전부** 바뀐다.
   * (odometer 로 묶으면 뒷줄이 수십 번에 한 번씩만 바뀐다. 실제로 그랬다.)
   */
  const identity = pick(MARKETER.identity, s);
  const share = pick(MARKETER.share, s);
  const contact = pick(MARKETER.contact, s);

  // 이름 — 소개와 따로 돈다 (persona 8개 · field 7개)
  const persona = pick(MARKETER.persona, s);
  const first = pick(MARKETER.field, s);
  // 같은 분야가 두 번 나오지 않게 두 번째는 첫 번째를 뺀 목록에서 고른다
  const rest = MARKETER.field.filter((f) => f !== first);
  const name = `${persona} | ${first}•${pick(rest, s)}`;

  const bio = fitBio([
    { text: identity.replace('{n}', String(3 + (s % 7))).replace('{a}', String(28 + (s % 12))), keep: true },
    { text: share, keep: true },
    { text: contact },
    { text: linkLine(slug), keep: true },
  ]);

  return { name, bio };
}

/* ============================================================
   길이 맞추기
   ============================================================ */

/**
 * 소개를 150자에 맞춘다.
 *
 * ⚠️ 뒤에서부터 자르면 **링크 줄이 먼저 날아간다.** 링크는 요청자가 맨 마지막에 두라고 한 줄이라
 *    사라지면 안 된다. 그래서 keep 이 아닌 줄(여백·부가 사실)부터 덜어낸다.
 *
 * @param {Array<{text:string, keep?:boolean}>} lines
 */
function fitBio(lines) {
  const kept = [...lines];
  const len = () => kept.map((l) => l.text).join('\n').length;

  // 버려도 되는 줄을 뒤에서부터 하나씩 뺀다
  while (len() > LIMITS.bio) {
    const i = kept.map((l, k) => (l.keep ? -1 : k)).filter((k) => k >= 0).pop();
    if (i === undefined) break;
    kept.splice(i, 1);
  }

  const out = kept.map((l) => l.text).join('\n');
  return out.length <= LIMITS.bio ? out : out.slice(0, LIMITS.bio);
}

const clampName = (name) => (name.length <= LIMITS.name ? name : name.slice(0, LIMITS.name));
