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
import { findBanned, buildCore } from './copywriter.js';
import { BANNED_PHRASES, CHANNELS } from '../data/products.js';

const TONE_GUIDE = {
  trust: '사실 중심으로 차분하게. 과장하지 않는다.',
  hook: '첫 줄에서 시선을 잡는다. 질문이나 의외의 숫자로 연다.',
  plain: '군더더기 없이 핵심만. 짧은 문장을 쓴다.',
  celebrate: '소식을 알리는 톤. 다만 들뜨지 않는다.',
};

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

/** 블로그에 반드시 들어가야 하는 이미지 자리 (카드뉴스 6장과 1:1 대응) */
const CARD_ROLE = ['표지', '본문', '본문', '본문', '반론', '마무리'];
export const imageSlotLine = (n) => `📷 [이미지 ${n} · ${CARD_ROLE[n - 1]}] 카드뉴스 ${n}번을 여기에 넣으세요`;

/** 이미지 바로 아래 캡션 한 줄 — 레퍼런스 3편 모두 본문 이미지에 설명이 붙어 있다 */
const CAPTION_MARK = '⤷';

/** 존댓말이 허용되는 유일한 구간의 시작점. 문체 검사는 여기까지만 본다. */
const CLOSING_HEAD = '## 정리하면';

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

const SYSTEM = `당신은 한국 중소기업 브랜드 마케팅 콘텐츠를 쓰는 카피라이터입니다.

■ 가장 중요한 것: **주제가 글의 중심입니다.**
사용자가 준 주제 하나를 파고드는 글을 씁니다. 상품 자료는 그 주제를 뒷받침하는 **재료**일 뿐입니다.
자료를 처음부터 끝까지 요약하는 것은 실패입니다. 주제와 상관없는 사실은 **넣지 않습니다.**
같은 상품이라도 주제가 다르면 완전히 다른 글이 나와야 합니다.

■ 후킹: 첫 문단에서 읽는 사람이 이 주제를 왜 지금 알아야 하는지를 만듭니다.
막연한 인사말로 시작하지 않습니다. 주제와 직결된 궁금증·오해·놓치기 쉬운 지점부터 칩니다.

절대 규칙 (하나라도 어기면 그 글은 폐기됩니다):
1. 제공된 '상품 사실' 안에 있는 내용만 씁니다. 없는 수치·일정·혜택을 지어내지 않습니다.
2. 매출 상승이나 광고 성과를 보장하거나 암시하지 않습니다.
3. 공식 근거 없이 최고·유일·1위·최고 권위 같은 단정 표현을 쓰지 않습니다.
4. 마무리 문장은 '허용된 마무리 문장' 목록에서 고르거나 그 뜻을 벗어나지 않게 씁니다.
5. 기본 특전과 추가 패키지를 섞지 않고 구분해서 씁니다.
6. 확정되지 않은 것은 '예정'이라고 씁니다.

문체:
- 한국어. 존댓말.
- **읽는 사람에게 옆에서 설명해 주는 말투로 씁니다.** 공지문이나 보도자료처럼 쓰지 않습니다.
  궁금해할 만한 지점을 먼저 짚고, 그다음에 답을 알려주는 순서로 풀어 씁니다.
- 같은 종결어미가 세 번 연속 나오지 않게 씁니다. 질문·명사형·짧은 문장을 섞습니다.
- 상투적인 홍보 문구를 쓰지 않습니다. 읽는 사람이 실제로 궁금해할 것부터 답합니다.
- 제공된 참고 재료의 문장을 **그대로 옮겨 붙이지 않습니다.** 사실만 가져와 새로 씁니다.
  (숫자·날짜·고유명사는 바꾸지 말고 그대로 씁니다.)

출력은 본문만. 설명·머리말·코드블록·따옴표 감싸기 없이 글 자체만 출력합니다.`;

function channelRules(channelId, p) {
  if (channelId === 'blog') {
    const events = (p.events || []).filter((e) => e.status === 'open');
    return `[블로그 글] — 네이버 블로그 레퍼런스 4편을 분석해 확정한 형식입니다. 형식을 바꾸지 마세요.

목적: **그 주제를 검색해서 들어온 사람**에게 정확한 정보를 지루하지 않게 전달합니다.

■ 문체
- **존댓말로, 읽는 사람에게 설명해 주듯이 씁니다.** 상품을 소개하는 글입니다.
- 큰따옴표로 말을 옮기는 건 권장합니다. 예) "대기업만 되는 거 아니에요?"
- 딱딱한 공지 톤을 피합니다. 궁금해할 지점을 짚고 답하는 식으로 풀어 씁니다.

■ 화면에 보이는 모양 (레퍼런스에서 가져온 부분입니다. 반드시 지킵니다)
- **한 문장을 쓰고 줄을 바꿉니다. 문장과 문장 사이에 빈 줄을 넣습니다.**
  문단을 덩어리로 붙이지 마세요. 레퍼런스는 줄당 평균 27자, 짧은 줄이 60~70%였습니다.
- 나열이 긴 문장은 쉼표에서 줄을 바꿉니다(이때는 빈 줄 없이).
  예)  패션,
       아트,
       캐릭터,
       라이프스타일까지.

■ 내용
- 주제와 관련 없는 특전·일정·패키지는 넣지 않습니다. 주제에 필요한 것만 골라 씁니다.
- 소제목은 **질문형과 서술형을 섞습니다.** 전부 질문으로 만들지 마세요.
  (레퍼런스 예: "넷플릭스 공개시간은 몇 시?" / "원작 웹툰 팬들이 기대하는 이유")

구조를 이 순서로 지킵니다. **목차는 넣지 않습니다.**
1) 제목을 **두 줄로** 씁니다. 윗줄은 검색어(주제 키워드가 앞), 아랫줄은 후킹 문구.
2) 구분선 한 줄:  ───
3) 핵심 요약 2~3문장. 각 줄을 "> " 로 시작합니다.
4) 도입 — 이 주제를 지금 알아야 하는 이유부터. 인사말로 시작하지 않습니다.
5) ${imageSlotLine(1)}
6) "## 소제목" 문단 **3개**. 위 「이번 게시물의 핵심」 3가지를 **순서대로 하나씩** 다룹니다.
   상품 전반을 소개하는 문단을 끼워 넣지 마세요. 한 문단이라도 주제에서 벗어나면 실패입니다.
   각 문단 끝에 아래 줄을 순서대로 그대로 넣습니다.
   ${imageSlotLine(2)}
   ${imageSlotLine(3)}
   ${imageSlotLine(4)}
7) "## 그래도 망설여진다면" 문단에서 한계를 솔직히 씁니다
8) ${imageSlotLine(5)}
9) "## 정리하면" 문단 — 허용된 마무리 문장을 원문 그대로 한 줄 쓰고, 접수·확인 안내를 덧붙입니다.
10) ${imageSlotLine(6)}
11) 개요표를 이 형식으로 씁니다. 한 줄에 하나씩.
   🔔 상품 · ${p.name}
   🔔 접수 · ${p.intake}${events.length ? `\n   🔔 일정 · ${events.map((e) => `${e.date} ${e.name}`).join(' / ')}` : ''}
   🔔 문의 · ${p.handle}${p.site ? `\n   🔔 사이트 · ${p.site}` : ''}
12) 해시태그 한 줄

■ 이미지와 캡션 (반드시 지킵니다)
📷 로 시작하는 여섯 줄은 **글자 하나 바꾸지 말고 그대로** 넣습니다.
그리고 **📷 줄 바로 아래에 "${CAPTION_MARK} " 로 시작하는 캡션 한 줄**을 직접 씁니다.
캡션은 그 이미지가 무슨 장면인지 한 줄로 설명합니다. 20~45자, '~다' 평서형.
캡션 여섯 줄이 곧 인스타그램 카드뉴스에 얹힐 문구가 됩니다.

분량은 공백 포함 1,800~2,400자.`;
  }

  if (channelId === 'instagram') {
    return `[인스타그램 캡션]
목적: 첫 두 줄에서 붙잡고, 끝까지 읽히게 합니다.

- **존댓말로 씁니다.** (블로그와 달리 평서형을 쓰지 않습니다.)
- **주제 하나만 다룹니다.** 상품 전체를 소개하지 않습니다.
- 첫 1~2줄이 전부입니다. 주제와 직결된 궁금증·오해를 찔러야 합니다. 여기서 못 끌면 나머지는 안 읽힙니다.
- 문단을 빈 줄로 나눕니다. 긴 문단을 만들지 않습니다.
- ① ② ③ 기호로 핵심 3가지를 묶고, 각 항목은 **질문 한 줄 + 답 한두 줄** 형태로 씁니다.
  질문(?)과 설명(습니다)이 번갈아 나와야 리듬이 생깁니다.
- 중간에 "여기까지가 기본." 같은 짧은 명사형 한 줄을 넣어 호흡을 끊습니다.
- 한계를 짚는 문단을 하나 넣습니다.
- 저장을 유도하는 한 줄, 계정(${p.handle}), 그리고 마지막에 점 세 개(.) 후 해시태그.
분량은 공백 포함 1,300자 이내.`;
  }

  return `[쓰레드 글]
목적: 광고가 아니라 '알게 된 걸 흘리는' 글입니다.

- **주제 한 가지만** 이야기합니다. 여러 정보를 나열하면 톤이 무너집니다.
- **첫 줄에서 왜 읽어야 하는지**를 만듭니다. 그 주제를 찾아봤는데 정리된 데가 없더라,
  잘못 알고 있었다 같은 화자의 경험으로 엽니다.
- 구어체. '~더라고요', '~대요' 같은 말투. 공지 톤 금지.
- 목록·불릿을 쓰지 않습니다. 짧은 문단 3~4개.
- 한계를 한발 물러서서 인정하는 문단을 넣습니다.
- **마지막은 질문으로 끝냅니다.**
- 해시태그·계정명·신청 유도 문구를 절대 넣지 않습니다. 하나라도 넣으면 톤이 무너집니다.
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
  const core = buildCore({ ...ctx, variant: ctx.variant ?? 0 });
  return [
    '■ 이번 게시물의 핵심 (세 채널이 공통으로 다룹니다 — 이 범위를 벗어나지 마세요)',
    ...core.points.map((x, i) => `${i + 1}. ${x.q}\n   → ${x.a}`),
    '',
    `한계·반론으로 다룰 것: ${core.objection}`,
    `마무리 문장: ${core.closing}`,
    '',
    '위 3가지가 카드뉴스 2·3·4번과 1:1로 대응합니다. **순서를 바꾸지 마세요.**',
    '같은 게시물을 블로그·인스타그램·쓰레드로 나눠 내보냅니다.',
    '다루는 항목은 같고 **형식과 말투만** 채널에 맞게 달라집니다.',
  ].join('\n');
}

function buildPrompt(ctx, channelId, retryNote) {
  const { product, topic, tone } = ctx;
  // 주제를 맨 앞·맨 뒤 양쪽에 둔다. 자료를 먼저 주면 모델이 자료 요약으로 흘러간다.
  return [
    `■ 이번 글의 주제 (이것 하나만 다룹니다)`,
    `『${topic}』`,
    '',
    `이 주제가 글의 중심입니다. 아래 자료는 주제를 뒷받침할 재료일 뿐이며,`,
    `주제와 상관없는 내용은 넣지 마세요. 자료 전체를 요약하면 실패입니다.`,
    '',
    coreBlock(ctx),
    '',
    `톤: ${TONE_GUIDE[tone] || TONE_GUIDE.trust}`,
    '',
    `── 상품 자료 (재료) ──`,
    factSheet(product),
    '── 자료 끝 ──',
    '',
    channelRules(channelId, product),
    '',
    `절대 쓰면 안 되는 표현: ${BANNED_PHRASES.join(', ')}`,
    '',
    `다시 확인합니다. 이 글의 주제는 『${topic}』입니다. 이 주제를 정면으로 다루세요.`,
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

function offTopic(text, topic) {
  const tokens = [...new Set(topicTokens(topic))];
  if (tokens.length < 2) return null;          // 주제가 너무 짧으면 판단하지 않는다
  const hit = tokens.filter((t) => text.includes(t));
  if (hit.length / tokens.length < 0.5) {
    return `주제 『${topic}』가 글에 거의 반영되지 않았습니다. 이 주제를 중심으로 다시 써 주세요.`;
  }
  return null;
}

/** 모델이 코드블록이나 따옴표로 감싸는 경우가 있어 벗겨낸다 */
function clean(text) {
  let s = String(text).trim();
  s = s.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
  return s.trim();
}

/**
 * 검증 — 통과하지 못하면 이유를 문자열로 돌려준다 (통과하면 null)
 *
 * 이 함수가 이 파일의 존재 이유다. 검증을 통과하지 못한 글은 화면에 나가지 않는다.
 * API 호출 없이 시험할 수 있도록 내보낸다.
 */
export function validateDraft(text, channelId, product, topic) {
  if (topic) {
    const off = offTopic(text, topic);
    if (off) return off;
  }
  const banned = findBanned(text, BANNED_PHRASES);
  if (banned.length) return `금지 표현이 들어 있습니다: ${banned.join(', ')}`;

  const risky = findRisky(text, product);
  if (risky.length) return `근거 없는 단정 표현이 있습니다: ${risky.join(', ')}. 사실만 담담하게 써 주세요.`;

  const ch = CHANNELS.find((c) => c.id === channelId);
  if (ch && text.length > ch.limit) return `${ch.name} 권장 길이 ${ch.limit}자를 넘었습니다 (${text.length}자). 더 줄여 주세요.`;
  if (text.length < 120) return '글이 너무 짧습니다.';

  if (channelId === 'blog') {
    const missing = [1, 2, 3, 4, 5, 6].filter((n) => !text.includes(`[이미지 ${n} ·`));
    if (missing.length) return `이미지 자리 표시가 빠졌습니다 (${missing.join(', ')}번). 지정한 줄을 그대로 넣어 주세요.`;

    // 캡션 — 인스타 카드 문구로 그대로 넘어가는 줄이라 빠지면 세 채널 통일이 깨진다
    const captions = (text.match(new RegExp(`^\\s*${CAPTION_MARK}\\s*\\S`, 'gm')) || []).length;
    if (captions < 6) return `이미지 캡션이 ${captions}줄뿐입니다. 📷 줄마다 바로 아래에 "${CAPTION_MARK} "로 시작하는 설명 한 줄을 넣어 주세요 (6줄).`;

    if (/이런 순서로 정리|목차/.test(text)) return '블로그에 목차를 넣지 않습니다. 레퍼런스 형식에 목차가 없습니다.';

    if (!text.includes(CLOSING_HEAD)) return `"${CLOSING_HEAD}" 단락이 빠졌습니다. 지정한 순서대로 써 주세요.`;

    /**
     * ⚠️ 문체 검사를 두지 않는다. 한 번 뒀다가 걷어냈다(2026-08-03).
     *
     * 레퍼런스의 '~다' 평서형을 강제했더니 상품을 소개하는 글이 말끝마다 끊겨
     * 설명하는 느낌이 사라졌다. 게다가 검사기가 정상 문장을 계속 잡아 AI 글이 매번 반려됐다
     * (따옴표 안 인용문, '아니다'의 '니다').
     *
     * 레퍼런스에서 가져오는 것은 **레이아웃과 이미지 구성**이다. 문체가 아니다.
     * 아래 줄 리듬 검사만 남긴다 — 이건 문체가 아니라 화면에 보이는 모양이다.
     */

    // 줄 리듬 — 문단을 덩어리로 붙이면 레퍼런스와 완전히 다른 글이 된다
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const short = lines.filter((l) => l.length <= 30).length;
    if (lines.length >= 20 && short / lines.length < 0.4) {
      return `문단이 덩어리로 붙어 있습니다(짧은 줄 ${Math.round(short / lines.length * 100)}%). 한 문장을 쓰고 줄을 바꾸세요. 레퍼런스는 60~70%였습니다.`;
    }
  }

  if (channelId === 'threads') {
    if (/#[^\s#]/.test(text)) return '쓰레드에는 해시태그를 넣지 않습니다.';
    if (!/[?？]\s*$/.test(text.trim())) return '쓰레드는 질문으로 끝나야 합니다.';
  }
  return null;
}

/**
 * 채널 글귀 하나를 LLM 으로 만든다.
 * @param {'blog'|'instagram'|'threads'} channelId
 * @param {{product:object, topic:string, tone:string}} ctx
 * @param {{signal?:AbortSignal}} [opts]
 * @returns {Promise<string>} 검증을 통과한 글
 */
export async function generateWithAI(channelId, ctx, opts = {}) {
  let note = '';

  // 두 번까지 시도한다. 그 이상은 시간만 끌고 결과가 나아지지 않았다.
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await generateText(buildPrompt(ctx, channelId, note), {
      system: SYSTEM,
      temperature: attempt === 0 ? 0.9 : 0.5,   // 두 번째는 지시를 더 곧이곧대로 따르게
      signal: opts.signal,
    });
    const text = clean(raw);
    const problem = validateDraft(text, channelId, ctx.product, ctx.topic);
    if (!problem) return text;
    note = problem;
  }

  throw new Error(`AI 글이 검수를 통과하지 못했습니다 — ${note}`);
}
