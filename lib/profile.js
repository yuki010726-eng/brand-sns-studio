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
  /**
   * 계정 이름 뒤에 붙는 부제. **영문이다** (요청자 지시 2026-08-13) —
   * 예전에는 'KBS N BRAND AWARDS | 브랜드 인증' 처럼 국문이 섞였다.
   * ⚠️ 슬로건 7 · 문의 5 · 부제 17 은 서로소다.
   */
  subtitle: [
    'Official', 'Certified', 'Awards', 'Brand Awards',
    'Since 2023', 'Official Awards', 'Brand Certification', 'Recognition',
    'Trusted Brands', 'Brand Value', 'Awards Council', 'Official Council',
    'Brand Trust', 'Excellence', 'Certified Brands', 'Awards Office',
    'Brand Honors', 'Korea', 'Council', 'Honors', 'Trust', 'Value',
    'Verified', 'Program', 'Committee',
  ],

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

/**
 * AI TV CF 전용 문구 (2026-08-13).
 *
 * ⚠️ 유형만 갈라 놓고 문구를 어워즈 것으로 두면 소용이 없다. 실제로 분리 직후
 *    AI TV CF 계정에 "브랜드를 설명하지 않고 보여줍니다" 같은 어워즈 슬로건과
 *    🏆 이모지가 그대로 붙었다. 이건 시상식이 아니라 **광고 제작·송출 서비스**다.
 * ⚠️ 개수를 서로소로 둔다(슬로건 7 · 문의 5 · 부제 4) — 안 그러면 주기가 짧아진다.
 */
const AITVCF = {
  subtitle: [
    'AI CF', 'TV Commercial', 'IPTV Ads', 'AI Production',
    'TV Ads', 'AI Film', 'Ad Studio', 'Broadcast Ads',
    'AI Creative', 'TV Campaign', 'Local Ads', 'Ad Support',
    'AI Studio',
  ],
  slogan: [
    'TV 광고, 이제 중소기업도 합니다',
    '제작비 걱정 없이 TV로',
    '만들고 내보내는 것까지 한 번에',
    '우리 동네에만 트는 TV 광고',
    '촬영 없이 만드는 TV 광고',
    'AI로 만들고 IPTV로 내보냅니다',
    '광고는 만든 뒤가 더 중요합니다',
  ],
  contact: [
    '📩 제작 지원 조건 문의',
    '📩 우리 지역 송출 가능한지 물어보세요',
    '📩 업종별 심의 여부 안내드립니다',
    '📩 제작·송출 상담은 DM',
    '📩 제작 일정 안내드립니다',
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
  /**
   * ⚠️ **계정 이름은 전부 영문이다** (요청자 지시 2026-08-13).
   *    예전에는 '콘텐츠연구소 | 마케팅•브랜딩' 처럼 국문이었다.
   * ⚠️ persona 31 · field 29 는 **서로소**다. 곱하면 899가지가 나온다.
   *    개수를 바꿀 때 최대공약수가 1인지 확인할 것 — 아니면 주기가 확 줄어든다.
   */
  persona: [
    'CONTENTS LAB', 'BRAND ARCHIVE', 'MARKETING NOTE', 'THE MARKETER',
    'SMALL BRAND LAB', 'BRAND SALON', 'COPY LAB', 'WARM MARKETING',
    'BRAND DIARY', 'GROWTH DESK', 'STUDIO NOTE', 'THE COPY DESK',
    'BRAND STUDIO', 'MARKET LETTER', 'DAILY BRAND', 'CREATIVE DESK',
    'BRAND WORKS', 'CONTENT DESK', 'THE BRAND LOG', 'MARKETING ROOM',
    'BRAND ROOM', 'PLAN B STUDIO', 'THE GROWTH LAB', 'SIDE NOTE',
    'BRAND KITCHEN', 'COPY ROOM', 'THE SMALL SHOP', 'MARKET DESK',
    'BRAND FIELD', 'SLOW MARKETING', 'THE BRAND DESK',
  ],
  field: [
    'Marketing', 'Branding', 'Contents', 'Insight', 'SNS', 'Performance',
    'Copywriting', 'Strategy', 'Growth', 'Creative', 'Planning', 'Analytics',
    'Campaign', 'Storytelling', 'Media', 'Design', 'Research', 'Consulting',
    'Commerce', 'Retention', 'Funnel', 'Positioning', 'Naming', 'Identity',
    'Community', 'Newsletter', 'Video', 'Ads', 'CRM',
  ],

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

/**
 * 유형 정의 — 화면의 선택지와 1:1
 *
 * ⚠️ **AI TV CF 를 어워즈에서 분리했다** (요청자 지시 2026-08-13).
 *    예전에는 어워즈형 안에서 고르는 브랜드 4개 중 하나였는데, 상품 성격이 다르다 —
 *    어워즈 3종은 인증 자산이고 AI TV CF 는 광고 운영 서비스다.
 *    같은 유형으로 묶으면 슬로건과 소개 문장이 어워즈 톤으로 나온다.
 *
 * ⚠️ **레퍼런스 계정(`refs`) 표시를 뺐다** (요청자 지시). 화면에 남의 계정을 노출할 이유가 없다.
 */
export const PROFILE_TYPES = [
  {
    id: 'awards',
    label: '브랜드 어워즈',
    desc: '시상식·인증 계정. 선언형 슬로건과 참가 안내 중심',
  },
  {
    id: 'aitvcf',
    label: 'AI TV CF',
    desc: '광고 제작·송출 계정. 제작 지원과 매체 안내 중심',
  },
  {
    id: 'marketer',
    label: '마케터 (심볼)',
    desc: '얼굴 없이 기하학 마크로. 작게 줄여도 읽힌다',
  },
  /**
   * ⚠️ 마케터형을 둘로 나눴다 (요청자 지시 2026-08-14).
   *    같은 마케터 계정이라도 아바타를 마크로 갈지 얼굴로 갈지는 완전히 다른 결정이다.
   *    이름·소개는 두 유형이 똑같고 **이미지 프롬프트만 다르다** — `marketerDraft()` 를 함께 쓴다.
   */
  {
    id: 'marketer_photo',
    label: '마케터 (사진)',
    desc: '내 사진을 올리면 증명사진 느낌 상반신으로',
    needsPhoto: true,
  },
];

/** 사진을 첨부해야 프롬프트가 제 일을 하는 유형 — 화면이 업로드 칸을 띄우는 기준이다 */
export const needsPhoto = (typeId) => PROFILE_TYPES.find((t) => t.id === typeId)?.needsPhoto === true;

/**
 * 계정 이름에 쓸 **영문 표기** (요청자 지시 2026-08-13: "계정이름 영어로 나오도록").
 * ⚠️ 인스타 이름 상한이 30자다. 정식 영문명이 길면 줄인 형태를 쓴다
 *    (KCST 정식 영문명 'Korea Customer Satisfaction & Trust Awards' 는 42자라 못 쓴다).
 */
const BRAND_EN = {
  kbsn: 'KBS N BRAND AWARDS',
  forbes: 'FORBES BRAND AWARDS',
  kcst: 'KCST AWARDS',
  aitvcf: 'AI TV CF',
};

/**
 * 짧은 별칭 — **긴 이름은 부제가 들어갈 자리를 다 먹는다.**
 * 'KBS N BRAND AWARDS' 는 18자라 30자 상한에서 부제에 9자밖에 안 남고,
 * 들어가는 부제가 4개뿐이라 이름 가짓수가 4종으로 주저앉았다(요청자: 4배로 늘려달라).
 * 기본형과 짧은형을 번갈아 쓰면 조합이 크게 는다.
 */
const BRAND_EN_SHORT = {
  kbsn: 'KBS N AWARDS',
  forbes: 'FORBES AWARDS',
  kcst: 'KCST',
  aitvcf: 'AI TV CF',
};

/** 어워즈형에서 고르는 브랜드 — **AI TV CF 는 제외한다**(자체 유형이 됐다) */
export const AWARD_BRANDS = PRODUCTS.filter((p) => p.id !== 'aitvcf').map((p) => ({
  id: p.id,
  label: p.name,
  en: BRAND_EN[p.id] || p.short,
  enShort: BRAND_EN_SHORT[p.id] || BRAND_EN[p.id] || p.short,
  short: p.short,
  slug: AWARD_SLUG[p.id] || p.id,
}));

/** AI TV CF 유형 — 고를 것이 없으므로 상품 하나로 고정한다 */
export const AITVCF_BRAND = (() => {
  const p = PRODUCTS.find((x) => x.id === 'aitvcf');
  return p ? { id: p.id, label: p.name, en: BRAND_EN.aitvcf, enShort: BRAND_EN_SHORT.aitvcf, short: p.short, slug: AWARD_SLUG.aitvcf } : null;
})();

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

/**
 * 어워즈 엠블럼 — **글자가 들어간다.** (요청자 지시 2026-08-14)
 *
 * 요청자가 준 레퍼런스 두 장이 기준이다.
 *   ① 금색 월계관 + 검정 바탕 + 굵은 산세리프 3줄 (THE / BEST BRAND / AWARDS)
 *   ② 검정 사각 블록 + 코일 심볼 + 얇은 산세리프 2줄 (THE / WEBBY AWARDS)
 * **모양은 참고하되 글자는 각 브랜드의 것을 쓴다** — 레퍼런스의 문구를 그대로 옮기면
 * 남의 시상식 엠블럼이 된다. 그래서 `letters` 를 브랜드마다 못박아 프롬프트에 넣는다.
 *
 * ⚠️ 그래서 이 유형만 `NO_TEXT` 를 쓰지 않는다. 글자를 넣으라고 시키는 프롬프트다.
 * ⚠️ **이미지 모델은 글자를 자주 틀린다.** 철자를 못박아도 한두 자가 어긋날 수 있으니
 *    화면 안내에 "글자는 반드시 눈으로 확인"을 적어 둔다. 이건 프롬프트로 못 막는다.
 * ⚠️ `KBS N` 은 KBS 와 N 사이를 띄운다(브랜드 표기 규칙). 문자열을 손대지 말 것.
 */
const AWARD_BRAND_LOOK = {
  kbsn: {
    // brand-info ①-8: 메인 딥 네이비 블루 · 포인트 KBS N 시그니처 블루 · 액센트 골드
    palette: [
      'polished gold on deep navy',
      'signature broadcast blue with gold accents on near-black',
      'warm gold lettering on midnight navy with a faint vignette',
      'ivory and gold on deep navy blue',
    ],
  },
  forbes: {
    // brand-info 0-3: 네이비 / 골드 · 전문적·권위
    palette: [
      'antique gold on rich navy',
      'brushed gold on charcoal black',
      'deep navy lettering on ivory with fine gold hairlines',
      'platinum and gold on midnight blue',
    ],
  },
  kcst: {
    // brand-info ③-1: 로고가 방패+왕관+월계관, 골드 온 블랙 / 0-3: 블루·옐로우
    palette: [
      'polished gold on solid black',
      'gold and warm yellow on deep black',
      'royal blue with golden yellow accents on black',
      'champagne gold on graphite',
    ],
  },
};

/** 심볼 7 · 배치 4 · 마감 5 (주기 140) × 브랜드 팔레트 4 = 560 */
const AWARD_EMBLEM = {
  /**
   * ⚠️ 예전 목록은 9개 중 3개가 월계수 계열이었고 테두리에도 laurel 이 또 있었다.
   *    무엇을 뽑아도 월계수로 읽혔다. 계열을 흩어 놓고 월계수는 하나만 남긴다.
   */
  mark: [
    'a symmetrical laurel wreath opening upward, its two branches crossing at the base',
    'a crest shield topped with a slim crown',
    'a circular medal ring with one faceted star at the top',
    'a solid rectangular block paired with a single graphic coil',
    'a ribboned seal with two short tails falling below',
    'a double-ring badge with fine tick marks around the edge',
    'a stepped pedestal supporting a simple trophy silhouette',
  ],
  layout: [
    'the wording stacked in three tight centered lines held inside the mark',
    'the wording set in two centered lines directly beneath the mark',
    'the mark on the left with the wording locked to its right in two lines',
    'the mark drawn large behind the wording, the wording centered on top of it',
  ],
  finish: [
    'flat vector, crisp edges, no gradient',
    'soft studio lighting with a subtle metallic reflection',
    'engraved line-art with fine even strokes',
    'matte print finish with slightly raised lettering',
    'high-contrast graphic style, poster-like',
  ],
};

/**
 * AI TV CF — 어워즈와 **완전히 다른 결이다.** (요청자 지시 2026-08-14)
 *
 * 예전에는 이 유형이 `awardPrompt()` 를 그대로 썼다. 그래서 광고 운영 서비스 계정인데
 * 월계관·훈장이 나왔다 — 요청자 지적("브랜드 어워즈랑 프롬프트가 같은 것 같다") 그대로다.
 * 상품 성격이 인증 자산이 아니라 **방송·기술 서비스**이므로 결을 그쪽으로 옮긴다.
 *
 * 요청자가 준 레퍼런스 세 장이 기준이다.
 *   ③ 흰 4방향 스파클 별 + 딥 네이비 그라디언트 + 빛 번짐
 *   ④ 흰 선형 심볼(점·가로선) + 블루 실크 그라디언트
 *   ⑤ 검정 TV 모노그램 + 타원 궤도 + 흰 배경
 * 요청자 요구: **로고만 보이게 하지 말고 배경도 같이 만들어 달라.** 그래서 배경을 따로 뽑는다.
 *
 * 심볼 7 · 배경 6 · 마감 5 (주기 210). 개수를 바꿀 때 서로소인지 확인할 것.
 */
const AITVCF_IMAGE = {
  mark: [
    'a four-pointed sparkle star with concave sides, drawn as one solid silhouette',
    'a horizontal stack of thin lines and dots reading as a broadcast signal',
    'an outlined play triangle held inside a soft-cornered screen frame',
    'a bold TV monogram wrapped by a single thin elliptical orbit',
    'three concentric arcs rising from one dot, like a transmitting antenna',
    'a rounded rectangle screen crossed by one diagonal light sweep',
    'a lens-shaped mark built from two mirrored arcs meeting at both ends',
  ],
  backdrop: [
    'a deep navy to black gradient with a soft light bloom in one corner',
    'a cobalt blue satin gradient with gentle vertical folds',
    'a midnight blue field with a diffused white glow rising from the lower right',
    'a clean off-white field carrying one soft shadow',
    'a graphite to indigo gradient with a faint horizontal light streak',
    'an electric blue radial glow fading to near-black at the edges',
  ],
  treatment: [
    'a flat solid white mark, no outline and no gradient inside the mark',
    'a crisp white mark with a subtle outer glow',
    'a solid black mark on the light field for maximum contrast',
    'a white mark with a slight glassy sheen',
    'a white mark with a thin stroke and open counters, technical and precise',
  ],
};

/**
 * 마케터 사진형 — 올린 얼굴을 **증명사진 느낌 상반신**으로 다시 찍는다 (요청자 지시 2026-08-14).
 *
 * 요청자가 준 레퍼런스 두 장이 기준이다 — 회색 스튜디오 배경, 정장·블레이저, 팔짱,
 * 가슴 아래에서 잘린 상반신, 부드러운 균일 조명.
 *
 * ⚠️ **얼굴을 고치지 말라고 못박는다.** 안 적으면 모델이 알아서 갸름하게 만들고 나이를 바꾼다.
 *    본인 사진을 올리는 이유가 사라진다.
 * ⚠️ 여기는 8-5 의 "인물·책상을 넣지 말 것" 규칙의 **예외**다. 그 규칙은 얼굴 없이 가는
 *    기본 마케터형(`MARKETER_IMAGE`)을 지키는 것이고, 이 유형은 애초에 얼굴이 주인공이다.
 *
 * 자세 5 · 복장 6 · 스튜디오 7 (주기 210)
 */
const MARKETER_PHOTO = {
  pose: [
    'standing square to camera with arms folded',
    'standing at a slight three-quarter angle with hands relaxed at the sides',
    'standing square to camera, shoulders level and relaxed',
    'standing at a slight angle, one hand lightly holding the other wrist',
    'standing square to camera with arms folded and a light, closed-mouth smile',
  ],
  outfit: [
    'a black tailored blazer over a plain black top',
    'a navy business suit with a white shirt and a striped tie',
    'a charcoal blazer over a white shirt, no tie',
    'a soft beige blazer over a white top',
    'a dark grey suit with an open-collar white shirt',
    'a black suit jacket over a fine-knit black turtleneck',
  ],
  studio: [
    'a smooth neutral grey studio backdrop with soft even lighting',
    'a slightly darker grey gradient backdrop with a gentle shadow behind one shoulder',
    'a warm grey backdrop with a soft vignette and diffused front light',
    'a cool light grey backdrop with bright flat corporate lighting',
    'a mid grey backdrop with a soft key light from the front left',
    'a deep grey backdrop with low-contrast diffused light',
    'an off-white backdrop with clean, shadowless studio light',
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
function awardPrompt(seed, withLogo, brandId = 'kbsn') {
  if (!withLogo) {
    const look = AWARD_BRAND_LOOK[brandId] || AWARD_BRAND_LOOK.kbsn;
    const letters = BRAND_EN[brandId] || BRAND_EN.kbsn;
    const mark = pick(AWARD_EMBLEM.mark, seed);
    const layout = pick(AWARD_EMBLEM.layout, seed);
    const finish = pick(AWARD_EMBLEM.finish, seed);
    const palette = pick(look.palette, seed);

    /**
     * ⚠️ 철자를 두 번 못박는다. 한 번만 적으면 모델이 'AWARDS' 를 'AWARDS' 비슷한 글자로
     *    바꾸거나 없는 단어를 덧붙인다. 그래도 완벽하지는 않아 화면에서 확인하라고 안내한다.
     */
    return [
      `An award emblem badge for "${letters}".`,
      `Build it from ${mark}, with ${layout}.`,
      // ⚠️ 글자 뒤에 마침표를 붙이지 않는다 — 모델이 그 점까지 엠블럼에 새긴다. 줄표로 끊는다.
      `Render the wording letter for letter, exactly — ${letters} — in clean uppercase sans-serif.`,
      'Add no other words, no tagline, no year and no extra letters.',
      `${palette}, ${finish}, centered symmetrical composition.`,
      AVATAR_RULE,
    ].join(' ');
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

/**
 * AI TV CF 전용 — 방송·기술 결. 로고를 첨부하면 그것을 살리고 배경만 새로 만든다.
 * ⚠️ 어워즈 프롬프트를 다시 여기로 끌어오지 말 것. 월계관이 붙는 순간 광고 서비스가
 *    시상식으로 읽힌다(그게 원래 문제였다).
 */
function aitvcfPrompt(seed, withLogo) {
  const backdrop = pick(AITVCF_IMAGE.backdrop, seed);

  if (withLogo) {
    return [
      'Use the attached logo as the one and only mark of this profile image.',
      'Keep its shapes, proportions, colors and lettering exactly as provided — do not redraw, restyle or translate it.',
      `Place it on ${backdrop}, with generous breathing room around it.`,
      'Modern broadcast-technology feel: calm, premium, no award or trophy motifs.',
      'Compose freely — scale and position are yours to decide, as long as the logo stays whole, unclipped and the clear focal point.',
      `${AVATAR_RULE}, ${NO_EXTRA_TEXT}.`,
    ].join(' ');
  }

  const mark = pick(AITVCF_IMAGE.mark, seed);
  const treatment = pick(AITVCF_IMAGE.treatment, seed);
  return [
    `A minimal geometric brand mark: ${mark}.`,
    `Draw it as ${treatment}, sitting on ${backdrop}.`,
    'Modern broadcast-technology feel — clean, confident, premium.',
    'No award, trophy, wreath, medal or ribbon motifs of any kind.',
    `Centered composition with wide margins, ${AVATAR_RULE}, ${NO_TEXT}`,
  ].join(' ');
}

/**
 * 마케터 사진형 — 올린 얼굴을 증명사진 느낌 상반신으로.
 * ⚠️ 첫 문장이 곧 우선순위다. 얼굴 보존을 맨 앞에 둬야 뒤의 연출이 얼굴을 밀어내지 않는다.
 */
function marketerPhotoPrompt(seed) {
  const pose = pick(MARKETER_PHOTO.pose, seed);
  const outfit = pick(MARKETER_PHOTO.outfit, seed);
  const studio = pick(MARKETER_PHOTO.studio, seed);
  return [
    'Use the attached photo as the reference for this person.',
    'Keep their facial features, face shape, hairline and skin tone exactly as in the photo — do not beautify, slim, smooth, age or otherwise change the face.',
    `Re-photograph them as a professional corporate ID portrait: upper body only, cropped just below the chest, ${pose}, wearing ${outfit}, against ${studio}.`,
    'Head and shoulders centered, eyes level with the camera, sharp focus on the face, natural skin texture, no heavy retouching.',
    `${AVATAR_RULE}, ${NO_TEXT}`,
  ].join(' ');
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

  /**
   * AI TV CF 는 고를 브랜드가 하나뿐이라 선택 단계를 건너뛴다.
   * ⚠️ **이미지 프롬프트는 어워즈와 다른 함수를 쓴다** (요청자 지시 2026-08-14).
   *    예전에는 `awardPrompt()` 를 그대로 불러서 광고 서비스 계정에 월계관이 나왔다.
   */
  if (type === 'aitvcf' && AITVCF_BRAND) {
    const { name, bio } = awardsDraft(s, AITVCF_BRAND, true);
    const logo = Boolean(withLogo);
    return {
      typeId: type, brandId: AITVCF_BRAND.id,
      name: clampName(name), bio, slug: AITVCF_BRAND.slug,
      link: littlyUrl(AITVCF_BRAND.slug), imagePrompt: aitvcfPrompt(s, logo), withLogo: logo,
    };
  }

  if (type === 'awards') {
    const brand = AWARD_BRANDS.find((b) => b.id === brandId) || AWARD_BRANDS[0];
    const { name, bio } = awardsDraft(s, brand);
    const logo = Boolean(withLogo);
    return {
      typeId: type, brandId: brand.id,
      name: clampName(name), bio, slug: brand.slug,
      // 브랜드마다 색과 **엠블럼에 새길 글자**가 다르다 — brandId 를 반드시 넘긴다
      link: littlyUrl(brand.slug), imagePrompt: awardPrompt(s, logo, brand.id), withLogo: logo,
    };
  }

  // 마케터 두 유형은 이름·소개가 같고 이미지 프롬프트만 갈린다
  const slug = pick(MARKETER.slug, s);
  const { name, bio } = marketerDraft(s, slug);
  return {
    typeId: type, brandId: null,
    name: clampName(name), bio, slug,
    link: littlyUrl(slug),
    imagePrompt: type === 'marketer_photo' ? marketerPhotoPrompt(s) : marketerPrompt(s),
    withLogo: false,
  };
}

/**
 * ⚠️ 이름과 소개에 **각각 독립된 조합**을 돌린다. 하나의 odometer 로 묶으면 안 된다.
 *
 * 묶었더니 문장 재료가 느린 자릿수로 밀려서, 「다시 뽑기」를 눌러도 소개는 그대로고
 * 연차 숫자만 바뀌었다. 요청자 지적 그대로다.
 * 지금은 소개 쪽 첫 자리에 문장을 둬서 **한 번 누를 때마다 문장이 바뀐다.**
 */
/**
 * 어워즈형·AI TV CF 공통 초안. **문구 세트만 갈아 끼운다.**
 * @param {boolean} isAd AI TV CF 인지 — 슬로건·문의·부제·머리 이모지가 달라진다
 */
function awardsDraft(s, brand, isAd = false) {
  const product = PRODUCTS.find((p) => p.id === brand.id);
  const facts = awardFacts(product);
  const set = isAd ? AITVCF : AWARDS;
  // 재료 개수가 서로 달라서(7·5·4) 같은 seed 를 써도 세 줄이 각자 다른 주기로 돈다
  const slogan = pick(set.slogan, s);
  const contact = pick(set.contact, s);

  /**
   * ⚠️ 계정 이름은 **영문**으로 낸다 (요청자 지시 2026-08-13).
   *    예전에는 `brand.label`(국문 상품명)이 그대로 나왔다.
   *    부제까지 붙이면 30자를 넘기 쉬우므로 clampName() 이 뒤에서 자른다.
   */
  /**
   * 세 갈래로 돌린다 — 기본형만 / 기본형+부제 / 짧은형+부제.
   * 짧은형은 부제 자리가 넓어 들어가는 부제가 훨씬 많다.
   */
  const base = s % 3 === 2 ? (brand.enShort || brand.en) : brand.en;
  const name = s % 3 === 0 ? brand.en : nameWithSub(base, set.subtitle, s);

  const bio = fitBio([
    { text: `『${slogan}』`, keep: true },
    { text: SPACER },
    { text: `${isAd ? '📺' : '🏆'} ${brand.label}`, keep: true },
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
  /**
   * ⚠️ 분야 두 개를 무조건 붙이면 30자를 넘겨 단어 중간이 잘린다
   *    ("CONTENTS LAB | Marketing•Brand"). 들어가는 조합만 만든다.
   */
  const pairs = rest.map((second) => `${first}•${second}`);
  const name = nameWithSub(persona, pairs.length ? pairs : [first], s);

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

/**
 * `기본이름 | 부제` 를 만들되 **상한(30자)에 들어가는 부제만** 쓴다 (2026-08-13).
 *
 * ⚠️ 예전에는 그냥 붙이고 clampName() 이 뒤에서 잘랐다. 그래서 단어 중간이 끊긴
 *    "KBS N BRAND AWARDS | Brand Awa" 같은 이름이 나왔고, 잘린 뒤 서로 같아져
 *    **가짓수까지 줄었다**(400회 중 16종). 들어가는 것만 고르면 잘림도 없고 종류도 는다.
 *
 * @param {string} base 기본 이름 (이것만으로 상한을 넘으면 base 만 돌려준다)
 * @param {string[]} subs 부제 후보
 * @param {number} seed
 */
function nameWithSub(base, subs, seed) {
  const fits = subs.filter((x) => `${base} | ${x}`.length <= LIMITS.name);
  if (!fits.length) return clampName(base);
  return `${base} | ${pick(fits, seed)}`;
}
