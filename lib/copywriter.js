/**
 * 채널별 추천 글귀 생성기 (규칙 기반)
 *
 * 설계 원칙
 * 1. 데이터를 불릿으로 나열하지 않는다. product.voice 의 문장 재료를 골라 조합한다.
 * 2. 플랫폼마다 읽는 방식이 다르므로 구조를 공유하지 않는다.
 *    - 인스타: 첫 줄이 전부. 짧은 문단, 여백, 저장 유도.
 *    - 블로그: 검색으로 들어온 사람의 질문에 답하는 Q&A 구조. 제목에 키워드.
 *    - 쓰레드: 한 가지 이야기만. 구어체, 목록 없음, 질문으로 끝.
 * 3. 주제(topic)와 겹치는 문장을 앞으로 끌어올려 입력에 반응하게 만든다.
 * 4. variant 를 바꾸면 다른 후킹·근거 조합이 나온다 (재생성 버튼).
 *
 * 실제 AI 생성은 PART 2에서 이 파일의 generate() 만 교체하면 된다.
 *
 * 사실성 제약(07_BRAND_INFORMATION.md '공통 사실성 원칙')
 * - 마무리 문장은 product.closings(권장 표현)에서만 가져온다
 * - 종료된 행사는 쓰지 않는다 (status === 'open' 만)
 * - 성과·매출 보장, 최고·유일·1위 단정 문구를 만들지 않는다
 */

/** @typedef {{ product: object, topic: string, tone: string, variant?: number }} Ctx */

/** 톤 → 후킹 문장 인덱스. voice.hooks 는 이 순서(신뢰/후킹/담백/축하)로 작성돼 있다. */
const TONE_HOOK = { trust: 0, hook: 1, plain: 2, celebrate: 3 };

const TONE_LABEL = { trust: '신뢰·정보형', hook: '후킹·공감형', plain: '담백·실무형', celebrate: '축하·발표형' };

/** 순환 선택 — variant 를 올리면 다른 문장이 나온다 */
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

/**
 * 주제와 겹치는 글자가 많은 문장을 앞으로 보낸다.
 * 한국어는 어미 변화가 많아 형태소 분석 없이 2-gram 겹침으로 대략의 관련도만 잡는다.
 */
function byTopic(items, topic, textOf = (x) => x) {
  const grams = new Set();
  const clean = topic.replace(/[^가-힣a-zA-Z0-9]/g, '');
  for (let i = 0; i < clean.length - 1; i++) grams.add(clean.slice(i, i + 2));

  const score = (s) => {
    const c = s.replace(/[^가-힣a-zA-Z0-9]/g, '');
    let n = 0;
    for (let i = 0; i < c.length - 1; i++) if (grams.has(c.slice(i, i + 2))) n++;
    return n;
  };

  // 원래 순서를 최대한 지키면서 관련도가 높은 것만 끌어올린다
  return items
    .map((item, i) => ({ item, i, s: score(textOf(item)) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.item);
}

/** 진행 예정 행사만 (종료된 일정을 모집 중처럼 쓰지 않기 위함) */
const openEvents = (p) => (p.events || []).filter((e) => e.status === 'open');

/** 공백·기호를 뺀 비교용 문자열 — 같은 사실이 두 번 들어가는 걸 막는다 */
const flat = (s) => String(s).replace(/[^가-힣a-zA-Z0-9]/g, '');

const gramsOf = (s) => {
  const c = flat(s);
  const out = new Set();
  for (let i = 0; i < c.length - 1; i++) out.add(c.slice(i, i + 2));
  return out;
};

/**
 * 두 문장이 사실상 같은 말인지 본다.
 *
 * 부분 문자열 비교로는 "…열릴 예정입니다" 와 "…열립니다" 를 다른 문장으로 봐서
 * 같은 사실이 두 번 실렸다. 한국어는 어미가 바뀌므로 2-gram 겹침 비율로 판단한다.
 * 짧은 쪽을 분모로 두어 '한 문장이 다른 문장에 거의 포함되는' 경우도 잡는다.
 */
function similarity(a, b) {
  const A = gramsOf(a);
  const B = gramsOf(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((g) => { if (B.has(g)) n++; });
  return n / Math.min(A.size, B.size);
}

const SAME_ENOUGH = 0.6;

/** 이미 쓴 문장과 내용이 겹치면 버린다 (같은 말을 반복하면 오히려 빈약해 보인다) */
function notAlreadySaid(sentence, used) {
  if (flat(sentence).length < 8) return false;
  return !used.some((u) => similarity(sentence, u) >= SAME_ENOUGH);
}

/** 서로 겹치지 않는 것만 골라 n개 뽑는다 */
function pickDistinct(items, n, seed = []) {
  const out = [];
  const said = [...seed];
  for (const item of items) {
    if (out.length >= n) break;
    if (!notAlreadySaid(item, said)) continue;
    out.push(item);
    said.push(item);
  }
  return out;
}

/**
 * 카드뉴스 6장이 글의 어디에 들어가는지 표시한다.
 * 요청자 피드백: "생성된 이미지가 어디에 들어가는지" 알 수 없었다.
 * 대괄호 한 줄이라 붙여넣고 나서 지우기도 쉽다.
 *
 * 캡션은 레퍼런스 반영이다. 로라의 행복한상상 3편 모두 본문 이미지마다 한 줄 설명이 붙어 있고,
 * 그 문장이 카드에 적힌 문구를 그대로 요약한다. 캡션을 덱에서 뽑아 쓰면
 * **블로그 이미지와 인스타 카드가 같은 문구를 말하게 된다** — 세 채널 통일의 출발점이다.
 */
const imageSlot = (n, role, caption) =>
  `📷 [이미지 ${n} · ${role}] 카드뉴스 ${n}번을 여기에 넣으세요`
  + (caption ? `\n⤷ ${caption}` : '');

/**
 * 카드 한 장 → 이미지 아래 캡션 한 줄
 *
 * 레퍼런스의 캡션은 **설명**이지 제목이 아니다.
 *   "SBS 금·토드라마 '김부장' 넷플릭스에서도 시청 가능!"
 * 처음엔 카드 제목을 그대로 넣었더니 본문 소제목이 두 번 나왔다("수상하면 무엇을 받게 되나?").
 * 그래서 표지만 제목(후킹)을 쓰고, 나머지는 **본문 첫 문장**을 쓴다.
 */
const CAPTION_MAX = 60;

export function captionOf(card) {
  if (!card) return '';
  const first = String(card.body || '').split(/(?<=[.!?])\s+/)[0] || '';
  const source = card.kind === 'cover' || !first ? card.title : first;
  const text = String(source || '').replace(/\s+/g, ' ').trim();
  if (text.length <= CAPTION_MAX) return text;
  // 어절 중간에서 자르지 않는다 — 매거진형 제목 분할과 같은 원칙이다
  const cut = text.slice(0, CAPTION_MAX);
  return `${cut.slice(0, cut.lastIndexOf(' ')) || cut}…`;
}

/**
 * 레퍼런스의 줄 리듬을 만든다 — **한 문장 = 한 줄, 문장 사이에 빈 줄.**
 *
 * 측정값(로라의 행복한상상 3편): 줄당 평균 27~29자, 30자 이하 짧은 줄이 59~71%.
 * 지금까지 우리 글은 문단을 덩어리로 붙여 놔서 네이버에서 읽으면 벽처럼 보였다.
 *
 * 긴 나열 문장은 쉼표에서 한 번 더 쪼갠다(이때는 빈 줄 없이). 레퍼런스가 그렇게 끊는다.
 *   "패션, / 아트, / 캐릭터, / 라이프스타일까지."
 */
function breathe(text) {
  return String(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.length > 45 && (s.match(/,/g) || []).length >= 2
      ? s.split(/,\s*/).map((x, i, a) => (i === a.length - 1 ? x : `${x},`)).join('\n')
      : s))
    .join('\n\n');
}

/* ============================================================
   콘텐츠 코어 — 세 채널이 **같은 내용**을 말하게 하는 단 하나의 출처.

   요청자 요구(2026-08-03): "블로그·인스타·쓰레드 글의 내용이 동일해야 하며,
   동일한 이미지에서 각 플랫폼에 맞게 배포할 수 있어야 한다."

   예전에는 채널마다 따로 재료를 골랐다. 인스타는 qa 3개, 블로그는 4개, 쓰레드는
   threads.notes 를 따로 정렬했다. 그래서 같은 상품·주제인데도 다루는 사실이 서로 달랐다.

   지금은 buildCore() 가 **한 번만** 고르고, 세 생성기와 카드뉴스 덱이 전부 그 결과를 쓴다.
   ⚠️ 채널 생성기 안에서 byTopic()·pick() 으로 재료를 새로 고르지 말 것. 그 순간 다시 갈라진다.

   달라지는 것은 **형식과 화법**뿐이다 — 그게 '각 플랫폼에 맞게'의 의미다.
   ============================================================ */

/** 세 채널이 공통으로 다루는 핵심 개수. 카드뉴스 본문 3장과 1:1로 맞물린다. */
const CORE_POINTS = 3;

/**
 * @param {Ctx} ctx
 * @returns {{hook:string, summary:string[], points:object[], extra:string|undefined,
 *            objection:string, closing:string, cta:string, events:object[]}}
 */
export function buildCore({ product: p, topic, tone, variant = 0, cardCount = DECK_SIZE }) {
  const v = p.voice;
  // 질문과 답을 쌍째로 정렬한다 — 따로 뽑으면 소제목과 본문이 어긋난다
  const points = byTopic(v.qa, topic, (x) => `${x.q} ${x.a}`).slice(0, CORE_POINTS);

  const said = points.map((x) => x.a);
  const proof = byTopic(v.proof, topic);
  // 요약은 본문에서 이미 말한 것과 겹치지 않는 문장만 고른다
  const summary = pickDistinct(proof, 3, said);
  // 어디에도 안 나온 사실이 남아 있으면 하나만 덧붙인다
  const extra = proof.find((s) => notAlreadySaid(s, [...said, ...summary]));

  return {
    product: p,
    topic,
    tone,
    variant,
    cardCount: clampDeckSize(cardCount),
    hook: pick(v.hooks, TONE_HOOK[tone] + variant),
    summary,
    points,
    extra,
    objection: v.objection,
    closing: pick(p.closings, variant),
    cta: pick(v.ctas, variant),
    events: openEvents(p),
  };
}

/**
 * 카드뉴스 6장을 어느 채널에 어떻게 올리는지.
 *
 * 이미지는 **한 벌만 만든다.** 서대문구 레퍼런스가 카드뉴스 한 벌을 블로그 끝에 붙이고
 * 같은 걸 인스타에 올린 방식 그대로다.
 */
export const IMAGE_PLAN = {
  blog: '카드 1~6번을 본문 이미지 자리(📷)에 순서대로 넣으세요.',
  instagram: '카드 1~6번을 캐러셀로 순서대로 올리세요. 1번이 표지입니다.',
  threads: '카드 1번(표지)만 올리세요. 여러 장을 붙이면 광고 톤이 됩니다.',
};

/* ============================================================
   인스타그램 — 첫 두 줄이 전부. 짧은 문단 + 여백 + 저장 유도.
   ============================================================ */
const NUM_MARK = ['①', '②', '③', '④', '⑤'];

/**
 * 요청자 피드백: 문장이 전부 '~습니다'로 끝나 리듬이 없고 읽히지 않았다.
 *
 * 사실 문장 자체는 손대지 않는다(사실성 원칙). 대신 **사이에 다른 종결을 끼워** 리듬을 만든다.
 * 질문(?) → 사실(습니다) → 질문(?) → 사실(습니다) 로 번갈아 가게 qa 쌍을 쓰고,
 * 문단 사이에 짧은 명사형 한 줄을 넣어 호흡을 끊는다.
 */
function instagramCopy(core) {
  const { product: p, topic, hook, points, extra, objection, closing, cta } = core;

  const blocks = [
    // '더보기' 전에 보이는 자리. 여기서 끌지 못하면 나머지는 안 읽힌다.
    `${hook}\n'${topic}', 헷갈리는 것만 골랐어요.`,

    // 블로그 소제목·카드뉴스 2~4번과 같은 3가지다
    ...points.map((x, i) => `${NUM_MARK[i]} ${x.q}\n${x.a}`),

    extra ? `하나만 더.\n${extra}` : '',

    `여기까지가 기본.`,
    objection,

    closing,

    `📌 저장해 두면 필요할 때 바로 찾습니다.\n${cta}\n${p.handle}`,
    `.\n.\n.\n${p.hashtags.map((h) => `#${h}`).join(' ')}`,
  ];

  return blocks.filter(Boolean).join('\n\n');
}

/* ============================================================
   쓰레드 — 공지가 아니라 '알게 된 걸 흘리는' 글.
   여기서만 화법이 다르다: 발견형 도입 → 흘리는 정보 → 한발 물러선 단서 →
   권유 없는 마무리. 해시태그·계정·CTA를 넣지 않는 것이 핵심이다.
   (넣는 순간 광고 티가 나서 이 톤이 무너진다.)
   ============================================================ */
/**
 * 왜 읽어야 하는지를 첫 줄에서 만든다.
 *
 * 요청자 피드백: "읽어보고 사실 별로 궁금하지 않다. 이걸 왜 읽어야 하는지 후킹이 없다."
 * 공지 톤으로 넘어가지 않으면서 읽을 이유를 주려면 '정보의 빈자리'를 짚어야 한다.
 * 아래 문장들은 사실 주장이 아니라 화자의 경험·태도라서 사실성 원칙에 걸리지 않는다.
 */
const THREAD_HOOKS = [
  (topic) => `'${topic}' 찾아봤는데 한군데 정리된 데가 없더라고요.`,
  (topic) => `${topic} 관련해서 잘못 알고 있던 게 하나 있었어요.`,
  (topic) => `이거 모르고 지나가면 좀 아까울 것 같아서 적어둡니다.`,
  (topic) => `'${topic}' 이거 생각보다 조건이 단순하더라고요.`,
];

/** 질문형 마무리 — 대화가 이어지게 한다. 채널 정의의 '질문형 마무리'와 짝을 이룬다. */
const THREAD_QUESTIONS = [
  '혹시 이미 해보신 분 있나요?',
  '이런 거 미리 챙기시는 편인가요?',
  '더 아는 분 있으면 알려주세요.',
];

/**
 * 코어의 핵심 3가지를 **구어체 재료로 바꿔** 온다.
 *
 * 쓰레드만 화법이 다르다(`voice.threads`). 그렇다고 notes 를 주제로 따로 정렬해 버리면
 * 다른 채널과 다루는 사실이 갈라진다 — 실제로 그랬다.
 * 그래서 **코어가 고른 질문·답과 가장 가까운 note** 를 찾아 붙인다.
 * 같은 사실을 말하되 말투만 구어체가 된다.
 */
/**
 * ⚠️ 관련 없는 note 를 억지로 붙이지 않는다.
 *
 * 처음엔 가장 가까운 note 를 무조건 하나씩 골랐다. 그랬더니 핵심이 '받은 다음 어디에 쓰나요'인데
 * 쓰레드는 '방송사가 직접 여는 브랜드어워즈'를 말했다 — notes 에 그 항목이 아예 없어서다.
 * 어긋난 걸 말하느니 **그 항목을 빼는 게 낫다.** 쓰레드는 원래 500자라 다 담지도 못한다.
 */
const NOTE_MATCH_MIN = 0.2;

function threadNotesFor(core) {
  const notes = core.product.voice.threads.notes;
  const used = [];
  for (const pt of core.points) {
    const target = `${pt.q} ${pt.a}`;
    const best = notes
      .filter((n) => !used.includes(n))
      .map((n) => ({ n, s: similarity(n, target) }))
      .sort((a, b) => b.s - a.s)[0];
    if (best && best.s >= NOTE_MATCH_MIN) used.push(best.n);
  }
  return used;
}

function threadsCopy(core) {
  const { product: p, topic, tone, variant } = core;
  const t = p.voice.threads;

  const draft = [
    // 후킹 → 발견형 도입 순서. 후킹이 없으면 그냥 흘러가는 글이 된다.
    pick(THREAD_HOOKS, TONE_HOOK[tone] + variant)(topic),
    pick(t.opens, TONE_HOOK[tone] + variant),
    threadNotesFor(core).join('\n'),
    t.hedge,
    `${pick(t.closes, variant)}\n${pick(THREAD_QUESTIONS, variant)}`,
  ].join('\n\n');

  return clampToLimit(draft, 500);
}

/* ============================================================
   블로그 — 레퍼런스(네이버 블로그 4편) 골격을 그대로 따른다.

   측정해서 확인한 공통 구조 (로라의 행복한상상 3편이 오차 없이 동일):
     제목 두 줄 → 구분선 → 인용구 요약 → 도입 → 이미지+캡션
     → 소제목/본문 6묶음(사이사이 이미지+캡션) → 개요표 → 해시태그

   ⚠️ 목차를 넣지 않는다. 레퍼런스 3편 모두 목차가 없다. 예전 구조에는 있었다.

   ⚠️ **레퍼런스에서 가져온 것은 레이아웃과 이미지 구성뿐이다. 문체는 가져오지 않는다.**
      한 번 레퍼런스의 '~다' 평서형까지 옮겼다가 되돌렸다(2026-08-03).
      상품을 **소개하는** 글인데 말끝마다 '~다'로 끊으니 읽는 사람에게 설명하는 느낌이 사라졌다.
      문체는 **읽는 사람에게 설명하듯 하는 존댓말**이다. voice 재료를 원문 그대로 쓰면 된다.
   ============================================================ */
function blogCopy(core) {
  const { product: p, topic, points, summary: summary3, objection, closing, events } = core;
  const v = p.voice;
  const deck = deckFromCore(core, core.cardCount);   // 캡션을 카드에서 가져온다 — 인스타 카드와 같은 문구가 된다

  /**
   * 이미지 자리는 **장수에 따라 줄어든다.** 글은 그대로다.
   * 요청자 지시: "이미지를 줄이더라도 내용은 기승전결이 잘 드러나도록."
   * 그래서 소제목·반론·정리 단락은 장수와 무관하게 늘 쓰고, 📷 줄만 있는 장에 붙인다.
   */
  const labels = roleLabels(core.cardCount);
  const slotAt = (kind, nth = 0) => {
    let seen = 0;
    for (let i = 0; i < labels.length; i++) {
      const k = deck[i]?.kind;
      if (k !== kind) continue;
      if (seen++ !== nth) continue;
      return `

${imageSlot(i + 1, labels[i], captionOf(deck[i]))}`;
    }
    return '';
  };

  /**
   * 제목을 두 줄로 세운다. 레퍼런스 3편 모두 소제목 블록 두 개로 제목을 쪼개 놓았다.
   * 윗줄은 검색어(상품 + 주제), 아랫줄은 후킹구다.
   *   "김부장넷플릭스 공개시간 몇 시?" / "소지섭 액션이 돌아왔다"
   */
  const hook = core.hook.replace(/^[\s"'📢]+/, '').replace(/[\s"']+$/, '');
  const titleTop = `${p.short} ${topic}`;

  /**
   * 도입 — 목차 대신 '왜 지금 이걸 보는가'로 연다.
   * 아래 두 줄은 사실 주장이 아니라 화자의 태도라서 사실성 원칙에 걸리지 않는다.
   * (쓰레드 후킹에서 이미 같은 논리로 승인받은 방식이다.)
   *
   * 제목이 바로 위에 있으므로 주제를 다시 되뇌지 않는다. 레퍼런스도 도입에서 제목을 반복하지 않는다.
   */
  const lead = breathe([
    '찾아보면 여기저기 흩어져 있어서, 한자리에 정리된 곳이 마땅치 않으셨을 겁니다.',
    '그래서 필요한 것만 골라 정리해 봤습니다.',
    p.summary,
  ].join(' '));

  /**
   * 소제목은 **코어의 핵심 3가지**다. 인스타 ①②③, 카드뉴스 2~4번과 같은 항목이다.
   *
   * 블로그는 길이가 허용되므로 각 문단에 관련 근거를 한 줄씩 덧대 살을 붙인다.
   * 다루는 항목은 그대로고 설명만 길어지는 것이라 채널 간 내용이 갈라지지 않는다.
   * 이미 답에 들어간 내용이면 붙이지 않는다 — 같은 말을 두 번 하면 오히려 빈약해 보인다.
   */
  // 요약에 이미 쓴 문장도 '말한 것'으로 친다 — 요약·본문·덧글에 같은 사실이 세 번 나오면 안 된다
  const said = [...points.map((x) => x.a), ...summary3];
  const sections = points.map(({ q, a }, i) => {
    const extra = byTopic(v.proof, `${q} ${a}`).find((s) => notAlreadySaid(s, said));
    if (extra) said.push(extra);
    return `## ${q}\n\n${breathe(a + (extra ? ` ${extra}` : ''))}${slotAt('body', i)}`;
  }).join('\n\n');

  // 개요표 — 레퍼런스의 🔔 표를 그대로 옮겼다. 스캔하고 나가는 독자가 여기만 봐도 되게.
  const factBox = [
    `🔔 상품 · ${p.name}`,
    `🔔 접수 · ${p.intake}`,
    events.length ? `🔔 일정 · ${events.map((e) => `${e.date} ${e.name}`).join(' / ')}` : '',
    `🔔 문의 · ${p.handle}`,
    p.site ? `🔔 사이트 · ${p.site}` : '',
  ].filter(Boolean).join('\n');

  return [
    titleTop,
    hook,
    '',
    '───',
    '',
    summary3.map((s) => `> ${s}`).join('\n'),
    '',
    lead,
    slotAt('cover').trim() ? slotAt('cover').trim() : '',
    '',
    sections,
    '',
    '## 그래도 망설여진다면',
    '',
    breathe(objection),
    slotAt('note').trim() ? `
${slotAt('note').trim()}` : '',
    '',
    '## 정리하면',
    '',
    closing,
    '',
    `접수 방식은 '${p.intake}'입니다. 일정과 접수 상태, 비용은 게시 시점에 따라 달라질 수 있으니 신청 전에 공식 채널에서 다시 확인해 주세요.`,
    slotAt('outro').trim() ? `
${slotAt('outro').trim()}` : '',
    '',
    factBox,
    '',
    p.hashtags.map((h) => `#${h}`).join(' '),
  ].filter((x, i, arr) => !(x === '' && arr[i - 1] === '')).join('\n');
}

/**
 * 글자 수 제한을 넘으면 문단 단위로 덜어낸다.
 * 문장을 중간에서 자르지 않으므로 문맥이 깨지지 않는다.
 */
function clampToLimit(text, limit) {
  if (text.length <= limit) return text;
  const blocks = text.split('\n\n');
  while (blocks.length > 2 && blocks.join('\n\n').length > limit) {
    blocks.splice(blocks.length - 2, 1);   // 마지막 질문은 남긴다
  }
  const out = blocks.join('\n\n');
  return out.length <= limit ? out : out.slice(0, limit - 1).trimEnd() + '…';
}

/* ============================================================
   카드뉴스 6장 — **콘텐츠 코어와 같은 항목**을 쓴다.
   1장 후킹 → 2~4장 핵심 3가지 → 5장 반론 → 6장 마무리.
   이 한 벌을 블로그 본문·인스타 캐러셀·쓰레드 표지에 나눠 쓴다 (IMAGE_PLAN 참고).
   ============================================================ */

export const DECK_SIZE = 6;
export const DECK_MIN = 1;
export const DECK_MAX = 6;

/** 장수를 그 범위 안으로 밀어 넣는다 */
export const clampDeckSize = (n) => Math.min(DECK_MAX, Math.max(DECK_MIN, Math.round(Number(n) || DECK_SIZE)));

/**
 * 장수별 카드 구성.
 *
 * 요청자 요구(2026-08-03): API 비용을 줄이려고 1~6장을 고를 수 있어야 한다.
 * **장수를 줄여도 기승전결은 남아야 한다.** 그래서 본문(body)부터 덜어내고
 * 표지(기)와 마무리(결)는 끝까지 지킨다. 반론(전)은 5장부터 들어온다.
 *
 *   1장  표지                              — 한 장에 후킹과 마무리를 함께 얹는다
 *   2장  표지 · 마무리
 *   3장  표지 · 본문1 · 마무리
 *   4장  표지 · 본문1 · 본문2 · 마무리
 *   5장  표지 · 본문1 · 본문2 · 반론 · 마무리
 *   6장  표지 · 본문1 · 본문2 · 본문3 · 반론 · 마무리
 */
const DECK_PLAN = {
  1: ['cover'],
  2: ['cover', 'outro'],
  3: ['cover', 'body', 'outro'],
  4: ['cover', 'body', 'body', 'outro'],
  5: ['cover', 'body', 'body', 'note', 'outro'],
  6: ['cover', 'body', 'body', 'body', 'note', 'outro'],
};

/** 장수에 맞는 역할 목록 — 블로그 이미지 자리 라벨도 여기서 나온다 */
export const deckPlan = (size) => DECK_PLAN[clampDeckSize(size)];

const ROLE_LABEL = { cover: '표지', body: '본문', note: '반론', outro: '마무리' };
export const roleLabels = (size) => deckPlan(size).map((k) => ROLE_LABEL[k]);

/** 코어에서 카드를 만든다. 블로그 캡션도 여기서 나온다. */
function deckFromCore(core, size = DECK_SIZE) {
  const { product: p, topic, hook, points, objection, closing } = core;
  const plan = deckPlan(size);
  const total = plan.length;
  const pad = (n) => String(n).padStart(2, '0');

  // 한 장뿐이면 마무리 카드가 없다. 표지가 마무리까지 안고 가야 기승전결이 산다.
  const soloCover = total === 1;

  let bodyIdx = 0;
  return plan.map((kind, i) => {
    const eyebrow = total > 1 ? `${pad(i + 1)} / ${pad(total)}` : p.short;

    if (kind === 'cover') {
      return {
        kind: 'cover',
        eyebrow: p.short,
        title: hook,
        body: soloCover ? `${topic}\n${closing}` : topic,
        footer: p.handle,
        shot: p.voice.shots.cover,
      };
    }
    if (kind === 'body') {
      const x = points[bodyIdx++] || points[points.length - 1];
      return { kind: 'body', eyebrow, title: x.q, body: x.a, footer: p.short, shot: x.shot };
    }
    if (kind === 'note') {
      return {
        kind: 'note', eyebrow, title: '그래도 망설여진다면',
        body: objection, footer: p.short, shot: p.voice.shots.note,
      };
    }
    return {
      kind: 'outro',
      eyebrow: p.short,
      title: closing,
      body: `접수 방식은 '${p.intake}'입니다.\n조건과 일정은 공식 채널에서 확인해 주세요.`,
      footer: p.handle,
      shot: p.voice.shots.outro,
    };
  });
}

/**
 * @param {Ctx} ctx
 * @returns {Array<{kind:string, eyebrow:string, title:string, body?:string, footer?:string}>}
 */
export function buildDeck(ctx) {
  /**
   * ⚠️ `ctx.core` 가 오면 그것을 쓴다. AI 가 주제로 짠 뼈대(`lib/outline.js`)를 넣기 위한 자리다.
   *    이게 없던 시절에는 카드 문구가 **항상 규칙 기반**이라, AI 가 글을 새로 써도
   *    카드뉴스는 그대로였다 — 요청자 지적 그대로였다.
   */
  return deckFromCore(ctx.core || buildCore({ ...ctx, variant: ctx.variant ?? 0 }), ctx.cardCount);
}

const GENERATORS = { blog: blogCopy, instagram: instagramCopy, threads: threadsCopy };

/**
 * @param {'blog'|'instagram'|'threads'} channelId
 * @param {Ctx} ctx
 * @returns {string}
 */
export function generate(channelId, ctx) {
  const fn = GENERATORS[channelId];
  if (!fn) throw new Error(`알 수 없는 채널: ${channelId}`);
  // ⚠️ 세 채널이 같은 ctx 를 받으면 같은 코어가 나온다. 이게 내용 통일의 전부다.
  const out = fn(buildCore({ ...ctx, variant: ctx.variant ?? 0 }));
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 금지 표현 검사 — 편집 중에도 매 입력마다 호출되므로 동기 함수로 유지한다.
 * 띄어쓰기 차이를 흡수하려고 공백을 제거한 문자열끼리 비교한다.
 * @param {string} text
 * @param {string[]} banned
 * @returns {string[]} 발견된 금지 표현
 */
export function findBanned(text, banned) {
  const flat = text.replace(/\s/g, '');
  return banned.filter((phrase) => flat.includes(phrase.replace(/\s/g, '')));
}

export { TONE_LABEL };
