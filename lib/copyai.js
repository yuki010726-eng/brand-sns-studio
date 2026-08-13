/**
 * LLM 글귀 생성
 *
 * 규칙 기반 생성기(lib/copywriter.js)는 승인된 문장을 조합만 하므로 사실 위반이 구조적으로
 * 불가능했다. 대신 문장이 정해져 있어 글이 빈약하다는 한계가 있었다.
 *
 * LLM 은 그 반대다. 글은 좋아지지만 **없는 사실을 만들어낼 수 있다.**
 * 그래서 이 파일은 생성보다 **검증**이 본체다:
 *
 *   1. 프롬프트에 상품 사실을 통째로 넣고 "이 안에서만 쓰라"고 못박는다
 *   2. 받은 글을 findBanned() 로 검사한다
 *   3. 걸리면 무엇이 걸렸는지 알려주고 한 번 더 시킨다
 *   4. 그래도 걸리면 던진다 → 호출한 쪽이 규칙 기반 글로 되돌린다
 *
 * 검증을 통과하지 못한 글은 절대 화면에 내보내지 않는다.
 */
import { generateText } from './llm.js';
import { findBanned, buildDeck, captionOf, roleLabels, clampDeckSize, blogPlanFor, HEAD_MARK } from './copywriter.js';
import { BANNED_PHRASES, CHANNELS } from '../data/products.js';

/**
 * 톤 — **한 줄로는 톤이 바뀌지 않는다.**
 *
 * 예전에는 톤마다 짧은 한 줄이었고 그마저 프롬프트 한가운데 묻혀 있었다. 그래서 톤을 바꿔도
 * 결과가 거의 같았다(요청자 지적). 톤은 어미·문장 길이·여는 방식·쓰지 말 것까지 지정해야
 * 실제로 갈린다. 뼈대 쪽 톤 지시는 `lib/outline.js` 의 `TONE_ANGLE` 에 있다 — 짝이라 같이 본다.
 *
 * ⚠️ 네 톤 모두 **바탕은 `SYSTEM` 의 친절한 블로그 말투**다. 톤은 그 위에 얹는 강약이지
 *    말투를 갈아치우는 것이 아니다. 여기에 "딱딱하게", "격식 있게" 같은 지시를 넣지 말 것.
 */
const TONE_GUIDE = {
  trust: [
    '신뢰·정보형 — 근거를 먼저 보여주는 톤.',
    '- 숫자와 출처를 문장 앞쪽에 둡니다. "며칠에", "몇 개가", "누가 주관하는지"를 먼저요.',
    '- 숫자를 던지고 끝내지 말고 **그게 무슨 뜻인지 한 줄 붙여 줍니다.**',
    '  예) "작년에 139개 기업이 받았어요. 생각보다 문턱이 낮다는 뜻이죠."',
    '- 느낌표와 이모지는 쓰지 않습니다.',
    '- 하지 말 것: "지금 바로", "놓치지 마세요" 같은 재촉.',
  ].join('\n'),
  hook: [
    '후킹·공감형 — 오해를 먼저 짚어 주는 톤.',
    '- 읽는 사람이 **잘못 알고 있을 법한 것**을 첫 줄에서 뒤집습니다.',
    '- 실제로 듣는 말을 큰따옴표로 옮깁니다. 예) "그거 대기업만 되는 거 아니에요?"',
    '- 짧은 문장과 긴 문장을 섞고, 한 단락에 한 번은 물음표로 끊습니다.',
    '- 하지 말 것: 사실을 부풀려 후킹 만들기. 후킹은 각도로 만들지 과장으로 만들지 않습니다.',
  ].join('\n'),
  plain: [
    '담백·실무형 — 바쁜 사람에게 요점만 주는 톤.',
    '- 결론부터 씁니다. 배경 설명은 뒤로 미루거나 뺍니다.',
    '- 한 문장 25자 안팎. 수식어를 덜어냅니다.',
    '- 담백한 것이지 무뚝뚝한 것이 아닙니다. **"~예요", "~거든요" 는 그대로 씁니다.**',
    '- 하지 말 것: "~라고 할 수 있습니다", "~인 것 같습니다" 처럼 늘어지는 마무리.',
  ].join('\n'),
  celebrate: [
    '축하·발표형 — 소식을 전하는 톤.',
    '- 날짜·마감·진행 상황을 앞에 둡니다. 지금 알려야 하는 이유부터요.',
    '- 이모지는 단락 맨 앞에만, 글 전체에서 3개까지.',
    '- 하지 말 것: 들뜬 과장("드디어!", "역대급"). 소식은 전하되 톤은 차분하게.',
  ].join('\n'),
};

/**
 * 「AI 생성」을 두 번 눌렀을 때(AI 1 · AI 2) **글의 진입 방식**을 갈아 끼운다.
 *
 * 뼈대(`lib/outline.js` 의 `ROUND_ANGLE`)가 다루는 항목을 바꾸고, 여기서는 같은 항목을
 * 어떻게 여는지를 바꾼다. 둘 다 있어야 AI 2 가 AI 1 과 확실히 달라진다.
 */
const ROUND_OPENING = [
  '',
  '이번 글은 **구체적인 상황 하나를 묘사하며** 엽니다. 일반론으로 시작하지 마세요.',
  '이번 글은 **자주 듣는 질문 한 줄을 큰따옴표로 옮기며** 엽니다.',
  '이번 글은 **숫자 하나를 던지며** 엽니다. 그 숫자가 무슨 뜻인지는 다음 단락에서 풉니다.',
];

/**
 * AI 출력 전용 위험 표현 검사.
 *
 * `BANNED_PHRASES`(data/products.js)는 정확히 일치하는 문구 5개뿐이다.
 * 승인된 문장만 조합하던 규칙 기반 생성기에는 그걸로 충분했지만,
 * **자유롭게 쓰는 LLM 에는 턱없이 느슨하다** — "업계 1위", "최고 권위", "매출이 보장됩니다"가
 * 전부 그냥 통과했다. 그래서 어형 변화를 잡는 정규식 검사를 따로 둔다.
 *
 * 이 검사는 AI 출력에만 적용한다. 사람이 직접 쓴 편집본까지 막지는 않는다.
 */
/**
 * 뒤에 부정어가 붙으면 주장이 아니라 '선긋기'다.
 *
 * 승인된 반론 문장이 "상을 받는다고 매출이 오르지는 **않습니다**" 인데,
 * 이걸 매출 상승 주장으로 잡아 정상 글 336건을 막았다. 솔직하게 한계를 밝히는 문장을
 * 막으면 안 된다. 그래서 같은 문장 안에서 뒤따르는 부정어를 확인하고 넘긴다.
 */
const NOT_NEGATED = '(?![^.!?\\n]{0,16}(않|없|아니|못하|어렵))';

const RISKY = [
  { re: new RegExp(`최고\\s*(의|권위|수준)?${NOT_NEGATED}`), why: "'최고' 단정" },
  { re: new RegExp(`유일(한|무이)?${NOT_NEGATED}`), why: "'유일' 단정" },
  { re: new RegExp(`(업계|국내|전국|세계)?\\s*1\\s*위${NOT_NEGATED}`), why: "'1위' 단정" },
  { re: new RegExp(`보장${NOT_NEGATED}`), why: "'보장' 표현" },
  { re: new RegExp(`무조건${NOT_NEGATED}`), why: "'무조건' 표현" },
  { re: new RegExp(`100\\s*%${NOT_NEGATED}`), why: "'100%' 표현" },
  { re: new RegExp(`매출\\S*\\s*(상승|증가|오르|늘어|뛰)${NOT_NEGATED}`), why: '매출 상승 암시' },
  { re: /반드시\s*(수상|선정|성공|효과)/, why: '성과 단정' },
  { re: /(틀림없|확실히\s*(수상|성공))/, why: '성과 단정' },
];

/**
 * 상품 데이터에 원래 들어 있는 표현 — 검사에서 제외한다.
 *
 * 포브스의 행사 이름이 실제로 "고객신뢰도 1위 프리미엄 브랜드 대상"이다. 고유명사라
 * 그대로 써야 하는데 '1위 단정'으로 잡혀 정상 글 96건을 막았다.
 * 승인된 원문을 먼저 지우고, **남은 부분**에서만 위험 표현을 찾는다.
 */
function safePhrasesOf(p) {
  if (!p) return [];
  return [
    p.name, p.short, p.tagline, p.summary, p.intake,
    ...(p.facts || []),
    ...(p.benefits || []),
    ...(p.packages || []).flatMap((x) => [x.name, x.desc]),
    ...(p.events || []).flatMap((e) => [e.name, e.desc]),
    ...(p.closings || []),
    ...(p.voice?.proof || []),
    ...(p.voice?.qa || []).flatMap((x) => [x.q, x.a]),
    p.voice?.objection,
  ].filter((s) => typeof s === 'string' && s.length > 1);
}

/** @param {string} text @param {object} [product] 승인된 원문을 제외하려면 넘긴다 */
export function findRisky(text, product) {
  let rest = String(text);
  for (const phrase of safePhrasesOf(product)) rest = rest.split(phrase).join(' ');
  return RISKY.filter((r) => r.re.test(rest)).map((r) => r.why);
}

/** 블로그에 들어가는 이미지 자리 — 카드뉴스 장수와 1:1 대응한다 (장수는 2단계에서 고른다) */
export const imageSlotLine = (n, size = 6) =>
  `📷 [이미지 ${n} · ${roleLabels(size)[n - 1]}] 카드뉴스 ${n}번을 여기에 넣으세요`;

/** 이미지 바로 아래 캡션 한 줄 — 레퍼런스 3편 모두 본문 이미지에 설명이 붙어 있다 */
const CAPTION_MARK = '⤷';

/**
 * 모델에게 넘길 상품 사실 — 여기 없는 건 쓰면 안 된다.
 *
 * ⚠️ 이건 **재료**지 목차가 아니다. 처음엔 이 자료를 그대로 넘겼더니 모델이 주제를 제쳐두고
 * 자료를 순서대로 요약해 버렸다("기존 내용만 가져온다"). 그래서 각 항목 이름에
 * '재료', '베끼지 말 것'을 명시하고, 프롬프트에서 주제를 맨 앞에 세운다.
 */
function factSheet(p) {
  const open = (p.events || []).filter((e) => e.status === 'open');
  const lines = [
    `상품명: ${p.name}`,
    `짧은 이름: ${p.short}`,
    `계정: ${p.handle}`,
    `한 줄 소개: ${p.tagline}`,
    `개요: ${p.summary}`,
    `접수 방식: ${p.intake}`,
    p.site ? `공식 사이트: ${p.site}` : '',
    p.facts?.length ? `기본 정보:\n${p.facts.map((f) => `- ${f}`).join('\n')}` : '',
    p.benefits?.length ? `기본 특전: ${p.benefits.join(', ')}` : '',
    p.packages?.length ? `추가 패키지:\n${p.packages.map((x) => `- ${x.name}: ${x.desc}`).join('\n')}` : '',
    open.length ? `진행 예정 행사:\n${open.map((e) => `- ${e.date} ${e.name} (${e.desc})`).join('\n')}` : '',
    `[참고 재료] 과거에 받았던 질문과 답 — 주제에 필요한 부분만 골라 쓰고, 문장을 그대로 베끼지 말 것:\n${p.voice.qa.map((x) => `- ${x.q} → ${x.a}`).join('\n')}`,
    `[참고 재료] 근거로 쓸 수 있는 사실:\n${p.voice.proof.map((s) => `- ${s}`).join('\n')}`,
    `한계·반론(반드시 솔직하게 다룰 것): ${p.voice.objection}`,
    `허용된 마무리 문장(이 중에서만 고를 것):\n${p.closings.map((s) => `- ${s}`).join('\n')}`,
    `해시태그: ${p.hashtags.map((h) => `#${h}`).join(' ')}`,
    `표현 주의사항:\n${p.cautions.map((c) => `- ${c}`).join('\n')}`,
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * ⚠️ **말투 명세가 이 파일의 핵심이다.** 요청자 지시(2026-08-12):
 *    "블로그에서 가장 친절하고 정보 전달을 잘하는 블로그의 말투를 그대로 사용해줘."
 *
 * 그래서 화자를 '카피라이터'에서 **'먼저 알아보고 정리해 주는 사람'** 으로 바꿨다.
 * 아래 「말투」 절은 추상적인 형용사가 아니라 **어미·문장 길이·금지어 목록**으로 적는다 —
 * "친절하게 써라"라고만 하면 모델은 늘 쓰던 홍보문체로 돌아간다.
 *
 * ⚠️ 이 절을 줄이거나 "격식 있게" 같은 지시를 다시 넣지 말 것. 딱딱하다는 지적을 두 번 받은 자리다.
 */
const SYSTEM = `당신은 중소기업 브랜드 정보를 정리해 알려주는 블로그를 운영하는 사람입니다.
광고 대행사 카피라이터가 아닙니다. **먼저 알아본 사람이 옆에서 정리해 주는 글**을 씁니다.

■ 가장 중요한 것: **주제는 글자가 아니라 의도로 읽습니다.**
주제는 담당자가 급하게 적은 메모입니다. 문장이 어설플 수도, 표현이 정확하지 않을 수도 있습니다.
글자를 그대로 따르지 말고 **무엇을 알고 싶어서 이렇게 적었는지**에 답합니다.
아래에 「주제를 이렇게 읽었습니다」가 주어지면 그 각도로 씁니다. 원문 표현을 억지로 되풀이하지 않습니다.
다만 **자료에 없는 사실을 주제에 적혀 있다는 이유로 사실처럼 쓰지는 않습니다.**

■ 후킹: 첫 단락에서 읽는 사람이 이걸 왜 지금 봐야 하는지를 만듭니다.
"안녕하세요", "오늘은 ~에 대해 알아보겠습니다" 같은 인사말로 시작하지 않습니다.

■ 깊이: 받은 목차 3가지를 각각 **왜 그런지 · 어떻게 하는지 · 무엇을 조심해야 하는지**까지 풉니다.
사실 하나를 던지고 넘어가지 않습니다. 그 사실이 읽는 사람에게 무슨 의미인지까지 씁니다.
자료에 있는 문장을 나열하는 것은 실패입니다. 사실은 근거로만 쓰고 설명은 새로 씁니다.

절대 규칙 (하나라도 어기면 그 글은 폐기됩니다):
1. 제공된 '상품 사실' 안에 있는 내용만 씁니다. 없는 수치·일정·혜택을 지어내지 않습니다.
2. 매출 상승이나 광고 성과를 보장하거나 암시하지 않습니다.
3. 공식 근거 없이 최고·유일·1위·최고 권위 같은 단정 표현을 쓰지 않습니다.
4. 마무리 문장은 '허용된 마무리 문장' 목록에서 고르거나 그 뜻을 벗어나지 않게 씁니다.
5. 기본 특전과 추가 패키지를 섞지 않고 구분해서 씁니다.
6. 확정되지 않은 것은 '예정'이라고 씁니다.

■ 출력 형식 (어기면 사람이 손으로 다시 고쳐야 합니다)
- **마크다운을 쓰지 않습니다.** 붙여넣을 곳이 네이버 블로그·인스타그램·쓰레드라
  \`**\`, \`##\`, \`- \` 같은 기호가 그대로 글자로 찍힙니다.
- 강조하고 싶으면 별표 대신 **문장을 짧게 끊거나 줄을 바꿉니다.**
- 소제목은 "${HEAD_MARK} 소제목" 형태로 한 줄만 씁니다. 샵(#)을 붙이지 않습니다.

■ 말투 — **친절하고 정보 전달을 잘하는 블로그의 말투** (가장 중요합니다)
읽는 사람을 옆자리에 앉혀 놓고 설명한다고 생각하세요. 아래를 그대로 지킵니다.

1) 어미를 섞습니다. **"~예요 / ~해요 / ~거든요 / ~더라고요 / ~죠"** 를 기본으로 쓰고,
   사실을 못 박을 때만 "~습니다"를 씁니다. 한 단락이 전부 "~습니다"로 끝나면 다시 쓰세요.
   ("~합니다체"로만 쓴 글은 공지문이지 블로그 글이 아닙니다.)
2) **읽는 사람의 질문을 먼저 대신 말해 주고 답합니다.**
   예) "여기서 제일 많이 묻는 게 이거예요. 작은 가게도 되나요?"
3) **설명 앞에 한 박자 붙여 줍니다.** 바로 사실부터 던지지 않습니다.
   예) "이 부분이 좀 헷갈리는데요," / "정리하면 이렇습니다." / "여기서 하나만 짚고 갈게요."
4) 어려운 말을 쓰면 **바로 옆에서 풀어 줍니다.**
   예) "비대면 시상이라고 하는데요, 쉽게 말해 안 가도 된다는 뜻이에요."
5) 숫자는 **의미까지** 붙입니다. "139개 기업" 만 쓰지 말고 "작년에만 139개니까 드문 일은 아니에요" 처럼요.
6) 한 문장에 한 가지만 담습니다. '그리고', '또한'으로 두 가지를 이어 붙이지 않습니다.
7) 사람이 실제로 하는 말을 큰따옴표로 한두 번 옮기면 글이 살아납니다.
8) **쓰지 않는 말:** "귀사", "바야흐로", "~의 시대", "주목받고 있습니다", "다양한", "각광",
   "많은 관심", "믿을 수 있는 파트너", "본 상은", "당사", "~하시기 바랍니다".
   하나라도 보이면 그 문장을 다시 씁니다.
9) 과하게 굽신거리지 않습니다. 친절한 것이지 영업하는 것이 아닙니다.
   느낌표를 남발하지 않고, 이모지도 꼭 필요할 때만 씁니다.
10) 제공된 참고 재료의 문장을 **그대로 옮겨 붙이지 않습니다.** 사실만 가져와 새로 씁니다.
    (숫자·날짜·고유명사는 바꾸지 말고 그대로 씁니다.)

출력은 본문만. 설명·머리말·코드블록·따옴표 감싸기 없이 글 자체만 출력합니다.`;

function channelRules(channelId, p, size = 6, core = null) {
  /**
   * ⚠️ **한계·마무리 단락의 소제목을 여기에 하드코딩하지 말 것.**
   *    예전에는 "## 그래도 망설여진다면", "## 정리하면" 이 프롬프트에 박혀 있어서
   *    모든 글이 똑같은 문구로 끝났다 — 요청자 지적 그대로다("AI면 다양해야지").
   *    이제 뼈대(`lib/outline.js`)가 주제마다 새로 지어 준다.
   */
  const objectionHead = core?.objectionHead || '그래도 망설여진다면';
  const closingHead = core?.closingHead || '정리하면';

  /** 장수별 분량·소제목 수. 규칙 기반(`copywriter.js`)과 **같은 표**를 본다. */
  const plan = blogPlanFor(size);

  if (channelId === 'blog') {
    const events = (p.events || []).filter((e) => e.status === 'open');
    return `[블로그 글] — 네이버 블로그 레퍼런스 4편을 분석해 확정한 형식입니다. 형식을 바꾸지 마세요.

목적: **그 주제를 검색해서 들어온 사람**에게 정확한 정보를 지루하지 않게 전달합니다.

■ 문체
- 위 「말투」 절을 그대로 지킵니다. **친절하게 설명해 주는 블로그 말투**입니다.
- 큰따옴표로 말을 옮기는 건 권장합니다. 예) "대기업만 되는 거 아니에요?"
- 딱딱한 공지 톤을 피합니다. 궁금해할 지점을 짚고 답하는 식으로 풀어 씁니다.

■ 화면에 보이는 모양 (반드시 지킵니다)
- **한 문장을 쓰고 줄을 바꿉니다.** 줄당 27자 안팎이 되게 짧게 끊습니다.
- ⚠️ 다만 **문장마다 빈 줄을 넣지는 않습니다.** 이어지는 문장 2~3개를 한 덩어리로 묶고,
  덩어리와 덩어리 사이에만 빈 줄을 둡니다. 전부 떼어 놓으면 문장이 따로 떠서 안 읽힙니다.
  예)  IPTV 3사 기반 채널로 나가요.
       지역을 골라서 송출할 수도 있고요.
       (빈 줄)
       다만 전국 송출이랑은 조건이 다릅니다.
- ⚠️ **쉼표에서 줄을 바꾸는 건 "짧고 고른 항목이 3개 이상 나열될 때"만 합니다.**
  좋은 예 — 항목이 다 짧아서 나눠 놓으면 표처럼 읽힙니다.
       고객만족도 30%,
       브랜드 신뢰도 25%,
       품질 20%로 심사해요.
  나쁜 예 — 길이가 들쭉날쭉해서 나누면 오히려 안 읽힙니다. **이런 건 한 줄로 붙여 쓰세요.**
       상장과 상패,
       인증서에 더해 네이버 플레이스 배너,
       X배너가 나옵니다.
  → 이 경우는 "상장과 상패, 인증서, 네이버 플레이스 배너, X배너, 메탈 현판이 나와요."
    처럼 한 줄로 쓰거나, 항목만 짧게 끊어 고르게 맞춥니다.

■ 내용
- 각도와 관련 없는 특전·일정·패키지는 넣지 않습니다. 필요한 것만 골라 씁니다.
- 소제목은 **질문형과 서술형을 섞습니다.** 전부 질문으로 만들지 마세요.
  (레퍼런스 예: "넷플릭스 공개시간은 몇 시?" / "원작 웹툰 팬들이 기대하는 이유")

■ 반드시 들어가야 하는 것 (순서는 이대로)
1) 제목을 **두 줄로** 씁니다. 윗줄은 검색어(주제 키워드가 앞), 아랫줄은 후킹 문구.
2) 도입 — 이걸 지금 알아야 하는 이유부터. **인사말·자기소개로 시작하지 않습니다.**
3) "${HEAD_MARK} 소제목" 문단 **${plan.points}개**. 위 「이번 게시물의 핵심」을 **순서대로 하나씩** 다룹니다.
   상품 전반을 소개하는 문단을 끼워 넣지 마세요. 한 문단이라도 각도에서 벗어나면 실패입니다.
   ⚠️ **한 문단은 3~5줄입니다.** 한 문단에서 한 가지만 말하고 넘어갑니다.
   배경 설명·부연·같은 말 바꿔 쓰기로 늘리지 마세요. 길게 쓰면 안 읽힙니다.
4) "${HEAD_MARK} ${objectionHead}" 문단 — 한계를 솔직히 씁니다. **소제목을 이 문구 그대로 쓰세요.**
5) "${HEAD_MARK} ${closingHead}" 문단 — 허용된 마무리 문장을 원문 그대로 한 줄 쓰고, 접수·확인 안내를 덧붙입니다.
   **소제목을 이 문구 그대로 쓰세요.**
6) **목차는 넣지 않습니다.**

■ 여기서부터는 자유입니다 — 글에 맞게 판단해서 쓰세요
아래는 써도 되고 안 써도 됩니다. **매번 똑같이 넣지 마세요.** 이 글에 도움이 될 때만 씁니다.
- 제목 아래 구분선(───), 인용부호(> )로 뽑는 핵심 요약
- 끝부분 개요표 — 쓴다면 아래 사실만 씁니다. 형식과 줄 수는 알아서 정하세요.
  상품 ${p.name} / 접수 ${p.intake}${events.length ? ` / 일정 ${events.map((e) => `${e.date} ${e.name}`).join(' / ')}` : ''} / 문의 ${p.handle}${p.site ? ` / 사이트 ${p.site}` : ''}
  ⚠️ 짧은 글에는 넣지 마세요. 본문보다 표가 눈에 띄면 역효과입니다.
- 해시태그 — 쓴다면 **아래 목록에서 3~5개만** 고릅니다. 순서도 매번 같지 않게 합니다.
  ${p.hashtags.map((h) => `#${h}`).join(' ')}
  ⚠️ 목록에 없는 태그를 지어내지 마세요.

■ 좋은 글의 기준 (이게 목적입니다)
- 읽는 사람이 **끝까지 읽고 나서 하나라도 새로 알게 되면** 성공입니다.
- 아는 사람이 옆에서 정리해 주듯 씁니다. 홍보문·보도자료 톤이 아닙니다.
- **구체적인 것 하나가 일반론 열 줄보다 낫습니다.** 숫자·조건·절차처럼 손에 잡히는 것을 씁니다.
- 같은 말을 표현만 바꿔 반복하지 않습니다. 한 번 말했으면 다음으로 갑니다.
- 문단마다 형태가 똑같으면 지루합니다. 짧은 문단과 조금 긴 문단을 섞습니다.

■ 이미지와 캡션 (반드시 지킵니다)
이번 게시물의 카드뉴스는 **${size}장**입니다. 아래 ${size}줄을 **글자 하나 바꾸지 말고 그대로** 넣습니다.
각 줄은 그 카드가 대응하는 단락 바로 뒤에 둡니다(표지는 도입 뒤, 본문은 해당 소제목 뒤,
반론은 「그래도 망설여진다면」 뒤, 마무리는 「정리하면」 뒤).

${Array.from({ length: size }, (_, i) => imageSlotLine(i + 1, size)).join('\n')}

그리고 **📷 줄 바로 아래에 "${CAPTION_MARK} " 로 시작하는 캡션 한 줄**을 직접 씁니다.
캡션은 그 이미지가 무슨 장면인지 한 줄로 설명합니다. 20~45자.
이 캡션이 곧 인스타그램 카드뉴스에 얹힐 문구가 됩니다.

⚠️ 카드가 ${size}장뿐이어도 **기승전결은 갖춥니다** — 소제목 ${plan.points}개·반론·정리를 빼지 마세요.
다만 **분량은 장수에 맞춰 줄입니다.** 카드가 적으면 글도 짧아야 합니다.

분량은 공백 포함 **${plan.min.toLocaleString()}~${plan.max.toLocaleString()}자**. 넘기지 마세요.
짧게 쓰는 것이 목표입니다 — 채우려고 늘리지 말고, 할 말이 끝나면 끝냅니다.`;
  }

  if (channelId === 'instagram') {
    return `[인스타그램 캡션]
목적: 첫 두 줄에서 붙잡고, 끝까지 읽히게 합니다.

- 위 「말투」 절을 그대로 지킵니다. **"~예요 / ~거든요"** 를 기본으로 씁니다.
- **각도 하나만 다룹니다.** 상품 전체를 소개하지 않습니다.
- 첫 1~2줄이 전부입니다. '더보기' 앞에서 잘리는 자리라 여기서 못 끌면 나머지는 안 읽힙니다.
  설명으로 시작하지 마세요. **읽는 사람 입장의 한 문장**으로 엽니다.
  좋은 예) "이거 우리 같은 데는 안 되는 줄 알았거든요."
  나쁜 예) "KCST 대한민국 고객만족도 신뢰도 대상을 소개합니다."
- 한 줄이 모바일에서 두 줄로 넘어가지 않게 짧게 끊습니다.
- 문단을 빈 줄로 나눕니다. 한 문단은 2~3줄까지.
- 핵심 항목을 묶어 보여 줍니다. ① ② ③ 기호를 써도 되고, 짧은 소제목이나 줄바꿈만으로
  나눠도 됩니다. **매번 같은 형태로 쓰지 마세요** — 글에 맞는 방식을 고릅니다.
- 질문(?)과 설명이 번갈아 나오면 리듬이 생깁니다. 전부 '~습니다'로 끝나면 읽히지 않습니다.
- 한계를 짚는 문단을 하나 넣습니다. 이게 있어야 광고로 안 읽힙니다.
- 이모지는 문단 앞에만, 글 전체에서 3개 이내. 문장 안에 흩뿌리지 않습니다.
- **저장을 유도하는 한 줄은 반드시 넣습니다.** 문구는 매번 다르게 씁니다.
  그 뒤에 계정(${p.handle}), 마지막에 점 세 개(.) 후 해시태그.
- 해시태그는 아래 목록에서 **3~5개만** 고릅니다. 순서도 매번 같지 않게 합니다.
  ${p.hashtags.map((h) => `#${h}`).join(' ')}
  ⚠️ 목록에 없는 태그를 지어내지 마세요.

■ 좋은 캡션의 기준
- 첫 줄만 읽고 스크롤을 멈추게 하는 게 전부입니다. 나머지는 그다음 문제입니다.
- 구체적인 것 하나가 일반론보다 낫습니다. 숫자·조건·절차를 씁니다.
- 같은 말을 표현만 바꿔 반복하지 않습니다.

분량은 공백 포함 1,300자 이내.`;
  }

  return `[쓰레드 글]
목적: 광고가 아니라 '알게 된 걸 흘리는' 글입니다.

- **한 가지만** 이야기합니다. 여러 정보를 나열하면 톤이 무너집니다.
- **첫 줄에서 왜 읽어야 하는지**를 만듭니다. 찾아봤는데 정리된 데가 없더라,
  잘못 알고 있었다 같은 화자의 경험으로 엽니다.
- 여기는 셋 중 가장 구어체입니다. '~더라고요', '~거든요', '~대요' 를 씁니다.
  '~습니다'로 끝나는 문장이 연달아 세 개 나오면 그건 공지문입니다. 다시 쓰세요.
- 목록·불릿·소제목·이모지를 쓰지 않습니다. 짧은 문단 3~4개뿐입니다.
- 한계를 한발 물러서서 인정하는 문단을 넣습니다. ("물론 ~는 아니고요" 같은 식으로)
- **마지막은 질문으로 끝냅니다.** 질문 문구는 매번 다르게 씁니다.
- 해시태그·계정명·신청 유도 문구를 절대 넣지 않습니다. 하나라도 넣으면 톤이 무너집니다.

■ 좋은 쓰레드의 기준
- 읽고 나서 "아 그렇구나" 하나가 남으면 성공입니다. 여러 개를 담으려다 아무것도 안 남습니다.
- 정보를 나열하지 말고 **하나를 골라 이야기하듯** 풉니다.
- 광고처럼 보이는 순간 끝입니다. 팔려고 하지 말고 알려주기만 합니다.

분량은 공백 포함 500자 이내. 반드시 지킵니다.`;
}

/**
 * 세 채널이 **같은 내용**을 말하게 하는 블록.
 *
 * 요청자 요구: 블로그·인스타·쓰레드의 내용이 같아야 한다.
 * 규칙 기반은 buildCore() 하나를 세 생성기가 나눠 쓰면 그만이지만, LLM 은 채널마다 따로 부르므로
 * **코어가 고른 항목을 프롬프트에 박아** 넣어야 한다. 안 그러면 채널마다 다른 사실을 골라 쓴다.
 */
function coreBlock(ctx) {
  /**
   * `ctx.core` 는 AI가 주제로 짠 뼈대(`lib/outline.js`)여야 한다.
   */
  const core = ctx.core;
  if (!core?.fromAI) throw new Error('AI로 생성한 주제 구성이 없습니다.');
  return [
    // 해석을 맨 앞에 세운다. 없으면 모델이 주제 원문을 글자 그대로 되풀이한다.
    core.angle ? `■ 주제를 이렇게 읽었습니다 (이 각도로 씁니다)\n『${core.angle}』${core.intent ? `\n담당자가 알고 싶은 것: ${core.intent}` : ''}\n` : '',
    `■ 이번 게시물에서 다룰 ${core.points.length}가지 (세 채널이 공통으로 다룹니다)`,
    ...core.points.map((x, i) => `${i + 1}. ${x.q}\n   → ${x.a}`),
    '',
    `한계·반론으로 다룰 것: ${core.objection}`,
    `마무리 문장: ${core.closing}`,
    '',
    /**
     * ⚠️ 예전에는 여기에 "풀어서 **자세히** 쓰세요 / 왜·어떻게·조심할 점까지 짚어 줍니다" 가 있었다.
     *    그게 장황함의 직접 원인이었다 — 모델은 시키는 대로 문단마다 배경 설명을 붙였다.
     *    요청자 지적(2026-08-13): "한 가지 섹션에 대한 내용이 너무 많아. 글이 너무 많으니깐 잘 안 읽혀."
     *    이제는 **핵심만, 짧게** 를 지시한다. 늘리라는 말을 다시 넣지 말 것.
     */
    '**위 항목은 목차입니다. 한 줄 설명을 그대로 옮겨 붙이지는 마세요.**',
    '다만 **핵심만 짧게** 씁니다. 한 항목당 3~5줄이면 충분합니다.',
    '배경 설명·부연·같은 말 바꿔 쓰기로 분량을 늘리지 마세요. 할 말이 끝나면 다음으로 넘어갑니다.',
    '',
    '다른 항목을 새로 만들거나 순서를 바꾸지는 마세요 — 카드뉴스 2·3·4번과 1:1로 맞물립니다.',
    '같은 게시물을 블로그·인스타그램·쓰레드로 나눠 내보냅니다.',
    '다루는 항목은 같고 **형식과 말투만** 채널에 맞게 달라집니다.',
  ].join('\n');
}

function buildPrompt(ctx, channelId, retryNote) {
  const { product, topic, tone } = ctx;
  const angle = ctx.core?.angle || '';
  const round = Math.max(0, Number(ctx.round) || 0);

  // 주제를 맨 앞·맨 뒤 양쪽에 둔다. 자료를 먼저 주면 모델이 자료 요약으로 흘러간다.
  return [
    `■ 담당자가 적어 준 주제 (원문 — 글자 그대로 따르지 마세요)`,
    `『${topic}』`,
    '',
    `급하게 적은 메모입니다. 표현이 어설프거나 자료에 없는 단어가 섞여 있을 수 있습니다.`,
    `**무엇을 알고 싶어서 이렇게 적었는지**에 답하세요. 원문 표현을 억지로 되풀이하지 않습니다.`,
    `단, 자료에 없는 사실을 주제에 적혀 있다는 이유로 사실처럼 쓰지는 않습니다.`,
    '',
    coreBlock(ctx),
    '',
    `■ 톤\n${TONE_GUIDE[tone] || TONE_GUIDE.trust}`,
    round && ROUND_OPENING[round % ROUND_OPENING.length] ? `\n■ 이번은 ${round + 1}번째 글입니다\n${ROUND_OPENING[round % ROUND_OPENING.length]}\n앞서 쓴 글과 첫 단락이 비슷하면 실패입니다.` : '',
    '',
    `── 상품 자료 (재료) ──`,
    factSheet(product),
    '── 자료 끝 ──',
    '',
    channelRules(channelId, product, clampDeckSize(ctx.cardCount), ctx.core),
    '',
    `절대 쓰면 안 되는 표현: ${BANNED_PHRASES.join(', ')}`,
    `마크다운 금지: ** 굵게, ## 소제목, - 불릿을 쓰지 않습니다. 소제목은 "${HEAD_MARK} 소제목" 한 줄입니다.`,
    '',
    angle
      ? `다시 확인합니다. 이 글이 답할 것은 『${angle}』입니다. 이 각도를 정면으로 다루세요.`
      : `다시 확인합니다. 이 글의 주제는 『${topic}』입니다. 담당자의 의도를 정면으로 다루세요.`,
    retryNote ? `\n[다시 씁니다] 직전 결과에 문제가 있었습니다: ${retryNote}\n이 부분을 고쳐서 처음부터 다시 써 주세요.` : '',
  ].filter(Boolean).join('\n');
}

/**
 * 주제를 실제로 다뤘는지 본다.
 *
 * 프롬프트만으로는 모델이 주제를 흘려보내고 상품 소개로 빠지는 일이 있었다.
 * 주제에서 뽑은 낱말이 글에 충분히 나오는지로 대략 확인한다.
 */
function topicTokens(topic) {
  return String(topic)
    .split(/[^가-힣a-zA-Z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    // 조사가 붙어 형태가 달라지므로 앞 2글자만 본다
    .map((w) => w.slice(0, 2));
}

/**
 * @param {string} text
 * @param {string} topic 담당자가 적은 원문
 * @param {string} [angle] 뼈대가 잡은 해석. 있으면 **이쪽 낱말도 인정한다.**
 *
 * ⚠️ 원문 낱말만 세면 유연한 해석이 전부 반려된다. 주제가 "ai영상 무료로 받는 법"인데
 *    글이 "제작 지원이 어디까지 커버하나"로 답하면 '무료'가 안 나온다 — 그게 맞는 글인데
 *    낱말이 없다고 막았다. 해석을 함께 두면 진짜로 샌 글만 걸린다.
 */
function offTopic(text, topic, angle) {
  const tokens = [...new Set(topicTokens(topic))];
  if (tokens.length < 2) return null;          // 주제가 너무 짧으면 판단하지 않는다
  const scope = angle ? `${text} ${angle}` : text;
  const hit = tokens.filter((t) => scope.includes(t));
  // 기준을 0.5 → 0.35 로 낮췄다. 주제를 잘 풀어 쓴 글이 낱말이 덜 겹친다는 이유로 반려되곤 했다.
  if (hit.length / tokens.length < 0.35) {
    return `주제 『${topic}』가 글에 거의 반영되지 않았습니다. 담당자의 의도를 중심으로 다시 써 주세요.`;
  }
  return null;
}

/** 모델이 코드블록이나 따옴표로 감싸는 경우가 있어 벗겨낸다 */
function clean(text) {
  let s = String(text).trim();
  s = s.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
  return s.trim();
}

/* ============================================================
   자동 보정 — 형식 문제는 반려하지 않고 고쳐서 쓴다
   ============================================================ */

/**
 * 요청자 지시(2026-08-03): **게이트를 느슨하게 풀어 통과율을 올린다.**
 *
 * 예전에는 형식이 틀리면 통째로 반려하고 다시 시켰다. 이미지 자리 한 줄이 빠졌다고
 * 멀쩡한 글 2,000자를 버리는 건 낭비였고, 재시도해도 같은 이유로 또 막히는 일이 잦았다.
 *
 * 지금은 **고칠 수 있는 건 고친다.** 반려는 사실성 위반에만 쓴다.
 *   고침  — 목차 · 이미지 자리 · 캡션 · 길이 초과 · 쓰레드 해시태그
 *   반려  — 금지 표현 · 근거 없는 단정 · 주제 이탈 · 너무 짧음
 *
 * ⚠️ 여기서 사실 관계를 손대면 안 된다. 형식만 만진다.
 *
 * @returns {string} 보정된 글
 */
export function repairDraft(text, channelId, ctx) {
  // ⚠️ 마크다운을 **가장 먼저** 걷어낸다. repairBlog() 가 줄 앞 기호를 보고 자리를 잡으므로
  //    `## 소제목` 이 남아 있으면 이미지 자리를 첫 소제목 앞에 박아 넣는다.
  let out = stripMarkdown(String(text));
  if (channelId === 'blog') out = repairBlog(out, ctx);
  if (channelId === 'threads') out = out.replace(/#[^\s#]+/g, '').replace(/[ \t]+$/gm, '');

  const ch = CHANNELS.find((c) => c.id === channelId);
  if (ch) out = clampBlocks(out, ch.limit);
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 마크다운을 걷어낸다 — **붙여넣을 곳 어디에도 렌더링되지 않기 때문이다.**
 *
 * 네이버 블로그·인스타그램·쓰레드는 전부 순수 텍스트다. `**강조**` 는 별표 네 개가 그대로 찍히고
 * `## 소제목` 은 샵이 남는다. 요청자 지적("굵은 글씨가 ** 이렇게 표현되어 있다") 그대로다.
 *
 * ⚠️ 지우는 게 아니라 **읽을 수 있는 표시로 바꾼다.** 그냥 지우면 소제목이 본문에 섞인다.
 * ⚠️ 두 번 돌려도 결과가 같아야 한다(idempotent). `${HEAD_MARK} 소제목` 은 다시 안 건드린다.
 */
export function stripMarkdown(text) {
  return String(text)
    .split('\n')
    .map((line) => {
      let s = line;
      // 소제목: ## / ### → ■  (해시태그 줄 `#브랜드어워즈` 는 샵 뒤에 공백이 없어 걸리지 않는다)
      s = s.replace(/^\s{0,3}#{1,6}\s+(.*)$/, `${HEAD_MARK} $1`);
      // 불릿: -, *, • → ·  (인용구 '> ' 는 확정된 형식이라 그대로 둔다)
      s = s.replace(/^(\s*)[-*•]\s+/, '$1· ');
      // 굵게·기울임 — 기호만 벗기고 글자는 남긴다
      s = s.replace(/\*\*\*(.+?)\*\*\*/g, '$1')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/(^|[\s(])\*([^\s*][^*]*?)\*(?=[\s).,!?]|$)/g, '$1$2');
      // 인라인 코드 백틱
      s = s.replace(/`([^`]+)`/g, '$1');
      return s.replace(/[ \t]+$/, '');
    })
    .join('\n');
}

/** 글자 수를 넘으면 문단 단위로 덜어낸다. 문장을 중간에서 자르지 않는다. */
function clampBlocks(text, limit) {
  if (text.length <= limit) return text;
  const blocks = text.split('\n\n');
  while (blocks.length > 2 && blocks.join('\n\n').length > limit) blocks.splice(blocks.length - 2, 1);
  const out = blocks.join('\n\n');
  return out.length <= limit ? out : `${out.slice(0, limit - 1).trimEnd()}…`;
}

const SLOT_RE = /^\s*📷\s*\[이미지\s*(\d)\s*·/;

/**
 * 블로그 형식을 맞춘다.
 *
 * 이미지 자리가 빠졌으면 **글 끝에 순서대로 채워 넣는다.** 본문 사이에 끼워 넣는 게 더 좋지만,
 * AI 가 쓴 글의 문단 경계를 기계가 정확히 알 수 없어 엉뚱한 자리에 박히면 더 나쁘다.
 * 끝에 모아 두는 배치는 서대문구 레퍼런스가 카드뉴스를 글 끝에 통째로 붙인 방식과 같다.
 */
function repairBlog(text, ctx) {
  const size = clampDeckSize(ctx.cardCount);
  const labels = roleLabels(size);
  const deck = buildDeck(ctx);
  const caption = (n) => captionOf(deck[n - 1]);

  // 1) 목차 — 레퍼런스에 없는 형식이라 통째로 걷어낸다
  let lines = text.split('\n').filter((l) => !/이런 순서로 정리|^\s*목차\s*$/.test(l));

  /**
   * 2) 이미지 자리마다 캡션 한 줄을 보장하고, **떠 있는 캡션은 버린다.**
   *    📷 줄 없이 ⤷ 만 남으면 캡션 수가 이미지 수와 어긋난다 — 인스타 카드와 1:1로 못 맞춘다.
   */
  const withCaptions = [];
  lines.forEach((line, i) => {
    const m = line.match(SLOT_RE);
    if (!m) {
      const isCaption = line.trim().startsWith(CAPTION_MARK);
      const prevIsSlot = SLOT_RE.test(withCaptions[withCaptions.length - 1] || '');
      if (isCaption && !prevIsSlot) return;   // 짝 없는 캡션은 버린다
      withCaptions.push(line);
      return;
    }
    withCaptions.push(line);
    const next = (lines[i + 1] || '').trim();
    if (!next.startsWith(CAPTION_MARK)) withCaptions.push(`${CAPTION_MARK} ${caption(Number(m[1]))}`);
  });
  lines = withCaptions;

  // 3) 장수를 넘는 자리는 버리고, 빠진 자리는 끝에 채운다 (해시태그·개요표 앞)
  lines = lines.filter((l, i) => {
    const m = l.match(SLOT_RE);
    if (m && Number(m[1]) > size) { lines[i + 1] = (lines[i + 1] || '').trim().startsWith(CAPTION_MARK) ? '' : lines[i + 1]; return false; }
    return true;
  }).filter((l, i, a) => !(l === '' && a[i - 1] === ''));
  const have = new Set(lines.map((l) => l.match(SLOT_RE)?.[1]).filter(Boolean).map(Number));
  const missing = Array.from({ length: size }, (_, i) => i + 1).filter((n) => !have.has(n));
  if (missing.length) {
    let tail = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^\s*(#\S|🔔)/.test(lines[i])) tail = i;
    }
    const block = missing.flatMap((n) => ['', imageSlotLine(n, size), `${CAPTION_MARK} ${caption(n)}`]);
    lines.splice(tail, 0, ...block);
  }

  return lines.join('\n');
}

/**
 * 검증 — 통과하지 못하면 이유를 문자열로 돌려준다 (통과하면 null)
 *
 * ⚠️ 여기 남은 것은 **고칠 수 없는 문제**뿐이다. 형식 문제는 repairDraft() 가 처리한다.
 *    형식 검사를 여기에 다시 추가하지 말 것 — 통과율만 떨어지고 글은 나아지지 않는다.
 *
 * API 호출 없이 시험할 수 있도록 내보낸다.
 */
export function validateDraft(text, channelId, product, topic, angle) {
  if (topic) {
    const off = offTopic(text, topic, angle);
    if (off) return off;
  }
  const banned = findBanned(text, BANNED_PHRASES);
  if (banned.length) return `금지 표현이 들어 있습니다: ${banned.join(', ')}`;

  const risky = findRisky(text, product);
  if (risky.length) return `근거 없는 단정 표현이 있습니다: ${risky.join(', ')}. 사실만 담담하게 써 주세요.`;

  if (text.length < 120) return '글이 너무 짧습니다.';

  /**
   * 길이 초과·이미지 자리·캡션·목차·줄 리듬·쓰레드 해시태그는 **여기서 보지 않는다.**
   * repairDraft() 가 전부 고친다. 요청자 지시대로 게이트를 사실성 위반으로만 좁혔다.
   */
  return null;
}

/**
 * 채널별 프롬프트 지문 — 이 값이 그대로면 다시 불러도 같은 글이 나온다.
 *
 * ⚠️ **채널마다 프롬프트에 실제로 들어가는 입력이 다르다.**
 *    카드 장수는 블로그의 이미지 자리 줄 수만 바꾼다. 인스타·쓰레드 프롬프트에는
 *    한 글자도 들어가지 않는다(실측 확인: 장수 6↔3 에서 두 채널 프롬프트가 완전히 동일).
 *    그런데 `draftKeyOf()` 한 덩어리로 판단하면 장수만 바꿔도 세 채널을 다 다시 생성해
 *    **호출 2번이 그냥 버려진다.** 그래서 채널별로 따로 본다.
 *
 * 이 함수는 `buildPrompt()` 옆에 둔다. 프롬프트에 무엇이 들어가는지 아는 곳이 여기뿐이라,
 * 프롬프트를 고치면 이 함수도 같이 고쳐야 한다는 게 눈에 보여야 한다.
 */
export function promptKeyOf(channelId, s) {
  // ⚠️ 라운드(AI 1·AI 2)가 빠지면 두 벌이 같은 지문을 갖는다 — 어느 벌로 썼는지 구분되지 않는다.
  const base = `${s.productId}|${String(s.topic || '').trim()}|${s.tone}|r${s.aiRuns?.list?.length || 0}`;
  return channelId === 'blog' ? `${base}|${clampDeckSize(s.cardCount)}` : base;
}

/**
 * 채널별 출력 토큰 상한.
 *
 * 출력 단가가 입력의 6배라 **상한이 곧 비용 상한이다.** 안 걸면 모델이 길게 쓰는 만큼 그대로 낸다.
 * 쓰레드는 500자 글인데 상한이 없으면 블로그만큼 뽑아도 막을 방법이 없다.
 *
 * 채널 상한(`CHANNELS[].limit`)은 **글자 수**다. 한글 1자를 넉넉히 1토큰으로 보고,
 * 형식 토큰과 추론 토큰이 함께 이 예산에서 나가므로 여유분을 더한다.
 * ⚠️ 너무 빡빡하게 잡으면 글이 잘려 검수에 걸리고, 재시도로 오히려 더 든다.
 */
const TOKEN_HEADROOM = 1500;

function maxTokensFor(channelId) {
  const limit = CHANNELS.find((c) => c.id === channelId)?.limit;
  return (limit || 3000) + TOKEN_HEADROOM;
}

/**
 * 채널 글귀 하나를 LLM 으로 만든다.
 *
 * @param {'blog'|'instagram'|'threads'} channelId
 * @param {{product:object, topic:string, tone:string}} ctx
 * @param {{signal?:AbortSignal, onAttempt?:(info:object)=>void, waitIfPaused?:()=>Promise<void>}} [opts]
 *   `onAttempt` 는 시도마다 결과를 알려준다 — 모델 비교(tools/bench.html)가 쓴다.
 *   ⚠️ 관측 전용이다. **여기서 생성 흐름을 바꾸지 말 것.** 벤치마크가 실제 경로와
 *   달라지는 순간 측정값이 의미를 잃는다.
 *   `waitIfPaused` 는 다음 시도 직전에 부른다 — **이미 나간 요청을 멈추지는 못한다.**
 *   (fetch 는 중간에 세웠다 이어받을 수 없다.) 일시정지 중이면 재시도만 멈춰 둔다.
 * @returns {Promise<string>} 검증을 통과한 글
 */
export async function generateWithAI(channelId, ctx, opts = {}) {
  let note = '';

  // 세 번까지 시도한다. 반려 사유가 사실성 위반뿐이라, 온도를 낮춰 다시 시키면 대개 붙는다.
  for (let attempt = 0; attempt < 3; attempt++) {
    await opts.waitIfPaused?.();
    if (opts.signal?.aborted) throw new DOMException('취소되었습니다.', 'AbortError');

    const prompt = buildPrompt(ctx, channelId, note);
    const startedAt = Date.now();
    let usage = null;

    const raw = await generateText(prompt, {
      system: SYSTEM,
      temperature: attempt === 0 ? 0.9 : 0.5,   // 두 번째부터는 지시를 더 곧이곧대로 따르게
      maxOutputTokens: maxTokensFor(channelId),
      signal: opts.signal,
      onUsage: (u) => { usage = u; },
    });

    // 형식은 고쳐서 쓴다. 검증은 고칠 수 없는 것만 본다.
    const text = repairDraft(clean(raw), channelId, ctx);
    const problem = validateDraft(text, channelId, ctx.product, ctx.topic, ctx.core?.angle);

    opts.onAttempt?.({
      channelId,
      attempt,                       // 0부터
      problem,                       // 통과하면 null
      usage,                         // 제공자가 준 실제 토큰 사용량 (없으면 null)
      ms: Date.now() - startedAt,
      promptChars: prompt.length + SYSTEM.length,
      outputChars: text.length,
    });

    if (!problem) return text;
    note = problem;
  }

  throw new Error(`AI 글이 검수를 통과하지 못했습니다 — ${note}`);
}
