/**
 * 템플릿별 편집 슬롯 정의
 *
 * 컨셉마다 카드에 들어가는 글의 '자리'가 다르다. 매거진형은 모든 장이 같은 구조지만,
 * 카드형은 표지/본문/마무리가 각각 다르고 노트형은 표지만 다르다.
 *
 * 이 파일이 그 차이를 한곳에 모아 둔다.
 * - 오른쪽 편집 폼(pages/template.js)이 어떤 입력칸을 그릴지
 * - 렌더러(lib/cardrender.js)가 어떤 값을 읽을지
 * 두 곳이 같은 정의를 보게 해서 어긋나지 않게 한다.
 *
 * label 에는 '카드 어디에 들어가는 글인지'를 반드시 함께 적는다.
 * 미리보기와 입력칸을 눈으로 잇는 유일한 단서다.
 */

/** 카드 종류(kind) → 템플릿이 구분하는 역할(role) */
export function roleOf(conceptId, kind) {
  if (conceptId === 'magazine') return 'all';        // 모든 장이 같은 구조
  if (kind === 'cover') return 'cover';
  if (kind === 'outro') return conceptId === 'card' ? 'outro' : 'body';
  return 'body';
}

const HANDLE = { id: 'footer', label: '계정 아이디 (하단)', hint: '카드 왼쪽 아래', tag: 'input', max: 24 };

const NOTE_BODY_HINT =
  '아래 버튼으로 넣을 수 있습니다 — **강조**는 굵고 진하게, 줄 앞 &gt; 는 검정 하이라이트 바, '
  + '줄 앞 1. 2. 는 번호 박스. 빈 줄로 문단을 나누면 레퍼런스처럼 여유 있게 읽힙니다.';

const CARD_BODY_HINT = "'**강조**' 로 감싸면 굵고 진하게. 줄 앞 '> ' 는 테마색 박스, "
  + '줄 앞 1. 2. 는 번호 박스. 빈 줄로 문단을 나눕니다.';

/**
 * 슬롯별 글자 수 상한 (`max`).
 *
 * 요청자 요구(2026-08-10): "카드뉴스에서 글자 레이아웃과 행간은 아주 중요하다.
 * 넘어가지 않도록 확실한 방지책을 세우고, 정 안 되면 **처음 생성할 때 글자 수를 제한**하라."
 *
 * ⚠️ 이 숫자는 **눈대중이 아니라 렌더러로 실측한 값이다.** (2026-08-10)
 *    기준은 '잘리기 직전'이 아니라 **'글자 크기가 한 번도 줄지 않는 지점'** 이다.
 *    잘리지만 않으면 된다고 잡으면 글자가 최소 크기까지 작아져 레퍼런스의 행간이 무너진다.
 *
 * | 슬롯 | 원래 크기 유지 | 잘리기 직전 | 여기서 정한 값 |
 * |---|---|---|---|
 * | magazine title+highlight | 각 30 | 각 61 | 각 22 |
 * | card cover title | 58 | 85 | 52 |
 * | card body title / body | 49 / 413 | 67 / 853 | 44 / 380 |
 * | card outro body | 213 | 283 | 190 |
 * | note cover title / 부제 | 40 / 61 | 58 / 75 | 36 / 55 |
 * | note body title / body | 45 / 420 | 66 / 766 | 40 / **220** |
 *
 * 실측보다 낮춰 잡은 이유: 글자 폭이 문장마다 달라서(숫자·영문·기호) 딱 맞춰 두면 넘친다.
 *
 * ⚠️ **노트형 본문만 유독 낮다 (220).** 하이라이트 바와 번호 박스가 글자보다 세로 공간을
 *    훨씬 많이 먹어서, 같은 글자 수라도 평문보다 빨리 찬다. 실측으로 확인했다 —
 *    상한 340 이면 160장 중 64장에서 글자가 한 단계 작아졌고, 220 에서 0장이 됐다.
 *    (2026-08-04 의 "본문 분량을 많게" 요구와 상충하지만, 2026-08-10 지시로 행간을 우선한다.
 *     분량을 늘리려면 260 으로 올릴 수 있다 — 대신 카드 20% 가 한 단계 작아진다.)
 *
 * ⚠️ `max` 는 **생성 기본값에만** 적용된다. 사용자가 직접 더 길게 쓰는 것은 막지 않는다
 *    (요청자 지시: 이후에는 수정 가능하도록). 대신 넘치면 화면이 경고한다.
 * ⚠️ 렌더러의 `sizes`·`maxLines` 를 건드렸다면 이 표를 **반드시 다시 재야 한다.**
 */
const SLOTS = {
  magazine: {
    all: [
      { id: 'brand', label: '계정 이름 (상단 중앙)', hint: '카드 맨 위 가운데', tag: 'input', max: 20 },
      { id: 'eyebrow', label: '카테고리 라벨 (알약 배지)', hint: '제목 바로 위', tag: 'input', max: 16 },
      { id: 'title', label: '제목 (흰색, 가장 큰 글씨)', hint: '한눈에 읽히는 문장', tag: 'textarea', rows: 3, max: 22 },
      { id: 'highlight', label: '강조 문구 (형광색)', hint: '제목 아래 붙는 줄. 색은 아래 「강조 색상」에서 고릅니다.', tag: 'textarea', rows: 2, max: 22 },
      HANDLE,
    ],
  },
  card: {
    /**
     * ⚠️ 표지와 본문은 **배치가 다르다.** 레퍼런스 표지는 하단에 테두리 알약 + 아주 큰 흰 제목이고,
     *    본문만 상단 알약 + 하단 흰 박스다. 한 번 같게 합쳤다가 되돌렸다(2026-08-03).
     */
    cover: [
      { id: 'eyebrow', label: '카테고리 라벨 (테두리 배지)', hint: '제목 바로 위', tag: 'input', max: 16 },
      { id: 'title', label: '제목 (흰색, 여러 줄)', hint: '가장 크게 들어가는 문장', tag: 'textarea', rows: 3, max: 52 },
      HANDLE,
    ],
    body: [
      { id: 'title', label: '제목 (상단 알약, 흰 글씨)', hint: '카드 위쪽 테마색 알약 안', tag: 'textarea', rows: 2, max: 44 },
      { id: 'body', label: '본문 (하단 흰 박스)', hint: CARD_BODY_HINT, tag: 'textarea', rows: 7, max: 380 },
      { id: 'source', label: '출처 (선택)', hint: '흰 박스 오른쪽 아래에 작게. 없으면 비워 두세요.', tag: 'input', max: 30 },
      HANDLE,
    ],
    outro: [
      { id: 'body', label: '팔로우 유도 문구 (중앙)', hint: '테마색 단색 배경 가운데. Enter 로 줄을 나눕니다.', tag: 'textarea', rows: 5, max: 190 },
      { id: 'footer', label: '계정 아이디 (중앙 하단)', hint: '문구 아래 가운데', tag: 'input', max: 24 },
    ],
  },
  note: {
    cover: [
      { id: 'title', label: '제목 (중앙, 큰 글씨)', hint: '카드 위쪽 가운데', tag: 'textarea', rows: 2, max: 36 },
      { id: 'body', label: '부제 (중앙, 회색 한 줄)', hint: '제목 바로 아래', tag: 'input', max: 55 },
    ],
    body: [
      // 레퍼런스의 "솔직한 AI 단점 01" 자리. 비워 두면 알약이 그려지지 않는다.
      { id: 'eyebrow', label: '라벨 (제목 위, 테두리 알약)', hint: '없으면 비워 두세요', tag: 'input', max: 16 },
      { id: 'title', label: '대주제 (왼쪽 정렬, 아주 굵게)', hint: '심볼 아래 검은 제목', tag: 'textarea', rows: 2, max: 40 },
      { id: 'body', label: '본문', hint: NOTE_BODY_HINT, tag: 'textarea', rows: 9, max: 220 },
    ],
  },
};

/**
 * @param {string} conceptId
 * @param {string} kind buildDeck() 카드의 kind
 * @returns {Array<{id:string,label:string,hint:string,tag:string,rows?:number}>}
 */
export function slotsFor(conceptId, kind) {
  const byRole = SLOTS[conceptId] || SLOTS.magazine;
  return byRole[roleOf(conceptId, kind)] || byRole.body || byRole.all;
}

/**
 * 자유 배치(위치·크기 커스텀) 대상 오브젝트 목록.
 *
 * 정적 좌표표는 두지 않는다 — 기본 위치는 항상 렌더러(lib/cardrender.js)가 실제로 그린
 * 상자(`lastBoxes()`)에서 얻는다. 이 목록은 "이 카드에 드래그 손잡이를 몇 개, 어떤 라벨로
 * 그릴지"만 정한다.
 *
 * ⚠️ 1단계는 매거진형만 지원한다. 렌더러가 아직 카드형·노트형은 오브젝트별 오버라이드
 *    경로를 갖고 있지 않다 — 지원되지 않는 템플릿은 빈 배열을 돌려준다.
 *
 * `title` 오브젝트는 슬롯 정의의 `title`+`highlight` 두 칸을 **한 상자로 묶어** 다룬다.
 * 매거진형 제목과 형광 강조줄은 같은 크기로 붙어 읽혀야 하는 한 덩어리라서(`fitPair`),
 * 따로 움직이게 하면 그 설계 의도가 깨진다.
 */
export function objectsFor(conceptId, kind) {
  if (conceptId !== 'magazine') return [];
  return [
    { id: 'brand', type: 'text', label: '계정 이름' },
    { id: 'eyebrow', type: 'text', label: '카테고리 라벨' },
    { id: 'title', type: 'text', label: '제목 + 강조 문구' },
    { id: 'footer', type: 'text', label: '계정 아이디' },
    { id: 'image', type: 'image', label: '배경 이미지' },
  ];
}

/** 첫 문장만 뽑는다 — 강조 한 줄에 문단 전체가 들어가면 카드가 무너진다 */
const firstSentence = (text = '') => {
  const line = String(text).split('\n').find((l) => l.trim()) || '';
  const m = line.match(/^.*?[.?!](?=\s|$)/);
  return (m ? m[0] : line).trim();
};

/**
 * 매거진형 표제용으로 짧게 줄인다.
 *
 * 레퍼런스의 제목은 두 줄, 각 줄 15자 안팎이다. 카드 문구를 그대로 넣으면
 * 줄이 늘어나면서 글자가 작아지고 행간이 무너져 '글이 넘치는' 느낌이 된다.
 * 첫 문장만 쓰고, 그마저 길면 절 경계(쉼표·가운뎃점)에서 자른다. 마침표는 뗀다.
 * 어절 중간에서는 절대 자르지 않는다 — 한국어가 어색해진다.
 */
function headline(text, max = 30) {
  let s = firstSentence(text).replace(/\s+/g, ' ').replace(/\.$/, '').trim();
  if (s.length <= max) return s;
  const clause = s.slice(0, max + 8).match(/^[^,·]{8,}(?=[,·])/);
  if (clause) return clause[0].trim();
  return s.slice(0, max).replace(/\s+\S*$/, '').trim();   // 마지막 어절은 통째로 버린다
}

/**
 * 노트형 본문을 문장 단위로 끊고 빈 줄로 띄운다.
 * 레퍼런스가 한 문단에 한두 문장씩만 두고 사이를 넉넉히 비운다 — 그래야 조곤조곤 읽힌다.
 * 문장을 고치거나 줄이지 않고 사이만 벌린다.
 */
function noteParagraphs(text = '') {
  return String(text)
    .split('\n')
    .flatMap((line) => line.split(/(?<=[.?!])\s+/))
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n');
}

/* ---------------- 노트형 본문 살 붙이기 ---------------- */

const flat2 = (s) => String(s).replace(/[^가-힣a-zA-Z0-9]/g, '');

/** 같은 사실이 두 번 실리지 않게 — 어미가 달라져도 잡히도록 2-gram 겹침으로 본다 */
function overlaps(a, b) {
  const A = new Set();
  const ca = flat2(a);
  for (let i = 0; i < ca.length - 1; i++) A.add(ca.slice(i, i + 2));
  const cb = flat2(b);
  let n = 0;
  const B = new Set();
  for (let i = 0; i < cb.length - 1; i++) B.add(cb.slice(i, i + 2));
  B.forEach((gm) => { if (A.has(gm)) n++; });
  return n / Math.min(A.size || 1, B.size || 1) >= 0.6;
}

/** 주제와 겹치는 문장을 앞으로 — 관계없는 근거가 딸려 오면 글이 산만해진다 */
function byRelevance(items, seed) {
  const s = new Set();
  const cs = flat2(seed);
  for (let i = 0; i < cs.length - 1; i++) s.add(cs.slice(i, i + 2));
  const score = (t) => {
    const c = flat2(t);
    let n = 0;
    for (let i = 0; i < c.length - 1; i++) if (s.has(c.slice(i, i + 2))) n++;
    return n;
  };
  return items.map((x, i) => ({ x, i, v: score(x) })).sort((a, b) => b.v - a.v || a.i - b.i).map((o) => o.x);
}

/** 숫자·날짜 한 곳만 굵게 — 스캔할 때 눈이 걸리는 지점이다. 문장은 손대지 않는다. */
const emphasizeNumber = (s) =>
  s.replace(/(\d[\d,.~]*\s*(?:년|월|일|개|초|분|%|점|명|만\s*원|원|위))/, '**$1**');

/**
 * 노트형 본문 기본값.
 *
 * 요청자 요구(2026-08-04): "본문이 더 길고 하이라이트바·번호목록·강조를 더 써서
 * 분량을 많게 기본으로 만들어 달라. 그래야 사람들이 편하게 활용한다."
 *
 * 구성: 하이라이트 바(핵심 한 문장) → 문단(숫자 강조) → 번호 목록(관련 근거)
 * 문장은 승인된 원문 그대로 쓰고 **배치와 굵기만** 바꾼다.
 */
function noteBodyRich(card, product) {
  const sentences = String(card.body || '')
    .split('\n')
    .flatMap((l) => l.split(/(?<=[.?!])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);

  const lead = sentences[0] || '';
  const rest = sentences.slice(1);

  const said = [...sentences];
  const items = [];
  for (const s of byRelevance(product.voice?.proof || [], `${card.title} ${card.body}`)) {
    if (items.length >= 3) break;
    if (said.some((u) => overlaps(u, s))) continue;
    items.push(s);
    said.push(s);
  }

  const blocks = [];
  if (lead) blocks.push(`> ${lead}`);
  if (rest.length) blocks.push(rest.map(emphasizeNumber).join('\n\n'));
  if (items.length) blocks.push(items.map((s, i) => `${i + 1}. ${s}`).join('\n'));
  return blocks.join('\n\n');
}

/**
 * 한 문장을 흰 줄 / 형광 줄로 나눈다.
 * 레퍼런스가 정확히 이 구조다 — 한 문장을 두 줄로 끊고 뒷줄만 형광색으로 준다.
 * 쉼표가 있으면 거기서, 없으면 가운데에서 가장 가까운 어절 경계에서 나눈다.
 */
function splitHeadline(s) {
  if (s.length <= 12) return [s, ''];

  const comma = s.indexOf(',');
  if (comma > 3 && comma < s.length - 4) return [s.slice(0, comma + 1).trim(), s.slice(comma + 1).trim()];

  const mid = s.length / 2;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== ' ') continue;
    const d = Math.abs(i - mid);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best > 0 ? [s.slice(0, best).trim(), s.slice(best + 1).trim()] : [s, ''];
}

/**
 * 카드 한 장의 추천 문구 초기값.
 * 슬롯에 없는 값은 만들지 않는다 — 폼과 렌더러가 보는 키를 정확히 일치시킨다.
 *
 * @param {string} conceptId
 * @param {object} card buildDeck() 결과의 한 항목
 * @param {object} product data/products.js 의 상품
 */
/**
 * 상한에 맞춰 줄인다 — **어절 중간에서 자르지 않는다.** 한국어가 어색해지기 때문이다.
 * 문장 경계가 있으면 거기서, 없으면 마지막 어절을 통째로 버린다.
 */
export function clampSlot(text, max) {
  const s = String(text ?? '');
  if (!max || s.length <= max) return s;

  // 문장 단위로 담을 수 있는 만큼만 담는다 (문단 구분은 살린다)
  const parts = s.split(/(?<=[.?!])\s+/);
  let out = '';
  for (const part of parts) {
    const next = out ? `${out} ${part}` : part;
    if (next.length > max) break;
    out = next;
  }
  if (out.length >= max * 0.6) return out.trim();

  // 문장 하나가 통째로 상한을 넘는 경우 — 마지막 어절을 버리고 말줄임을 붙인다
  const cut = s.slice(0, max - 1).replace(/\s+\S*$/, '').trim();
  return `${cut || s.slice(0, max - 1).trim()}…`;
}

/** 여러 줄 구조(하이라이트 바·번호 목록)를 가진 본문은 **줄 단위로** 덜어낸다 */
function clampBlocks(text, max) {
  const s = String(text ?? '');
  if (!max || s.length <= max) return s;
  const blocks = s.split('\n\n');
  while (blocks.length > 1 && blocks.join('\n\n').length > max) blocks.pop();
  const out = blocks.join('\n\n');
  return out.length <= max ? out : clampSlot(out, max);
}

/**
 * 카드 한 장의 추천 문구 초기값.
 * 슬롯에 없는 값은 만들지 않는다 — 폼과 렌더러가 보는 키를 정확히 일치시킨다.
 *
 * ⚠️ 만든 값은 **반드시 슬롯 상한(`max`)을 지킨다.** 그래야 처음 열었을 때 카드가
 *    레퍼런스 그대로 보인다. 사용자가 나중에 더 길게 쓰는 것은 막지 않는다.
 *
 * @param {string} conceptId
 * @param {object} card buildDeck() 결과의 한 항목
 * @param {object} product data/products.js 의 상품
 */
export function defaultsFor(conceptId, card, product) {
  const role = roleOf(conceptId, card.kind);
  const slots = slotsFor(conceptId, card.kind);
  const pick = (obj) => {
    const out = {};
    slots.forEach((s) => {
      const raw = obj[s.id] ?? '';
      // 본문처럼 문단 구조가 있는 칸은 줄 단위로, 나머지는 문장 단위로 줄인다
      out[s.id] = s.id === 'body' && String(raw).includes('\n\n')
        ? clampBlocks(raw, s.max)
        : clampSlot(raw, s.max);
    });
    return out;
  };

  if (conceptId === 'magazine') {
    // 핵심 한 문장만 쓰고 두 줄로 나눈다 — 뒷줄이 형광색이다.
    // 마무리 장은 예외: 승인된 마무리 문장이라 자르거나 쪼개지 않고 통째로 쓴다.
    const [head, tail] = card.kind === 'outro'
      ? [card.title, '']
      : splitHeadline(headline(card.title, 34));
    return pick({
      brand: product.short,
      eyebrow: card.eyebrow,
      title: head,
      highlight: tail,
      footer: product.handle,
    });
  }

  if (conceptId === 'card') {
    if (role === 'cover') {
      // 표지도 본문과 같은 배치다 — 위 알약에 후킹, 아래 흰 박스에 주제와 무엇을 정리했는지
      return pick({
        title: card.title,
        body: `${card.body}\n\n${product.summary}`,
        source: '',
        footer: product.handle,
      });
    }
    if (role === 'outro') {
      return pick({
        body: `오늘의 내용이 도움이 됐다면?\n\n${product.short} 소식을 팔로우하고\n다음 이야기도 함께 보세요.`,
        footer: product.handle,
      });
    }
    return pick({ title: card.title, body: card.body, source: '', footer: product.handle });
  }

  // note
  if (role === 'cover') {
    return pick({ title: card.title, body: product.tagline });
  }
  // 마무리 장은 승인된 마무리 문장(card.title)을 바에 **손대지 않고 그대로** 쓴다 — 사실성 원칙.
  if (card.kind === 'outro') {
    return pick({
      title: '정리하면',
      body: `${noteParagraphs(card.body)}\n\n> ${card.title}`,
    });
  }
  // 몇 번째 장인지를 알약 라벨로 — 레퍼런스가 "01", "02" 를 그렇게 단다
  return pick({ eyebrow: card.eyebrow || '', title: card.title, body: noteBodyRich(card, product) });
}
