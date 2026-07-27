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

/* ============================================================
   인스타그램 — 첫 두 줄이 전부. 짧은 문단 + 여백 + 저장 유도.
   ============================================================ */
function instagramCopy({ product: p, topic, tone, variant }) {
  const v = p.voice;
  const hook = pick(v.hooks, TONE_HOOK[tone] + variant);
  const proof = byTopic(v.proof, topic).slice(0, 3);
  const cta = pick(v.ctas, variant);

  // 문단(블록) 단위로 만들고 빈 줄로 잇는다 — 인스타는 여백이 가독성을 좌우한다.
  // 주제는 따옴표로 감싸 어떤 형태로 입력해도 문장이 어색해지지 않게 한다.
  const blocks = [
    // 1~2줄: '더보기' 전에 보이는 자리. 여기서 끌지 못하면 나머지는 안 읽힌다.
    `${hook}\n'${topic}', ${proof.length}가지만 짚어볼게요.`,
    ...proof,
    v.objection,
    pick(p.closings, variant),
    `📌 나중에 다시 볼 것 같으면 저장해 두세요.\n${cta}\n${p.handle}`,
    `.\n.\n.\n${p.hashtags.map((h) => `#${h}`).join(' ')}`,
  ];

  return blocks.join('\n\n');
}

/* ============================================================
   쓰레드 — 공지가 아니라 '알게 된 걸 흘리는' 글.
   여기서만 화법이 다르다: 발견형 도입 → 흘리는 정보 → 한발 물러선 단서 →
   권유 없는 마무리. 해시태그·계정·CTA를 넣지 않는 것이 핵심이다.
   (넣는 순간 광고 티가 나서 이 톤이 무너진다.)
   ============================================================ */
function threadsCopy({ product: p, topic, tone, variant }) {
  const t = p.voice.threads;
  const notes = byTopic(t.notes, topic);

  const draft = [
    pick(t.opens, TONE_HOOK[tone] + variant),
    `${notes[0]}\n${notes[1]}`,
    t.hedge,
    pick(t.closes, variant),
  ].join('\n\n');

  return clampToLimit(draft, 500);
}

/* ============================================================
   블로그 — 검색으로 들어온 사람의 질문에 답하는 Q&A 구조.
   ============================================================ */
function blogCopy({ product: p, topic, tone, variant }) {
  const v = p.voice;
  // 질문과 답을 쌍째로 정렬한다 — 따로 뽑으면 소제목과 본문이 어긋난다
  const qa = byTopic(v.qa, topic, (x) => `${x.q} ${x.a}`);
  const events = openEvents(p);

  // 제목: 검색어가 앞에 오도록 상품명 + 주제 + 연도
  const title = tone === 'celebrate'
    ? `[안내] ${p.name} ${topic}`
    : `${p.short} ${topic} — 2026년 기준으로 정리했습니다`;

  // 조사 오류가 나지 않도록 이름 뒤에 쉼표를 두고 문장을 잇는다
  const lead = [
    `"${topic}"`,
    `${p.name}, 검색해서 들어오셨다면 아래 내용부터 확인해 보세요.`,
    p.summary,
    '',
    '이 글에서는 이런 순서로 정리했습니다.',
    qa.map((x, i) => `${i + 1}. ${x.q}`).join('\n'),
  ].join('\n');

  const sections = qa.map(({ q, a }) => `## ${q}\n${a}`).join('\n\n');

  // 진행 예정 행사가 있으면 표처럼 따로 정리해 스캔하기 쉽게 둔다
  const eventBlock = events.length
    ? ['', `## 남은 일정 한눈에\n${events.map((e) => `· ${e.date} — ${e.name} (${e.desc})`).join('\n')}\n종료된 행사는 제외했습니다.`]
    : [];

  return [
    title,
    '',
    lead,
    '',
    sections,
    ...eventBlock,
    '',
    '## 그래도 망설여진다면',
    v.objection,
    '',
    '## 정리하면',
    pick(p.closings, variant),
    pick(p.closings, variant + 1),
    `접수 방식은 '${p.intake}'입니다. 일정과 접수 상태, 비용은 게시 시점에 따라 달라질 수 있으니 신청 전에 공식 채널에서 다시 확인해 주세요.`,
    '',
    `문의 ${p.handle}${p.site ? `\n공식 사이트 ${p.site}` : ''}`,
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
   카드뉴스 6장 — 글귀와 같은 재료·같은 주제 정렬을 쓴다.
   1장 후킹 → 2~4장 Q&A → 5장 반론 → 6장 마무리.
   1080x1080 한 벌로 인스타 피드와 블로그 본문에 그대로 쓴다.
   ============================================================ */

export const DECK_SIZE = 6;

/**
 * @param {Ctx} ctx
 * @returns {Array<{kind:string, eyebrow:string, title:string, body?:string, footer?:string}>}
 */
export function buildDeck({ product: p, topic, tone, variant = 0 }) {
  const qa = byTopic(p.voice.qa, topic, (x) => `${x.q} ${x.a}`).slice(0, 3);

  return [
    {
      kind: 'cover',
      eyebrow: p.short,
      title: pick(p.voice.hooks, TONE_HOOK[tone] + variant),
      body: topic,
      footer: p.handle,
      shot: p.voice.shots.cover,
    },
    ...qa.map((x, i) => ({
      kind: 'body',
      eyebrow: `0${i + 2} / 0${DECK_SIZE}`,
      title: x.q,
      body: x.a,
      footer: p.short,
      shot: x.shot,   // 질문·답과 같은 항목에 묶여 있어 정렬해도 어긋나지 않는다
    })),
    {
      kind: 'note',
      eyebrow: `05 / 0${DECK_SIZE}`,
      title: '그래도 망설여진다면',
      body: p.voice.objection,
      footer: p.short,
      shot: p.voice.shots.note,
    },
    {
      kind: 'outro',
      eyebrow: p.short,
      title: pick(p.closings, variant),
      body: `접수 방식은 '${p.intake}'입니다.\n조건과 일정은 공식 채널에서 확인해 주세요.`,
      footer: p.handle,
      shot: p.voice.shots.outro,
    },
  ];
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
  const out = fn({ ...ctx, variant: ctx.variant ?? 0 });
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
