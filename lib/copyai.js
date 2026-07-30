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
import { findBanned } from './copywriter.js';
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
- 같은 종결어미('~습니다')가 세 번 연속 나오지 않게 씁니다. 질문·명사형·짧은 문장을 섞습니다.
- 상투적인 홍보 문구를 쓰지 않습니다. 읽는 사람이 실제로 궁금해할 것부터 답합니다.
- 제공된 참고 재료의 문장을 **그대로 옮겨 붙이지 않습니다.** 사실만 가져와 새로 씁니다.
  (숫자·날짜·고유명사는 바꾸지 말고 그대로 씁니다.)

출력은 본문만. 설명·머리말·코드블록·따옴표 감싸기 없이 글 자체만 출력합니다.`;

function channelRules(channelId, p) {
  if (channelId === 'blog') {
    return `[블로그 글]
목적: **그 주제를 검색해서 들어온 사람**에게 정확한 정보를 지루하지 않게 전달합니다.

- 제목에 주제가 드러나야 합니다. 상품 소개글 제목을 쓰지 않습니다.
- 소제목은 **주제를 파고드는 질문**으로 직접 만듭니다. 참고 재료의 질문을 그대로 옮기지 않습니다.
- 주제와 관련 없는 특전·일정·패키지는 넣지 않습니다. 주제에 필요한 것만 골라 씁니다.

구조를 이 순서로 지킵니다.
1) 제목 한 줄 (주제 키워드가 앞에 오도록)
2) 도입 2~3줄 — 이 주제를 지금 알아야 하는 이유부터
3) "**먼저 3줄 요약**" 뒤에 '· '로 시작하는 핵심 3줄
4) ${imageSlotLine(1)}
5) "이 글에서는 이런 순서로 정리했습니다." 뒤에 번호 목차
6) "## 소제목" 형태의 문단 4~5개. **전부 주제를 다루는 질문**이어야 합니다.
   주제가 '일정 안내'면 일정을 여러 각도(언제·어디서·언제까지 준비·놓치면)로 쪼갭니다.
   상품 전반을 소개하는 문단을 끼워 넣지 마세요. 한 문단이라도 주제에서 벗어나면 실패입니다.
   첫 세 문단 끝에 각각 아래 줄을 그대로 넣습니다.
   ${imageSlotLine(2)}
   ${imageSlotLine(3)}
   ${imageSlotLine(4)}
7) "## 그래도 망설여진다면" 문단에서 한계를 솔직히 씁니다
8) ${imageSlotLine(5)}
9) "## 정리하면" 문단
10) ${imageSlotLine(6)}
11) 문의 계정과 공식 사이트
12) 해시태그 한 줄

📷 로 시작하는 여섯 줄은 **글자 하나 바꾸지 말고 그대로** 넣습니다. 카드뉴스 이미지가 들어갈 자리입니다.
분량은 공백 포함 1,500~2,200자.`;
  }

  if (channelId === 'instagram') {
    return `[인스타그램 캡션]
목적: 첫 두 줄에서 붙잡고, 끝까지 읽히게 합니다.

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

function buildPrompt({ product, topic, tone }, channelId, retryNote) {
  // 주제를 맨 앞·맨 뒤 양쪽에 둔다. 자료를 먼저 주면 모델이 자료 요약으로 흘러간다.
  return [
    `■ 이번 글의 주제 (이것 하나만 다룹니다)`,
    `『${topic}』`,
    '',
    `이 주제가 글의 중심입니다. 아래 자료는 주제를 뒷받침할 재료일 뿐이며,`,
    `주제와 상관없는 내용은 넣지 마세요. 자료 전체를 요약하면 실패입니다.`,
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
