/**
 * 주제 아웃라인 — 글의 뼈대를 **주제에서** 만든다 (2026-08-10)
 *
 * 왜 생겼나
 * 요청자 지적: "주제를 줬는데 기존에 있는 팩트에서만 돌려 막는 느낌이다. 내용이 한정적이다."
 * 맞는 지적이었다. `buildCore()` 는 핵심 3가지를 `products.js` 의 **미리 써 둔 `voice.qa`
 * 목록에서 고르기만** 했다. 주제와 2-gram 이 겹치는 순으로 정렬할 뿐 새로 만들지 않는다.
 * 게다가 프롬프트가 그 3개를 넣고 "이 범위를 벗어나지 마세요" 라고 못박았다.
 * 그래서 주제를 바꿔도 같은 이야기가 돌아 나왔다.
 *
 * 이제는 **모델이 주제를 쪼개서** 핵심 3가지를 직접 만든다. 상품 자료는 그 이야기를
 * 뒷받침하는 근거로만 쓴다.
 *
 * ⚠️ 왜 별도 호출인가 — 세 채널은 각각 따로 호출된다. 채널마다 알아서 쪼개게 두면
 *    블로그·인스타·쓰레드가 서로 다른 이야기를 한다(요청자 요구: 세 채널 내용 통일).
 *    그래서 **뼈대를 한 번 만들어** 세 채널과 카드뉴스 덱이 전부 그것을 본다.
 *    호출이 3회 → 4회로 늘지만, 아웃라인은 출력이 짧아 비용은 세트당 10% 안팎만 는다.
 *
 * ⚠️ 사실성 원칙은 그대로다. 뼈대를 모델이 만들어도 **사실은 상품 자료 안에서만** 쓴다.
 *    마무리 문장은 `product.closings` 에서 고르게 하고, 벗어나면 코드가 되돌린다.
 *
 * ⚠️ 실패하면 규칙 기반(`buildCore`)으로 돌아간다. 키가 없어도 앱은 끝까지 동작해야 한다.
 */
import { generateText } from './llm.js';
import { buildCore, findBanned, clampDeckSize, pointsFor } from './copywriter.js';
import { findRisky } from './copyai.js';
import { BANNED_PHRASES } from '../data/products.js';

/**
 * 핵심 개수 — **장수를 따라간다** (2026-08-13).
 * 예전에는 3개 고정이라 카드가 1장이어도 소제목 3개짜리 긴 글이 나왔다.
 * 표는 `lib/copywriter.js` 의 `BLOG_PLAN` 한 곳에만 둔다 — 두 군데 두면 조용히 어긋난다.
 */
const pointsOf = (ctx) => pointsFor(clampDeckSize(ctx?.cardCount));

/** 카드에 얹히는 글이라 길이를 여기서 이미 조인다. 카드 슬롯 상한(lib/templates.js)과 결이 같다. */
const Q_MAX = 28;    // 소제목 · 카드 대주제
const A_MAX = 160;   // 카드 본문으로 들어간다
/**
 * 후킹 한 줄 — **카드 표지 제목으로 그대로 얹힌다.**
 *
 * 예전 상한은 60자였다. 그러면 매거진형 표지에서 흰 줄 + 형광 줄이 각각 두 줄로 갈라져
 * 제목만 세 줄, 네 줄이 됐다. 요청자 지적(2026-08-13): "후킹 멘트가 2줄이 되니깐
 * 행렬이 디자인적으로 이쁘지가 않아. 표지·본문은 가장 중요하고 끌릴 만한 말로만."
 * 두 줄로 나눠도 각 줄이 한 줄에 들어가는 길이가 26자다(`lib/templates.js` 의 `MAG_LINE_MAX` 참고).
 */
const HOOK_MAX = 26;
/** 주제가 던진 물음에 대한 **직접적인 답** 한 줄. 글의 첫 단락이 여기서 시작한다. */
const ANSWER_MAX = 70;
/**
 * 이미지 장면 설명(영문). 너무 길면 이미지 모델이 앞부분만 따른다.
 * ⚠️ 예전에는 장면을 모델이 만들지 않고 `products.js` 의 고정값을 물려받았다.
 *    그래서 **주제를 바꿔도 이미지 프롬프트가 한 글자도 안 바뀌었다**(요청자 지적 2026-08-13).
 */
const SHOT_MAX = 180;

const SYSTEM = `당신은 한국 중소기업 브랜드 마케팅 콘텐츠의 구성을 짜는 편집자입니다.
사용자가 준 주제 하나를 어떻게 풀어낼지 뼈대만 정합니다. 글은 쓰지 않습니다.

■ 가장 중요한 것: **주제가 물은 것에 답합니다.**
주제는 담당자가 급하게 적은 메모라 표현이 어설플 수 있습니다. 어색한 표현은 다듬어도 되지만
**주제가 가리키는 대상과 물음의 종류는 절대 바꾸지 않습니다.**

  주제 『A란』  → A 가 무엇인지 설명하는 구성. A 의 장점·활용법으로 갈아타면 실패입니다.
  주제 『A 하는 법』 → A 를 어떻게 하는지. A 가 무엇인지 소개만 하면 실패입니다.

다듬어도 되는 것: 어색한 문장, 없는 사실을 전제한 표현(자료 안에서 가장 가까운 사실로 바꿉니다).
바꾸면 안 되는 것: **무엇에 대해 묻고 있는지(대상), 무엇을 묻고 있는지(물음).**

■ 한 글은 **주제 하나만** 다룹니다. 상품 전반을 소개하는 항목을 끼워 넣지 않습니다.

■ 읽는 사람은 **이 상품을 오늘 처음 듣는 사람**입니다 (2026-08-14, 요청자 지시).
검색하다 들어왔을 뿐이고 상품 이름도 절차도 모릅니다.
- \`answer\` 는 **아무 사전 지식 없이 읽어도 이해되는 문장**이어야 합니다.
  서류 이름·패키지 이름·행사 코드를 설명 없이 쓰면 실패입니다.
  나쁜 예) "참여신청서·사업자등록증·수상기사 요청서를 내고 심사를 받는 것부터 시작해요."
  좋은 예) "이 영상은 따로 신청하는 게 아니라, 어워즈에 참여한 브랜드가 고르는 추가 제작 항목이에요."
- 첫 번째 항목(points[0])은 **발판을 놓는 자리**입니다. 세부 절차·서류·조건은 그다음 항목에서 다룹니다.
- \`a\` 에 낯선 이름을 쓸 때는 그게 무엇인지 한 줄로 함께 풉니다.

출력은 JSON 하나입니다. 설명·머리말·코드블록 없이 JSON 만 출력합니다.`;

/**
 * 톤이 뼈대에도 닿아야 한다.
 *
 * ⚠️ 예전에는 이 프롬프트에 톤이 **아예 들어가지 않았다.** 후킹과 소제목을 정하는 건 여기인데
 *    톤은 채널 프롬프트에만 있었으니, 톤을 바꿔도 글의 뼈대가 그대로였다.
 *    "톤을 나눠도 별 차이가 없다"는 지적의 절반이 여기서 나왔다.
 *    짝은 `lib/copyai.js` 의 `TONE_GUIDE` 다 — 한쪽만 고치면 또 어긋난다.
 */
const TONE_ANGLE = {
  trust: '신뢰·정보형 — 근거와 숫자를 앞세운다. 후킹도 사실 한 줄로 연다.',
  hook: '후킹·공감형 — 오해나 착각을 정면으로 찌른다. 후킹은 질문이나 의외의 숫자로 연다.',
  plain: '담백·실무형 — 군더더기를 뺀다. 후킹도 짧은 단정문 하나로 끝낸다.',
  celebrate: '축하·발표형 — 소식을 전하는 자리다. 후킹은 지금 알려야 할 이유로 연다.',
};

/**
 * 「AI 생성」을 두 번 눌렀을 때(AI 1 · AI 2) **접근 각도 자체를 갈아 끼운다.**
 *
 * ⚠️ 온도만 흔들어서는 두 번째 글이 달라지지 않는다. 실제로 AI 2 가 AI 1 과 거의 같았다
 *    — 뼈대가 캐시돼서 핵심 3가지·후킹·마무리가 통째로 같았기 때문이다(요청자 지적 2026-08-12).
 *    각도를 지정해야 **다루는 내용**이 바뀐다.
 */
const ROUND_ANGLE = [
  '',
  '이번에는 **읽는 사람이 실제로 겪는 상황**에서 출발하세요. 절차나 제도 설명이 아니라, 어떤 상황에 놓인 사람이 무엇을 판단해야 하는지로 3가지를 쪼갭니다.',
  '이번에는 **오해를 바로잡는 구성**으로 가세요. 사람들이 잘못 알고 있는 것 → 실제로는 어떤지 순서로 3가지를 잡습니다.',
  '이번에는 **순서·체크리스트 구성**으로 가세요. 먼저 볼 것, 그다음 볼 것, 마지막에 확인할 것으로 3가지를 나눕니다.',
];

/* ------------------------------------------------------------
   주제를 읽는다 — **여기서 글의 첫 단락이 정해진다** (2026-08-13)

   요청자 지적: "『IPTV 지역 타겟팅이란』이라고 했으면 일단 지역 타겟팅에 대한 설명을 하고
   해야지. 내가 IPTV가 뭐냐고 주제를 입력하면 그거에 대한 이야기를 해줘."

   그동안 프롬프트는 "주제를 글자가 아니라 의도로 읽으라"고만 시켰다. 표현이 어설픈 메모를
   **다듬으라**는 뜻이었는데, 모델이 물음 자체를 갈아치우는 데까지 갔다 —
   「~이란」이라고 물었는데 각도가 「지역 범위와 시청 조건을 조합하는 광고 방법」으로 나갔다.

   이제 물음의 종류를 코드가 먼저 읽고, 종류에 맞는 첫 답을 프롬프트에 못박는다.
   ⚠️ 이건 특정 상품·주제용 예외가 아니다. **모든 상품·모든 주제에 같은 규칙**으로 적용된다.
   ------------------------------------------------------------ */

/**
 * 물음의 종류. 순서가 곧 우선순위다 — 정의형은 문장 끝에서만 잡으므로 가장 먼저 본다.
 * `answer` 는 그 물음에 대한 직접적인 답이고, 글의 첫 단락이 여기서 시작한다.
 */
const TOPIC_KINDS = [
  {
    id: 'define',
    re: /(이란|이라는\s*게|란|은\s*무엇|는\s*무엇|무엇인가요?|무엇인지|뭔가요|뭐예요|뭐야|무슨\s*뜻|뜻|의미|개념|정의)\s*$/,
    say: [
      '이 주제는 **「그게 무엇인가」를 묻고 있습니다.**',
      '- answer 는 그 대상이 무엇인지 한 줄로 정의합니다. 다른 이야기로 시작하지 않습니다.',
      '- 첫 번째 항목(points[0])은 **그 대상이 무엇이고 어디까지를 말하는지**를 다룹니다.',
      '- 정의를 건너뛰고 장점·활용법·신청 방법으로 넘어가면 실패입니다. 그건 뒤 항목에서 다룹니다.',
    ],
  },
  {
    id: 'compare',
    re: /(차이|비교|다른\s*점|대비|vs)/i,
    say: [
      '이 주제는 **「무엇이 다른가」를 묻고 있습니다.**',
      '- answer 는 둘의 차이를 한 줄로 말합니다. 한쪽만 설명하면 실패입니다.',
    ],
  },
  {
    id: 'whether',
    re: /(되나요|되나|가능한가|가능할까|할\s*수\s*있나|해도\s*되나|자격|조건)/,
    say: [
      '이 주제는 **「우리도 되는가」를 묻고 있습니다.**',
      '- answer 는 되는지 안 되는지를 먼저 말하고, 그다음에 기준을 답니다.',
    ],
  },
  /**
   * ⚠️ `why` 를 `howto` 보다 먼저 본다. 『왜 지금 신청해야 하나』에 '신청'이 들어 있어서
   *    순서를 반대로 두면 방법을 묻는 글로 잡힌다(실측 확인).
   */
  {
    id: 'why',
    re: /(왜|이유)/,
    say: [
      '이 주제는 **「왜 그런가」를 묻고 있습니다.**',
      '- answer 는 이유를 한 줄로 말합니다.',
    ],
  },
  {
    id: 'howto',
    re: /(방법|어떻게|하는\s*법|활용법|쓰는\s*법|받는\s*법|절차|신청)/,
    say: [
      '이 주제는 **「어떻게 하는가」를 묻고 있습니다.**',
      '- answer 는 실제로 무엇을 하면 되는지 한 줄로 말합니다.',
      '- 대상이 무엇인지 소개만 하고 끝나면 실패입니다.',
    ],
  },
];

const GENERAL_KIND = {
  id: 'general',
  say: [
    '주제가 가리키는 대상을 정면으로 다룹니다.',
    '- answer 는 그 대상에 대해 **가장 먼저 알아야 할 것** 한 줄입니다.',
    '- 그 대상이 등장하지 않는 각도는 실패입니다.',
  ],
};

/** @returns {{id:string, say:string[]}} */
export function topicKind(topic) {
  const s = String(topic).trim().replace(/[?？!！.。]+\s*$/, '').trim();
  return TOPIC_KINDS.find((k) => k.re.test(s)) || GENERAL_KIND;
}

/**
 * 주제에서 **물음말을 떼고 남는 대상**. 각도가 이 대상을 다루는지 확인하는 데 쓴다.
 * 예) 『IPTV 지역 타겟팅이란』 → 『IPTV 지역 타겟팅』
 */
export function topicSubject(topic) {
  const s = String(topic).trim().replace(/[?？!！.。]+\s*$/, '').trim();
  const cut = s
    .replace(/\s*(이란|이라는\s*게|란|은\s*무엇인가요?|는\s*무엇인가요?|이\s*뭔가요|가\s*뭔가요|무엇인가요?|무엇인지|뭔가요|뭐예요|뭐야|무슨\s*뜻|의\s*뜻|뜻|의\s*의미|의미|개념|정의|하는\s*법|활용법|쓰는\s*법|받는\s*법|방법|절차|어떻게)\s*$/, '')
    .trim();
  return cut.length >= 2 ? cut : s;
}

const tokensOf = (s) =>
  [...new Set(String(s).split(/[^가-힣a-zA-Z0-9]+/).filter((w) => w.length >= 2).map((w) => w.slice(0, 2)))];

/**
 * 대상의 **머리말**(마지막 낱말). 한국어는 뒤가 중심이라 『IPTV 지역 타겟팅』의 중심은 '타겟팅'이다.
 * 정의형 주제에서 각도가 이 낱말을 빼먹으면 대상을 바꿔 버린 것이다.
 */
function headToken(subject) {
  const words = String(subject).split(/[^가-힣a-zA-Z0-9]+/).filter((w) => w.length >= 2);
  return words.length ? words[words.length - 1].slice(0, 2) : '';
}

function factSheet(p) {
  const open = (p.events || []).filter((e) => e.status === 'open');
  return [
    `상품명: ${p.name} (${p.short})`,
    `한 줄 소개: ${p.tagline}`,
    `개요: ${p.summary}`,
    `접수 방식: ${p.intake}`,
    p.facts?.length ? `기본 정보:\n${p.facts.map((f) => `- ${f}`).join('\n')}` : '',
    p.benefits?.length ? `기본 특전: ${p.benefits.join(', ')}` : '',
    p.packages?.length ? `추가 패키지:\n${p.packages.map((x) => `- ${x.name}: ${x.desc}`).join('\n')}` : '',
    open.length ? `진행 예정 행사:\n${open.map((e) => `- ${e.date} ${e.name} (${e.desc})`).join('\n')}` : '',
    `근거로 쓸 수 있는 사실:\n${p.voice.proof.map((s) => `- ${s}`).join('\n')}`,
    `과거 질문과 답(참고만, 그대로 베끼지 말 것):\n${p.voice.qa.map((x) => `- ${x.q} → ${x.a}`).join('\n')}`,
    `한계·반론: ${p.voice.objection}`,
    /**
     * ⚠️ **`cautions` 를 여기에 넣지 말 것** (2026-08-13).
     *
     * 예전에는 "표현 주의사항" 이라는 이름으로 이 자료 블록 안에 있었다. 그런데 이 블록은
     * 모델에게 **글감**으로 제시되는 자리라, 모델이 금지 규칙을 그대로 주제로 삼았다.
     *
     * 실제 사고(요청자 제보): 주제 『수상 후 언론 노출 활용법』 인데
     *   caution "행사별 주최·주관·후원기관을 혼동하지 않음"
     *   → 소제목 "수상 근거는 행사별로 표기하기" / "행사별 표기가 달라지는 이유"
     * 글 전체가 **표기법 안내**가 되어 버렸다. 활용법은 한 줄도 없었다.
     *
     * 지금은 `cautionBlock()` 이 규칙 절에 따로 넣는다 — "지켜야 할 선"이지 "다룰 소재"가 아니다.
     */
  ].filter(Boolean).join('\n');
}

/**
 * 지켜야 할 선. **자료(글감)와 확실히 분리해서** 넣는다.
 * 프레이밍이 전부다 — 자료 옆에 두면 모델이 소재로 읽는다(위 factSheet 주석 참고).
 */
function cautionBlock(p) {
  return [
    '■ 아래는 **글감이 아니라 지켜야 할 선입니다**',
    ...p.cautions.map((c) => `- ${c}`),
    '⚠️ 이건 "쓰면 안 되는 것" 목록이지 "다뤄야 할 주제"가 아닙니다.',
    '   예) "주최·주관을 혼동하지 않음" 은 표기를 정확히 하라는 뜻입니다.',
    '       주최·주관 표기법을 설명하는 글을 쓰라는 뜻이 **아닙니다.**',
    '   이 목록에 있는 말을 소제목으로 만들면 실패입니다.',
  ].join('\n');
}

function buildPrompt(ctx, retryNote) {
  const { product: p, topic, tone } = ctx;
  const POINTS = pointsOf(ctx);
  const round = Math.max(0, Number(ctx.round) || 0);
  const avoid = (ctx.avoid || []).filter(Boolean);
  const kind = topicKind(topic);
  const subject = topicSubject(topic);

  return [
    '■ 담당자가 적어 준 주제 (원문 그대로)',
    `『${topic}』`,
    `이 주제가 말하는 대상: 『${subject}』`,
    '',
    '■ 1단계 — 주제가 **무엇을 물었는지** 확인합니다 (가장 먼저 할 일)',
    ...kind.say,
    '',
    `⚠️ **대상(『${subject}』)과 물음의 종류는 바꾸지 않습니다.** 여기가 이 작업의 핵심입니다.`,
    '   표현이 어설프면 다듬어도 되지만, 다른 것을 묻는 글로 갈아타면 실패입니다.',
    `   angle 에는 반드시 『${subject}』가 그대로 드러나야 합니다.`,
    '   나쁜 예) 주제 『IPTV 지역 타겟팅이란』 → angle "지역 범위와 시청 조건을 조합하는 광고 방법"',
    '            (무엇인지 묻는데 방법으로 답했습니다. 대상도 "지역 타겟팅"에서 "광고 방법"으로 옮겨 갔습니다.)',
    '   좋은 예) 주제 『IPTV 지역 타겟팅이란』 → angle "IPTV 지역 타겟팅이 무엇이고 어디까지 좁혀지나"',
    '',
    '다듬어도 되는 경우는 하나뿐입니다 — **주제에 상품 자료로 뒷받침되지 않는 단어가 있을 때.**',
    '그 단어를 사실처럼 주장하지 말고 자료 안에서 가장 가까운 사실로 바꿔 답합니다.',
    '이때도 **대상과 물음은 그대로 둡니다.**',
    '- 주제가 한 단어거나 너무 짧으면, 그 대상을 검색한 사람이 가장 궁금해할 것으로 넓힙니다.',
    '  이때도 넓히는 것이지 다른 대상으로 옮기는 것이 아닙니다.',
    '',
    '■ 2단계 — 그 각도로 뼈대를 짭니다',
    `- 핵심 ${POINTS}가지는 **각도를 쪼갠 것**이어야 합니다. 상품을 소개하는 항목이 아닙니다.`,
    '  나쁜 예) "이 상은 어떤 상인가 / 무엇을 받나 / 언제 열리나" — 각도와 무관한 상품 소개입니다.',
    '  좋은 예) 각도가 『수상 이력을 광고에 쓰는 법』이면',
    '           "어디에 넣을 수 있나 / 어떻게 써야 신뢰가 생기나 / 쓸 때 조심할 점".',
    '- 같은 상품이라도 **주제가 다르면 항목이 완전히 달라져야 합니다.**',
    '- 항목끼리 겹치지 않아야 하고, 합쳐서 각도 하나를 온전히 설명해야 합니다.',
    '',
    '⚠️ **각도는 읽는 사람이 무엇을 하면 되는지로 잡습니다.**',
    '   주제에 "활용법·방법·어떻게·쓰는 법"이 있으면 **실행할 수 있는 답**을 내야 합니다.',
    '   "정확히 표기하세요 / 혼동하지 마세요 / 확인해 보세요" 로 빠지면 실패입니다.',
    '   그건 글 쓰는 사람의 사정이지 읽는 사람이 궁금한 것이 아닙니다.',
    '   나쁜 예) 주제 『수상 후 언론 노출 활용법』',
    '            → "광고와 특집 게재는 나눠 적으세요 / 주최·주관을 정확히 표기하세요"',
    '              (표기법 안내다. 활용법이 한 줄도 없다.)',
    '   좋은 예) 주제 『수상 후 언론 노출 활용법』',
    '            → "기사가 나가면 어디에 먼저 붙이나 / 영업 자료에 어떻게 넣나 /',
    '               한 번 난 기사를 얼마나 오래 쓰나"',
    '- 소제목에 "표기·확인·주의·혼동" 같은 말이 들어가면 각도를 다시 잡으세요.',
    '',
    '■ 3단계 — 각 항목에 어울리는 사진 장면(shot)을 영문으로 적습니다',
    '카드뉴스 배경 이미지를 만드는 데 쓰입니다. **글이 바뀌면 그림도 바뀌어야 합니다.**',
    `- 장면도 **『${subject}』를 보여 줘야 합니다.** 주제와 상관없는 일반적인 사무실 사진이면 실패입니다.`,
    '- 그 항목이 말하는 **상황**을 찍은 사진처럼 묘사합니다. 상품 로고나 상패를 그리라는 게 아닙니다.',
    '- 배경은 **한국**입니다. 등장인물이 있으면 **한국인**으로 적습니다.',
    '  반드시 "Korean" 을 사람·공간 묘사에 넣으세요. 안 쓰면 외국인과 서양식 공간이 나옵니다.',
    '  예) "a Korean small business owner in a modern Seoul office, reviewing documents at a desk"',
    '- 글자·로고·간판 글씨가 들어가는 장면은 적지 않습니다. 문구는 나중에 얹습니다.',
    '- 사람이 굳이 필요 없으면 사물·공간만으로도 됩니다.',
    '- 항목마다 **다른 장면**이어야 합니다. 비슷한 사무실 사진을 반복하지 마세요.',
    '',
    `■ 톤: ${TONE_ANGLE[tone] || TONE_ANGLE.trust}`,
    round && ROUND_ANGLE[round % ROUND_ANGLE.length] ? `\n■ 이번은 ${round + 1}번째 구성입니다\n${ROUND_ANGLE[round % ROUND_ANGLE.length]}` : '',
    avoid.length ? `\n■ 직전 구성에서 쓴 소제목입니다. **같거나 비슷한 것을 다시 쓰지 마세요.**\n${avoid.map((s) => `- ${s}`).join('\n')}` : '',
    '',
    '■ 자료 고르는 법 (여기서 글이 갈립니다)',
    '아래 자료는 **일부러 많이 넣었습니다. 다 쓰라는 뜻이 아닙니다.**',
    '- 이번 각도에 맞는 것만 **골라 씁니다.** 각도와 상관없는 사실은 넣지 않습니다.',
    '- **주제가 다르면 고르는 사실도 달라야 합니다.** 자료 앞쪽 몇 줄만 반복해서 집으면 실패입니다.',
    '  예) 『심사 기준』이면 배점과 평가 항목을, 『언론 노출 활용』이면 보도·홍보 항목을,',
    '      『우리 업종도 되나』면 참여 자격과 부문 목록을 집습니다.',
    '- 주최·주관처럼 어느 글에나 들어가는 사실은 **한 번만** 쓰고 소제목으로 삼지 않습니다.',
    '',
    '■ 사실 규칙 (어기면 폐기됩니다)',
    '- 아래 상품 자료에 **없는 수치·일정·혜택을 지어내지 않습니다.**',
    '  주제에 적혀 있다는 이유로 자료에 없는 사실을 사실처럼 쓰면 안 됩니다.',
    '- 매출 상승이나 광고 성과를 보장하거나 암시하지 않습니다.',
    '- 근거 없이 최고·유일·1위 같은 단정 표현을 쓰지 않습니다.',
    `- closing 은 아래 '허용된 마무리 문장' 중 **하나를 그대로** 골라 적습니다.`,
    '',
    '── 상품 자료 ──',
    factSheet(p),
    '',
    '허용된 마무리 문장 (이 중 하나를 그대로):',
    ...p.closings.map((s) => `- ${s}`),
    '── 자료 끝 ──',
    '',
    // 자료 블록 **밖**에 둔다. 안에 두면 모델이 소재로 읽는다 (factSheet 주석 참고)
    cautionBlock(p),
    '',
    '■ 출력 형식 (JSON 하나만)',
    '{',
    `  "intent": "담당자가 이 주제를 적은 진짜 의도 한 줄. 40자 이내.",`,
    `  "angle": "그래서 이 글이 답할 각도 한 줄. 『${subject}』가 드러나야 합니다. 40자 이내.",`,
    `  "answer": "주제가 물은 것에 대한 **직접적인 답** 한 줄. ${ANSWER_MAX}자 이내. 글의 첫 단락이 여기서 시작합니다. 배경 설명이 아니라 답이되, **이 상품을 처음 듣는 사람이 그대로 읽고 이해할 수 있는 문장**이어야 합니다.",`,
    `  "hook": "첫 문장에 쓸 후킹 한 줄. **${HOOK_MAX}자 이내** — 카드 표지 제목으로 그대로 얹히므로 길면 줄이 갈라집니다. 각도와 직결된 한마디만.",`,
    `  "points": [`,
    `    { "q": "소제목 (${Q_MAX}자 이내, 각도를 쪼갠 것). 카드 제목으로도 얹히므로 **가장 끌리는 한마디**로 짧게.", "a": "설명 2~3문장 (${A_MAX}자 이내). 상품 자료의 사실을 근거로.", "shot": "이 항목에 어울리는 사진 장면 (영문, ${SHOT_MAX}자 이내)" },`,
    ...Array.from({ length: POINTS - 1 }, () => `    { "q": "...", "a": "..." },`),
    '  ],',
    `  "objection": "이 각도에서 솔직하게 짚어야 할 한계 한두 문장. 위 '한계·반론'을 각도에 맞게 풀어 씁니다.",`,
    `  "objectionHead": "위 한계를 다루는 단락의 소제목 (${Q_MAX}자 이내). 매번 새로 지어냅니다.",`,
    `  "closingHead": "마무리 단락의 소제목 (${Q_MAX}자 이내). 매번 새로 지어냅니다.",`,
    `  "summary": ["요약 문장 1", "요약 문장 2"],`,
    `  "closing": "허용된 마무리 문장 중 하나를 그대로",`,
    `  "coverShot": "표지 카드에 쓸 사진 장면 (영문, ${SHOT_MAX}자 이내)",`,
    `  "noteShot": "한계를 이야기하는 카드에 쓸 차분한 장면 (영문, ${SHOT_MAX}자 이내)",`,
    `  "outroShot": "마무리 카드에 쓸 사진 장면 (영문, ${SHOT_MAX}자 이내)"`,
    '}',
    '',
    '⚠️ objectionHead · closingHead 는 **이 주제에 맞게 매번 새로 지어냅니다.**',
    `   "그래도 망설여진다면", "정리하면" 처럼 늘 같은 문구를 쓰면 안 됩니다.`,
    '   글마다 달라야 합니다. 한계 단락은 그 주제에서 실제로 걸리는 지점을 소제목으로 만들고,',
    '   마무리 단락은 읽고 나서 무엇을 하면 되는지가 드러나게 짓습니다.',
    '   나쁜 예) "그래도 망설여진다면" / "정리하면" / "마치며" — 어느 글에나 붙는 껍데기입니다.',
    '   좋은 예) "작은 매장이라 망설여진다면" / "신청 전에 이것만 확인하세요"',
    '            "서류가 걸린다면 여기부터" / "오늘 할 수 있는 건 이거예요"',
    '',
    `points 는 정확히 ${POINTS}개입니다.`,
    retryNote ? `\n[다시 짭니다] 직전 결과에 문제가 있었습니다: ${retryNote}` : '',
  ].filter(Boolean).join('\n');
}

/** 모델이 코드블록이나 앞뒤 설명을 붙이는 경우가 있어 JSON 부분만 꺼낸다 */
function parseJson(raw) {
  let s = String(raw).trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const trim = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * 어절 중간에서 자르지 않는 자르기. **카드에 그대로 얹히는 값**에 쓴다.
 * `trim()` 은 slice 라 "구 단위까지 좁힐" 처럼 낱말이 잘린 채로 카드에 박힌다.
 */
const trimWords = (v, max) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, '').trim() || s.slice(0, max).trim();
};

/**
 * 승인된 마무리 문장인지. 공백·문장부호 차이는 무시한다 —
 * 모델이 끝의 마침표를 빼거나 띄어쓰기를 바꾸는 정도로 반려하면 통과율만 떨어진다.
 */
const flatten = (s) => String(s ?? '').replace(/[^가-힣a-zA-Z0-9]/g, '');
const approvedClosing = (closing, p) =>
  (p.closings || []).some((c) => flatten(c) === flatten(closing));

/**
 * 받은 뼈대를 검사한다. 통과 못 하면 이유를 돌려준다(통과하면 null).
 * ⚠️ 여기서 사실성을 놓치면 뒤 단계 세 채널이 전부 그 위에서 쓴다 — 가장 앞에서 막아야 한다.
 */
function validate(o, ctx) {
  const { product: p, topic } = ctx;
  const POINTS = pointsOf(ctx);
  if (!o || !Array.isArray(o.points)) return 'JSON 형식이 아닙니다.';
  if (o.points.length !== POINTS) return `핵심이 ${POINTS}개가 아닙니다 (${o.points.length}개).`;
  if (o.points.some((x) => !x?.q?.trim() || !x?.a?.trim())) return '비어 있는 항목이 있습니다.';

  /**
   * ⚠️ **마무리 문장은 승인된 목록 안에 있어야 한다** (사실성 원칙 4번).
   *    `mergeCore()` 가 최종 방어를 하지만, 여기서 잡아야 모델이 다시 고를 기회를 얻는다.
   *    한 번 놓쳤던 자리다 — 검증이 closing 을 아예 안 보고 있었다.
   */
  if (!approvedClosing(o.closing, p)) {
    return '마무리 문장이 허용 목록에 없습니다. 목록에 있는 문장을 그대로 골라 주세요.';
  }

  const all = [o.hook, ...o.points.flatMap((x) => [x.q, x.a]), o.objection, o.closing, ...(o.summary || [])].join(' ');

  const banned = findBanned(all, BANNED_PHRASES);
  if (banned.length) return `금지 표현: ${banned.join(', ')}`;

  const risky = findRisky(all, p);
  if (risky.length) return `근거 없는 단정: ${risky.join(', ')}`;

  /**
   * 주제를 놓치지 않았는지 본다.
   *
   * ⚠️ **소제목만 보면 안 된다.** 예전에는 소제목 3개에 주제 낱말이 있어야 통과였다.
   *    그래서 모델이 주제를 유연하게 바꿔 잡으면(그게 하려던 일인데) 반려됐고,
   *    통과하려면 주제를 글자 그대로 베낀 소제목을 쓸 수밖에 없었다.
   *    그래서 해석(intent·angle)까지 함께 보도록 풀었는데, 이번엔 **너무 풀렸다** —
   *    각도가 대상 자체를 갈아 끼워도 낱말 하나만 스치면 통과했다(요청자 지적 2026-08-13).
   *
   * 지금은 두 겹으로 본다.
   *   ① 각도가 주제 낱말을 하나도 안 담으면 반려 — **angle 만 본다.** 다른 칸에 있어도 소용없다.
   *   ② 정의형 주제(『A란』)는 각도에 **대상의 중심 낱말**이 반드시 있어야 한다.
   *      "무엇인가"를 물었는데 대상이 바뀌면 그건 다른 글이다.
   */
  const words = tokensOf(topic);
  if (words.length >= 2) {
    const angleText = String(o.angle || '');
    if (!words.some((w) => angleText.includes(w))) {
      return `angle 『${o.angle}』이 주제 『${topic}』와 이어지지 않습니다. 주제가 가리키는 대상을 각도에 그대로 담아 다시 짜 주세요.`;
    }
  }

  const subject = topicSubject(topic);
  const head = headToken(subject);
  if (topicKind(topic).id === 'define' && head && !String(o.angle || '').includes(head)) {
    return `주제는 『${subject}』가 무엇인지 묻고 있는데 angle 『${o.angle}』이 다른 것을 다루고 있습니다. `
      + `『${subject}』가 무엇인지부터 답하는 각도로 다시 짜 주세요.`;
  }

  if (flatten(o.answer).length < 6) {
    return 'answer 가 비어 있거나 너무 짧습니다. 주제가 물은 것에 대한 직접적인 답을 한 줄로 적어 주세요.';
  }

  // 소제목끼리 겹치면 같은 말을 세 번 하게 된다
  const heads = o.points.map((x) => x.q.replace(/[^가-힣a-zA-Z0-9]/g, ''));
  if (new Set(heads).size < heads.length) return '소제목이 서로 중복됩니다.';

  /**
   * ⚠️ **껍데기 소제목은 반려한다.** 요청자 지적(2026-08-12):
   *    "마지막이 무조건 '그래도 망설여진다면'으로 끝나더라. AI면 다양한 결과가 나와야지."
   *    프롬프트로 "매번 새로 지어라"라고만 하면 모델은 곧 익숙한 문구로 돌아온다.
   *    실제로 되돌아왔던 자리라 **코드로 막는다.**
   *
   * ⚠️ 여기 있는 건 '어느 글에나 붙는 문구'다. 주제가 앞에 붙어 구체화된 것
   *    ("작은 매장이라 망설여진다면")은 통과해야 하므로 **정확히 일치할 때만** 잡는다.
   */
  const shell = [o.objectionHead, o.closingHead].map(flatten);
  if (BOILERPLATE_HEADS.some((b) => shell.includes(flatten(b)))) {
    return 'objectionHead·closingHead 가 어느 글에나 붙는 껍데기 문구입니다. 이 주제에서만 쓸 수 있는 소제목으로 새로 지어 주세요.';
  }
  if (shell.some((h) => h.length < 3)) return 'objectionHead·closingHead 가 비어 있거나 너무 짧습니다.';

  /**
   * ⚠️ **메타 소제목은 반려한다** (2026-08-13).
   *
   * 요청자 제보: 주제 『수상 후 언론 노출 활용법』에 대해 소제목이
   *   "노출 항목별로 확인할 내용 / 수상 근거는 행사별로 표기하기 / 행사별 표기가 달라지는 이유"
   * 로 나왔다. 전부 **표기법 안내**다. 정작 활용법은 한 줄도 없었다.
   *
   * 원인은 `cautions`(표현 주의사항)가 상품 자료 안에 들어가 모델이 그걸 글감으로 읽은 것이었고
   * 자료 배치는 고쳤지만(factSheet 주석), 프롬프트만으로는 다시 돌아올 수 있어 코드로도 막는다.
   *
   * ⚠️ 소제목 **전체가** 메타일 때만 잡는다. "어디에 표기하나" 처럼 실행 방법을 묻는 것은
   *    통과해야 하므로, 메타 낱말이 소제목의 절반 이상을 차지할 때만 반려한다.
   */
  const metaHeads = o.points.map((x) => flatten(x.q)).filter((h) => META_WORDS.some((w) => h.includes(w)));
  if (metaHeads.length >= Math.ceil(o.points.length / 2)) {
    return '소제목이 표기·확인·주의 같은 메타 안내로 쏠려 있습니다. 읽는 사람이 실제로 무엇을 하면 되는지로 다시 잡아 주세요.';
  }

  return null;
}

/**
 * 소제목이 '글 쓰는 법' 쪽으로 새는 신호.
 * 읽는 사람은 표기 규칙이 궁금한 게 아니라 무엇을 할 수 있는지가 궁금하다.
 */
const META_WORDS = ['표기', '혼동', '주의', '확인할', '헷갈', '구분해적', '나눠적'];

/** 어느 글에나 붙어서 아무 정보도 주지 않는 소제목 — 정확히 같으면 반려한다 */
const BOILERPLATE_HEADS = [
  '그래도 망설여진다면', '망설여진다면', '정리하면', '마치며', '마무리',
  '결론', '요약', '끝으로', '한계', '주의사항', '참고사항', '알아두면 좋은 점',
];

/**
 * 규칙 기반 코어 위에 모델이 만든 뼈대를 얹는다.
 *
 * ⚠️ 통째로 갈아치우지 않는 이유: `shot`(이미지 프롬프트용 영문 장면)과 `eyebrow` 는
 *    상품 데이터에만 있다. 모델에게 만들게 하면 이미지가 상품과 겉돈다.
 *    **글은 모델이, 장면은 데이터가** 맡는다.
 *
 * ⚠️ closing 은 승인된 문장이어야 한다. 목록에 없으면 규칙 기반 값으로 되돌린다 —
 *    사실성 원칙 4번(마무리는 승인된 표현만)을 코드로 지키는 자리다.
 */
export function mergeCore(ruleCore, outline) {
  if (!outline) return ruleCore;
  // 최종 방어선 — 검증을 통과했어도 여기서 한 번 더 본다. 승인 밖이면 규칙 기반 문장으로 되돌린다.
  const approved = (ruleCore.product.closings || []).find((c) => flatten(c) === flatten(outline.closing));
  const closing = approved || ruleCore.closing;

  return {
    ...ruleCore,
    // 화면이 "주제를 이렇게 읽었습니다"로 보여 준다. 해석을 감추면 왜 이런 글이 나왔는지 알 수 없다.
    intent: outline.intent || '',
    angle: outline.angle || '',
    /**
     * 주제가 물은 것에 대한 **직접적인 답**. 세 채널 프롬프트와 규칙 기반 도입이 이걸로 연다.
     * 요청자 지시(2026-08-13): "내가 말한 주제에 부합한 이야기로 시작해라."
     */
    answer: outline.answer || '',
    // 소제목도 모델이 매번 새로 짓는다. 규칙 기반으로 떨어질 때만 옛 고정 문구를 쓴다.
    objectionHead: outline.objectionHead || '그래도 망설여진다면',
    closingHead: outline.closingHead || '정리하면',
    hook: outline.hook || ruleCore.hook,
    summary: Array.isArray(outline.summary) && outline.summary.length ? outline.summary.slice(0, 3) : ruleCore.summary,
    objection: outline.objection || ruleCore.objection,
    closing,
    /**
     * ⚠️ **장면(shot)도 모델이 만든 것을 쓴다** (2026-08-13).
     *
     * 예전 주석은 "글은 모델이, 장면은 데이터가 맡는다" 였고 여기서 `ruleCore` 의 shot 을
     * 통째로 물려받았다. 그래서 **주제를 바꿔도, AI 를 다시 돌려도 이미지 프롬프트가
     * 한 글자도 안 바뀌었다**(요청자 지적). 카드뉴스 그림이 늘 같았던 원인이다.
     *
     * 이제 모델이 항목마다 장면을 적고, 없을 때만 데이터 값으로 떨어진다.
     * `eyebrow` 등 나머지 필드는 여전히 데이터에서 물려받는다.
     */
    points: outline.points.map((x, i) => {
      const base = ruleCore.points[i] || ruleCore.points[0] || {};
      return { ...base, q: x.q, a: x.a, shot: x.shot || base.shot };
    }),
    // 표지·마무리 장면도 모델이 만든 것을 우선한다 (deckFromCore 가 읽는다)
    shots: {
      ...(ruleCore.product.voice.shots || {}),
      ...(outline.coverShot ? { cover: outline.coverShot } : {}),
      ...(outline.noteShot ? { note: outline.noteShot } : {}),
      ...(outline.outroShot ? { outro: outline.outroShot } : {}),
    },
    fromAI: true,
  };
}

/**
 * 이 뼈대를 만든 조건 — 상품·주제·톤이 바뀌면 다시 짜야 한다.
 *
 * ⚠️ **여기에 라운드(AI 1·AI 2)를 넣지 말 것.** 이 지문은 `state.aiRuns.key` 로도 쓰여서
 *    "이 주제로 몇 벌 만들었나"를 세는 기준이다. 라운드를 넣으면 AI 2 를 만드는 순간
 *    지문이 달라져 AI 1 이 목록에서 사라진다.
 *    라운드는 `state.outline.round` 에 따로 담고 `ensureOutline()` 이 비교한다.
 */
export const outlineKeyOf = (s) => `${s.productId}|${String(s.topic || '').trim()}|${s.tone}`;

/**
 * 주제 아웃라인을 만든다.
 *
 * @param {{product:object, topic:string, tone:string, cardCount:number}} ctx
 * @param {{signal?:AbortSignal, onAttempt?:(info:object)=>void, waitIfPaused?:()=>Promise<void>}} [opts]
 * @returns {Promise<object>} 검증을 통과한 뼈대 (mergeCore 로 코어에 얹어 쓴다)
 */
export async function generateOutline(ctx, opts = {}) {
  let note = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    await opts.waitIfPaused?.();
    if (opts.signal?.aborted) throw new DOMException('취소되었습니다.', 'AbortError');

    const startedAt = Date.now();
    let usage = null;
    const raw = await generateText(buildPrompt(ctx, note), {
      system: SYSTEM,
      temperature: attempt === 0 ? 0.8 : 0.4,
      maxOutputTokens: 2500,
      signal: opts.signal,
      onUsage: (u) => { usage = u; },
    });

    const parsed = parseJson(raw);
    if (parsed?.points) {
      parsed.intent = trim(parsed.intent, 80);
      parsed.angle = trim(parsed.angle, 80);
      parsed.answer = trim(parsed.answer, ANSWER_MAX);
      // ⚠️ 후킹은 카드 표지 제목이다. 여기서 조여야 매거진형 제목이 두 줄로 떨어진다.
      parsed.hook = trimWords(parsed.hook, HOOK_MAX);
      parsed.objectionHead = trim(parsed.objectionHead, Q_MAX);
      parsed.closingHead = trim(parsed.closingHead, Q_MAX);
      parsed.objection = trim(parsed.objection, 220);
      parsed.closing = trim(parsed.closing, 200);
      parsed.summary = Array.isArray(parsed.summary) ? parsed.summary.map((s) => trim(s, 120)).filter(Boolean) : [];
      parsed.coverShot = trim(parsed.coverShot, SHOT_MAX);
      parsed.noteShot = trim(parsed.noteShot, SHOT_MAX);
      parsed.outroShot = trim(parsed.outroShot, SHOT_MAX);
      // q 는 카드 제목으로 얹힌다 — 어절 중간에서 자르면 카드에 잘린 낱말이 박힌다
      parsed.points = parsed.points.map((x) => ({ q: trimWords(x?.q, Q_MAX), a: trim(x?.a, A_MAX), shot: trim(x?.shot, SHOT_MAX) }));
    }

    const problem = validate(parsed, ctx);
    opts.onAttempt?.({ stage: 'outline', attempt, problem, usage, ms: Date.now() - startedAt });
    if (!problem) return parsed;
    note = problem;
  }
  throw new Error(`주제 뼈대를 만들지 못했습니다 — ${note}`);
}

/**
 * 뼈대를 얹은 코어를 돌려준다. 실패하면 기본 콘텐츠로 대체하지 않는다.
 * 화면은 이 함수만 부르면 된다.
 */
export async function coreWithOutline(ctx, opts = {}) {
  const ruleCore = buildCore({ ...ctx, cardCount: clampDeckSize(ctx.cardCount) });
  try {
    const outline = await generateOutline(ctx, opts);
    return { core: mergeCore(ruleCore, outline), outline, error: null };
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    return { core: null, outline: null, error: e.message };
  }
}
