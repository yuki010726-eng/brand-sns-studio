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

const HANDLE = { id: 'footer', label: '계정 아이디 (하단)', hint: '카드 왼쪽 아래', tag: 'input' };

const NOTE_BODY_HINT =
  '아래 버튼으로 넣을 수 있습니다 — **강조**는 굵고 진하게, 줄 앞 &gt; 는 검정 하이라이트 바, '
  + '줄 앞 1. 2. 는 번호 박스. 빈 줄로 문단을 나누면 레퍼런스처럼 여유 있게 읽힙니다.';

const CARD_BODY_HINT = "'**강조**' 로 감싸면 굵고 진하게. 줄 앞 '> ' 는 테마색 박스, "
  + '줄 앞 1. 2. 는 번호 박스. 빈 줄로 문단을 나눕니다.';

const SLOTS = {
  magazine: {
    all: [
      { id: 'brand', label: '계정 이름 (상단 중앙)', hint: '카드 맨 위 가운데', tag: 'input' },
      { id: 'eyebrow', label: '카테고리 라벨 (알약 배지)', hint: '제목 바로 위', tag: 'input' },
      { id: 'title', label: '제목 (흰색, 가장 큰 글씨)', hint: '한눈에 읽히는 문장', tag: 'textarea', rows: 3 },
      { id: 'highlight', label: '강조 문구 (형광색)', hint: '제목 아래 붙는 줄. 색은 아래 「강조 색상」에서 고릅니다.', tag: 'textarea', rows: 2 },
      HANDLE,
    ],
  },
  card: {
    /**
     * ⚠️ 표지와 본문은 **배치가 다르다.** 레퍼런스 표지는 하단에 테두리 알약 + 아주 큰 흰 제목이고,
     *    본문만 상단 알약 + 하단 흰 박스다. 한 번 같게 합쳤다가 되돌렸다(2026-08-03).
     */
    cover: [
      { id: 'eyebrow', label: '카테고리 라벨 (테두리 배지)', hint: '제목 바로 위', tag: 'input' },
      { id: 'title', label: '제목 (흰색, 여러 줄)', hint: '가장 크게 들어가는 문장', tag: 'textarea', rows: 3 },
      HANDLE,
    ],
    body: [
      { id: 'title', label: '제목 (상단 알약, 흰 글씨)', hint: '카드 위쪽 테마색 알약 안', tag: 'textarea', rows: 2 },
      { id: 'body', label: '본문 (하단 흰 박스)', hint: CARD_BODY_HINT, tag: 'textarea', rows: 7 },
      { id: 'source', label: '출처 (선택)', hint: '흰 박스 오른쪽 아래에 작게. 없으면 비워 두세요.', tag: 'input' },
      HANDLE,
    ],
    outro: [
      { id: 'body', label: '팔로우 유도 문구 (중앙)', hint: '테마색 단색 배경 가운데. Enter 로 줄을 나눕니다.', tag: 'textarea', rows: 5 },
      { id: 'footer', label: '계정 아이디 (중앙 하단)', hint: '문구 아래 가운데', tag: 'input' },
    ],
  },
  note: {
    cover: [
      { id: 'title', label: '제목 (중앙, 큰 글씨)', hint: '카드 위쪽 가운데', tag: 'textarea', rows: 2 },
      { id: 'body', label: '부제 (중앙, 회색 한 줄)', hint: '제목 바로 아래', tag: 'input' },
    ],
    body: [
      // 레퍼런스의 "솔직한 AI 단점 01" 자리. 비워 두면 알약이 그려지지 않는다.
      { id: 'eyebrow', label: '라벨 (제목 위, 테두리 알약)', hint: '없으면 비워 두세요', tag: 'input' },
      { id: 'title', label: '대주제 (왼쪽 정렬, 아주 굵게)', hint: '심볼 아래 검은 제목', tag: 'textarea', rows: 2 },
      { id: 'body', label: '본문', hint: NOTE_BODY_HINT, tag: 'textarea', rows: 9 },
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
export function defaultsFor(conceptId, card, product) {
  const role = roleOf(conceptId, card.kind);
  const pick = (obj) => {
    const out = {};
    slotsFor(conceptId, card.kind).forEach((s) => { out[s.id] = obj[s.id] ?? ''; });
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
  const body = noteParagraphs(card.body);
  // 마무리 장에는 하이라이트 바를 하나 넣어 둔다.
  // 바 문구는 승인된 마무리 문장(card.title)을 **손대지 않고 그대로** 쓴다 — 사실성 원칙.
  if (card.kind === 'outro') {
    return pick({ title: '정리하면', body: `${body}\n\n> ${card.title}` });
  }
  // 몇 번째 장인지를 알약 라벨로 — 레퍼런스가 "01", "02" 를 그렇게 단다
  return pick({ eyebrow: card.eyebrow || '', title: card.title, body });
}
