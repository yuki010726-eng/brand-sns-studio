/**
 * 인스타그램 프로필 탭 설정
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

/**
 * 재료 하나를 seed 로 고른다. seed 가 1 늘면 **어떤 목록이든 인덱스가 바뀐다** —
 * 그래서 여러 재료를 각자 pick 하면 「다시 뽑기」 한 번에 모든 축이 함께 바뀐다.
 *
 * ⚠️ 예전에는 mixed-radix `combo()` 도 함께 썼다(자릿수처럼 도는 방식).
 *    조합을 빠짐없이 훑는 장점이 있지만 **뒷자리가 수십 번에 한 번씩만 바뀐다.**
 *    소개 문장에서 "연차 숫자만 바뀌고 똑같다"는 지적을 받았고(8-5),
 *    이미지 프롬프트에서도 색·마감이 그대로여서 같은 그림으로 보였다(2026-08-11).
 *    지금은 이름·소개·이미지 프롬프트가 **전부 pick 기반**이다. combo 는 되살리지 말 것.
 *    대신 재료 개수를 서로소에 가깝게 잡아 주기(최소공배수)를 길게 유지한다.
 */
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

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

/**
 * 브랜드 로고 파일 자리.
 *
 * ⚠️ **파일은 저장소에 아직 없다.** 요청자가 브랜드별 로고를 모아 넣을 예정이라(2026-08-11)
 *    자리와 이름 규칙만 먼저 정해 뒀다. `assets/logos/{상품id}.png` 로 넣으면 화면에 바로 뜬다.
 *    규칙은 `assets/logos/README.md` 에 적어 뒀다.
 *
 * 없어도 화면은 깨지지 않는다 — `<img>` 의 onerror 가 안내문으로 바꾼다.
 * 확장자를 png 하나로 고정한 이유는 화면에서 여러 후보를 순서대로 시도하면
 * 없는 파일마다 404 가 콘솔에 쌓이기 때문이다.
 */
export const awardLogoSrc = (brandId) => `assets/logos/${brandId}.png`;

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
 *
 * ⚠️ **어워즈형에는 모드가 두 개다** (2026-08-11, 요청자 지적으로 갈랐다).
 *
 * | | 심볼을 정하는 주체 | 쓰는 재료 |
 * |---|---|---|
 * | 로고 없음 | 프롬프트가 지어낸다 | `AWARD_EMBLEM` |
 * | 로고 있음 | **첨부한 로고가 곧 심볼이다** | `AWARD_LOGO_LOOK` |
 *
 * ⚠️ 예전에는 모드 구분 없이 프롬프트가 늘 `a laurel wreath award emblem …` 으로 **시작**했다.
 *    로고를 첨부해도 모델은 글로 적힌 심볼을 우선해서 월계수만 그렸다 — 요청자가 지적한 그 증상이다.
 *    **로고 모드에서 심볼 이름을 다시 넣지 말 것.** 넣는 순간 첨부한 로고가 무시된다.
 *
 * ⚠️ 로고 모드에서는 `no text, no letters` 도 쓰면 안 된다. 로고 안의 글자까지 지워
 *    브랜드를 알아볼 수 없게 만든다. 대신 "로고에 이미 있는 것 말고는 넣지 말라"고 한다.
 */

/** 로고 없이 심볼부터 지어낼 때 — 심볼 9 · 테두리 8 · 색 6 · 마감 5 (주기 360) */
const AWARD_EMBLEM = {
  /**
   * ⚠️ 예전 목록은 7개 중 3개가 월계수 계열이었고 테두리에도 laurel 이 또 있었다.
   *    무엇을 뽑아도 월계수로 읽혔다. 계열을 흩어 놓고 월계수는 하나만 남긴다.
   */
  mark: [
    'a bold monogram initial set inside a crest',
    'a crown resting above a simple shield',
    'a faceted diamond-cut medal',
    'a laurel wreath award emblem',
    'a ribboned certificate seal',
    'a stepped pedestal with a star above it',
    'an interlocking geometric badge mark',
    'a trophy silhouette reduced to simple shapes',
    'a radiating sunburst rosette',
  ],
  frame: [
    'inside a thin double ring border',
    'inside a beaded circular border',
    'inside a hexagonal outline frame',
    'inside a rope-twist circular frame',
    'inside a squared corner-bracket frame',
    'inside a scalloped seal edge',
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
    'glossy enamel finish with a single highlight',
  ],
};

/**
 * 로고를 첨부할 때 — **로고 주변만** 말한다. 연출 7 · 배경 6 · 조명 5 · 악센트 4 (주기 420).
 *
 * 요청자 요구: "너무 확실한 프롬프트 말고, 로고를 넣으면 자유롭게 제작 가능한" 것.
 * 그래서 배치를 도면처럼 못박지 않고 **방향만** 준다 — 모델이 나머지를 채우게 둔다.
 */
const AWARD_LOGO_LOOK = {
  treatment: [
    'set the logo on a solid brand-colored field with generous breathing room',
    'give the logo a raised metallic finish, as if struck on an award plaque',
    'let a soft circular glow sit behind the logo',
    // ⚠️ 여기에 wreath·laurel 을 쓰지 말 것. 로고 모드인데도 모델이 그 단어를 붙잡고
    //    월계수를 그린다 — 로고를 첨부한 이유가 사라진다. 중립적인 링으로만 말한다.
    'frame the logo loosely with a slim award ring, kept clearly secondary to the mark',
    'place the logo over a deep gradient that falls off toward the edges',
    'treat the logo as engraved into a matte surface',
    'float the logo above a subtly textured backdrop with a soft drop shadow',
  ],
  backdrop: [
    'deep navy backdrop',
    'near-black charcoal backdrop',
    'warm ivory backdrop',
    'rich burgundy backdrop',
    'cool graphite backdrop',
    'midnight blue backdrop with a faint vignette',
  ],
  light: [
    'soft studio lighting with gentle metallic reflections',
    'flat even lighting, crisp and graphic',
    'directional light from the upper left with a subtle shadow',
    'diffused glow, premium and calm',
    'high-contrast spotlight, dramatic',
  ],
  accent: [
    'gold accents',
    'silver accents',
    'a single thin luxury border accent',
    'no extra accents, keep it minimal',
  ],
};

/**
 * 마케터형 — **기하학적 마크**로 간다. 마크 8 · 색 7 · 재질 5 · 배경 4 (주기 280).
 *
 * ⚠️ 예전에는 "노트북 앞에서 웃는 마케터" 같은 **인물·책상 사진**이었다.
 *    요청자 지적: 1차원적이고 AI 티가 난다. 실제로 상위 마케터 계정의 아바타는
 *    사람 사진이 아니라 **작게 줄여도 읽히는 추상 도형 마크**다. 그쪽으로 옮겼다.
 *
 * ⚠️ 그래서 여기에 인물·책상·노트북을 다시 넣지 말 것. 아바타는 40px 로도 뜨는데
 *    사진은 그 크기에서 뭉개져서 계정을 구분하지 못한다.
 */
const MARKETER_IMAGE = {
  mark: [
    'a bold abstract monogram built from two overlapping geometric shapes',
    'a minimal arrow-like mark suggesting upward movement',
    'a rounded square holding one thick angular glyph',
    'a stack of offset rectangles forming an implied letter',
    'a circular mark split by a single diagonal cut',
    'a bauhaus composition of circle, triangle and bar',
    'a chunky isometric block form with one clean fold',
    'a continuous ribbon looping into itself',
  ],
  palette: [
    'sunset gradient running from amber through coral into deep blue',
    'electric violet to cyan gradient',
    'monochrome black and white with one saturated accent',
    'warm terracotta and cream duotone',
    'deep green to lime gradient',
    'cobalt blue with a soft pink highlight',
    'burnt orange into deep plum gradient',
  ],
  construction: [
    'flat vector, crisp edges, no texture',
    'soft 3d render with rounded bevels and a gentle shadow',
    'thick outlined line-art at a single stroke weight',
    'grainy risograph print texture',
    'glossy glass-like material with subtle refraction',
  ],
  backdrop: [
    'on a solid black field',
    'on an off-white field',
    'on a deep charcoal field',
    'on a soft gradient field tuned to the mark',
  ],
};

/**
 * 정사각형 아바타라 가운데가 살아야 하고, 목록에서 40px 로도 뜬다.
 * 글자 금지는 모드마다 다르다 — 로고 모드는 로고 안의 글자를 지키려고 문구를 바꿔 붙인다.
 */
const AVATAR_RULE = 'square 1:1 profile avatar, centered with clear margin, still readable at small size, no watermark';
const NO_TEXT = 'no text, no letters';
/** 로고 모드 전용 — 로고가 가진 글자는 살리고 **덧붙이는 것만** 막는다 */
const NO_EXTRA_TEXT = 'add no words, letters or symbols beyond what the logo already contains';

/**
 * ⚠️ 이미지 프롬프트 재료는 `combo()` 로 묶지 않고 **각자 `pick()` 으로** 돌린다.
 *
 * combo() 는 자릿수처럼 도는 방식이라 앞자리만 매번 바뀌고 뒷자리는 수십 번에 한 번 바뀐다.
 * 그래서 「다시 뽑기」를 여러 번 눌러도 색·마감이 그대로여서 **같은 그림으로 보인다.**
 * 소개 문장에서 이미 같은 지적을 받았다(8-5의 "연차 숫자만 바뀌고 똑같다").
 * `pick()` 은 재료마다 인덱스가 매번 1씩 도므로 **한 번 누를 때마다 네 축이 전부 바뀐다.**
 *
 * 대신 주기가 재료 개수의 최소공배수로 정해지므로 개수를 서로소에 가깝게 잡는다.
 *   어워즈 심볼 9·8·6·5 → 360 · 로고 연출 7·6·5·4 → 420 · 마케터 8·7·5·4 → 280
 * 개수를 바꿀 때는 이 주기가 짧아지지 않는지 확인할 것.
 *
 * @param {number} seed
 * @param {boolean} withLogo 로고를 첨부해서 쓸 프롬프트인지
 */
function awardPrompt(seed, withLogo) {
  if (!withLogo) {
    const mark = pick(AWARD_EMBLEM.mark, seed);
    const frame = pick(AWARD_EMBLEM.frame, seed);
    const palette = pick(AWARD_EMBLEM.palette, seed);
    const finish = pick(AWARD_EMBLEM.finish, seed);
    return `${mark} ${frame}, ${palette}, ${finish}, centered symmetrical composition, ${AVATAR_RULE}, ${NO_TEXT}`;
  }

  const treatment = pick(AWARD_LOGO_LOOK.treatment, seed);
  const backdrop = pick(AWARD_LOGO_LOOK.backdrop, seed);
  const light = pick(AWARD_LOGO_LOOK.light, seed);
  const accent = pick(AWARD_LOGO_LOOK.accent, seed);

  /**
   * ⚠️ 첫 문장이 곧 우선순위다. 로고를 먼저 못박아야 뒤의 묘사가 로고를 밀어내지 않는다.
   *    마지막 문장에서 자유도를 열어 준다 — 요청자 요구가 "자유롭게 제작 가능한" 것이다.
   */
  return [
    'Use the attached logo as the one and only mark of this profile image.',
    'Keep its shapes, proportions, colors and lettering exactly as provided — do not redraw, restyle or translate it.',
    `Then build the award-style profile around it: ${treatment}, ${backdrop}, ${light}, ${accent}.`,
    'Compose freely — scale, position and surrounding detail are yours to decide, as long as the logo stays whole, unclipped and the clear focal point.',
    `${AVATAR_RULE}, ${NO_EXTRA_TEXT}.`,
  ].join(' ');
}

function marketerPrompt(seed) {
  const mark = pick(MARKETER_IMAGE.mark, seed);
  const palette = pick(MARKETER_IMAGE.palette, seed);
  const construction = pick(MARKETER_IMAGE.construction, seed);
  const backdrop = pick(MARKETER_IMAGE.backdrop, seed);
  return `${mark}, ${palette}, ${construction}, ${backdrop}, bold and simple enough to read as a small avatar, ${AVATAR_RULE}, ${NO_TEXT}`;
}

/* ============================================================
   생성
   ============================================================ */

/**
 * 유형에 맞는 프로필 초안을 만든다.
 *
 * @param {{typeId:'awards'|'marketer', brandId?:string, seed?:number, withLogo?:boolean}} opts
 *        withLogo — 어워즈형 전용. 로고를 첨부해 쓸 프롬프트로 만든다. 마케터형은 무시된다.
 * @returns {{typeId:string, brandId:string|null, name:string, bio:string, slug:string,
 *            link:string, imagePrompt:string, withLogo:boolean}}
 */
export function buildProfile({ typeId, brandId, seed = 0, withLogo = false }) {
  const s = Math.max(0, Math.floor(seed));
  const type = PROFILE_TYPES.find((t) => t.id === typeId) ? typeId : 'awards';

  if (type === 'awards') {
    const brand = AWARD_BRANDS.find((b) => b.id === brandId) || AWARD_BRANDS[0];
    const { name, bio } = awardsDraft(s, brand);
    const logo = Boolean(withLogo);
    return {
      typeId: type, brandId: brand.id,
      name: clampName(name), bio, slug: brand.slug,
      link: littlyUrl(brand.slug), imagePrompt: awardPrompt(s, logo), withLogo: logo,
    };
  }

  const slug = pick(MARKETER.slug, s);
  const { name, bio } = marketerDraft(s, slug);
  return {
    typeId: type, brandId: null,
    name: clampName(name), bio, slug,
    link: littlyUrl(slug), imagePrompt: marketerPrompt(s), withLogo: false,
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
