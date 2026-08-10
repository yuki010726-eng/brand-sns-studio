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
import { buildCore, findBanned, clampDeckSize } from './copywriter.js';
import { findRisky } from './copyai.js';
import { BANNED_PHRASES } from '../data/products.js';

/** 핵심 개수 — 카드뉴스 본문 3장, 블로그 소제목 3개와 1:1로 맞물린다 */
const POINTS = 3;

/** 카드에 얹히는 글이라 길이를 여기서 이미 조인다. 카드 슬롯 상한(lib/templates.js)과 결이 같다. */
const Q_MAX = 28;    // 소제목 · 카드 대주제
const A_MAX = 160;   // 카드 본문으로 들어간다

const SYSTEM = `당신은 한국 중소기업 브랜드 마케팅 콘텐츠의 구성을 짜는 편집자입니다.
사용자가 준 주제 하나를 어떻게 풀어낼지 뼈대만 정합니다. 글은 쓰지 않습니다.
출력은 JSON 하나입니다. 설명·머리말·코드블록 없이 JSON 만 출력합니다.`;

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
    `표현 주의사항:\n${p.cautions.map((c) => `- ${c}`).join('\n')}`,
  ].filter(Boolean).join('\n');
}

function buildPrompt(ctx, retryNote) {
  const { product: p, topic } = ctx;
  return [
    '■ 이번 게시물의 주제 (이것 하나만 다룹니다)',
    `『${topic}』`,
    '',
    '이 주제를 **어떻게 풀어낼지** 뼈대를 짜 주세요.',
    '',
    '■ 가장 중요한 것',
    '- 핵심 3가지는 **주제를 쪼갠 것**이어야 합니다. 상품을 소개하는 3가지가 아닙니다.',
    '  나쁜 예) "이 상은 어떤 상인가 / 무엇을 받나 / 언제 열리나" — 주제와 무관한 상품 소개입니다.',
    '  좋은 예) 주제가 『수상 이력을 광고에 쓰는 법』이면',
    '           "어디에 넣을 수 있나 / 어떻게 써야 신뢰가 생기나 / 쓸 때 조심할 점".',
    '- 같은 상품이라도 **주제가 다르면 3가지가 완전히 달라져야 합니다.**',
    '- 읽는 사람이 그 주제를 검색해서 들어왔다고 생각하고, 실제로 궁금해할 것부터 답하세요.',
    '- 3가지는 서로 겹치지 않아야 하고, 합쳐서 주제 하나를 온전히 설명해야 합니다.',
    '',
    '■ 사실 규칙 (어기면 폐기됩니다)',
    '- 아래 상품 자료에 **없는 수치·일정·혜택을 지어내지 않습니다.**',
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
    '■ 출력 형식 (JSON 하나만)',
    '{',
    `  "hook": "첫 문장에 쓸 후킹 한 줄. 주제와 직결된 궁금증·오해를 찌릅니다. 40자 이내.",`,
    `  "points": [`,
    `    { "q": "소제목 (${Q_MAX}자 이내, 주제를 쪼갠 것)", "a": "설명 2~3문장 (${A_MAX}자 이내). 상품 자료의 사실을 근거로." },`,
    `    { "q": "...", "a": "..." },`,
    `    { "q": "...", "a": "..." }`,
    '  ],',
    `  "objection": "이 주제에서 솔직하게 짚어야 할 한계 한두 문장. 위 '한계·반론'을 주제에 맞게 풀어 씁니다.",`,
    `  "summary": ["요약 문장 1", "요약 문장 2", "요약 문장 3"],`,
    `  "closing": "허용된 마무리 문장 중 하나를 그대로"`,
    '}',
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

  // 주제를 실제로 다뤘는지 — 소제목 3개에 주제 낱말이 하나도 없으면 상품 소개로 샌 것이다
  const words = [...new Set(String(topic).split(/[^가-힣a-zA-Z0-9]+/).filter((w) => w.length >= 2).map((w) => w.slice(0, 2)))];
  if (words.length >= 2) {
    const heads = o.points.map((x) => x.q).join(' ');
    if (!words.some((w) => heads.includes(w))) {
      return `소제목이 주제 『${topic}』와 이어지지 않습니다. 주제를 쪼갠 소제목으로 다시 짜 주세요.`;
    }
  }

  // 소제목끼리 겹치면 같은 말을 세 번 하게 된다
  const heads = o.points.map((x) => x.q.replace(/[^가-힣a-zA-Z0-9]/g, ''));
  if (new Set(heads).size < heads.length) return '소제목이 서로 중복됩니다.';

  return null;
}

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
    hook: outline.hook || ruleCore.hook,
    summary: Array.isArray(outline.summary) && outline.summary.length ? outline.summary.slice(0, 3) : ruleCore.summary,
    objection: outline.objection || ruleCore.objection,
    closing,
    points: outline.points.map((x, i) => ({
      ...(ruleCore.points[i] || ruleCore.points[0] || {}),   // shot 을 물려받는다
      q: x.q,
      a: x.a,
    })),
    fromAI: true,
  };
}

/** 이 뼈대를 만든 조건 — 상품·주제·톤이 바뀌면 다시 짜야 한다 */
export const outlineKeyOf = (s) => `${s.productId}|${String(s.topic || '').trim()}|${s.tone}`;

/**
 * 주제 아웃라인을 만든다.
 *
 * @param {{product:object, topic:string, tone:string, cardCount:number}} ctx
 * @param {{signal?:AbortSignal, onAttempt?:(info:object)=>void}} [opts]
 * @returns {Promise<object>} 검증을 통과한 뼈대 (mergeCore 로 코어에 얹어 쓴다)
 */
export async function generateOutline(ctx, opts = {}) {
  let note = '';
  for (let attempt = 0; attempt < 2; attempt++) {
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
      parsed.hook = trim(parsed.hook, 60);
      parsed.objection = trim(parsed.objection, 220);
      parsed.closing = trim(parsed.closing, 200);
      parsed.summary = Array.isArray(parsed.summary) ? parsed.summary.map((s) => trim(s, 120)).filter(Boolean) : [];
      parsed.points = parsed.points.map((x) => ({ q: trim(x?.q, Q_MAX), a: trim(x?.a, A_MAX) }));
    }

    const problem = validate(parsed, ctx);
    opts.onAttempt?.({ stage: 'outline', attempt, problem, usage, ms: Date.now() - startedAt });
    if (!problem) return parsed;
    note = problem;
  }
  throw new Error(`주제 뼈대를 만들지 못했습니다 — ${note}`);
}

/**
 * 뼈대를 얹은 코어를 돌려준다. 실패하면 규칙 기반 코어를 그대로 쓴다.
 * 화면은 이 함수만 부르면 된다.
 */
export async function coreWithOutline(ctx, opts = {}) {
  const ruleCore = buildCore({ ...ctx, cardCount: clampDeckSize(ctx.cardCount) });
  try {
    const outline = await generateOutline(ctx, opts);
    return { core: mergeCore(ruleCore, outline), outline, error: null };
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    return { core: ruleCore, outline: null, error: e.message };
  }
}
