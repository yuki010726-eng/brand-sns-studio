/**
 * 카드뉴스 템플릿 3종
 * 바탕화면 '브랜드 sns 스타일 레퍼런스 자료' 의 세 계정에서 뽑아낸 스타일 정의.
 *
 * - style : 이미지 생성 프롬프트에 붙는 영문 스타일 지시어
 * - layout: 4단계 렌더러(lib/cardrender.js)가 쓰는 색·배치 값
 *
 * 이미지 프롬프트에는 항상 '글자를 넣지 말 것'을 명시한다.
 * 텍스트는 4단계에서 얹어야 수정이 가능하고, 생성 이미지의 한글은 깨진다.
 */

/** 모든 컨셉에 공통으로 붙는 금지 지시어 */
const NO_TEXT = 'no text, no letters, no words, no typography, no watermark, no logo, no signature';

/**
 * 매거진형 강조 색상 후보.
 * 하단 검정 그라데이션(거의 #000) 위에 올라가므로 전부 명도 대비 4.5:1 을 넘긴다.
 */
export const ACCENTS = [
  { id: 'lime', name: '형광 초록', hex: '#B9F73E' },
  { id: 'yellow', name: '형광 노랑', hex: '#FDF25C' },
  { id: 'orange', name: '오렌지', hex: '#FFA23A' },
  { id: 'red', name: '레드', hex: '#FF6B6B' },
  { id: 'cyan', name: '시안', hex: '#5FE1FF' },
  { id: 'white', name: '화이트', hex: '#FFFFFF' },
];

export const DEFAULT_ACCENT = ACCENTS[0].hex;

/**
 * 카드형 우상단 마크.
 * 레퍼런스는 파란 별표 하나뿐이지만 계정 성격에 맞춰 고를 수 있게 후보를 둔다.
 * draw 는 캔버스로 직접 그리는 도형(선명하고 색이 브랜드 컬러를 따른다),
 * glyph 는 시스템 이모지 폰트로 그린다.
 */
/**
 * ⚠️ 이모지 마크(🔥 불꽃 · 💡 전구 · ✅ 체크 · 👉 손가락)는 **뺐다** (요청자 지시 2026-08-11).
 *    되살리려면 `{ id, name, glyph }` 형태로 다시 넣으면 된다 — 렌더러의 glyph 경로는 살아 있다.
 *    없앤 id 가 저장돼 있어도 `getMark()` 가 기본값으로 되돌린다.
 */
export const MARKS = [
  { id: 'asterisk', name: '별표', draw: 'asterisk' },
  { id: 'sparkle', name: '반짝임', draw: 'sparkle' },
  { id: 'star', name: '별', draw: 'star' },
  { id: 'dot', name: '점', draw: 'dot' },
  { id: 'plus', name: '십자', draw: 'plus' },
  { id: 'none', name: '없음' },
];

export const DEFAULT_MARK = MARKS[0].id;

/**
 * 카드형 테마 색.
 *
 * 요청자 요구(2026-08-03): 파랑 말고 초록·노랑 같은 색도 고를 수 있게 하고,
 * **한 장을 바꾸면 나머지 장도 같이 바뀌게** 할 것. 그래서 색은 카드마다가 아니라
 * `state.cardTheme` 한 곳에만 둔다.
 *
 * ⚠️ 전부 흰 글씨가 올라가는 색이다. 명도 대비 4.5:1 을 넘겨야 한다.
 *    색을 추가하면 반드시 다시 계산할 것 — 노랑 계열을 밝게 쓰면 바로 미달이다.
 *    그래서 '노랑'은 밝은 노랑이 아니라 짙은 호박색이다.
 */
export const CARD_THEMES = [
  { id: 'blue', name: '파랑', hex: '#2673D2', light: '#8FC4FB' },
  { id: 'green', name: '초록', hex: '#17795C', light: '#8FE0C4' },
  { id: 'amber', name: '노랑', hex: '#9A6700', light: '#FFD98A' },
  { id: 'violet', name: '보라', hex: '#6D46C8', light: '#C9B6FF' },
  { id: 'rose', name: '자주', hex: '#C2185B', light: '#FFB3CE' },
  { id: 'ink', name: '먹색', hex: '#333D4B', light: '#AEB8C4' },
];

export const DEFAULT_CARD_THEME = CARD_THEMES[0].id;

export const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(String(v).trim());

/** 흰색과 섞어 밝은 변형을 만든다 — 표지 그라데이션의 시작 색(`light`)이 필요하다 */
export function lighten(hex, ratio = 0.55) {
  const n = parseInt(String(hex).slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * ratio);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

/** 상대 휘도 (WCAG) */
function luminance(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** 이 색 위에 흰 글씨를 얹었을 때의 명도 대비 — 카드형은 전부 흰 글씨다 */
export function contrastWithWhite(hex) {
  return 1.05 / (luminance(hex) + 0.05);
}

/** 두 색 사이의 명도 대비 — 노트형처럼 배경이 흰색이 아닐 때 쓴다 */
export function contrastOn(fg, bg) {
  const a = luminance(fg) + 0.05;
  const b = luminance(bg) + 0.05;
  return Math.max(a, b) / Math.min(a, b);
}

/**
 * 테마를 찾는다. **미리 정한 id 뿐 아니라 직접 입력한 `#RRGGBB` 도 받는다**
 * (요청자 요구 2026-08-11 — 매거진형 강조 색과 같이 직접 넣을 수 있게).
 *
 * ⚠️ 직접 입력 색은 `light` 가 없으므로 여기서 만들어 준다. 안 만들면 표지 그라데이션이
 *    폴백 파랑(#8FC4FB)으로 떨어져서 **고른 색과 표지 색이 따로 논다.**
 *
 * ⚠️ 직접 입력 색은 **명도 대비를 보장하지 않는다.** 카드형은 전부 흰 글씨라
 *    밝은 색을 넣으면 글이 안 읽힌다. 화면에서 `contrastWithWhite()` 로 경고하되
 *    막지는 않는다 — 강조 색상 직접 입력과 같은 규칙이다(요청자 지시: 막지 말 것).
 *
 * @param {string} id 프리셋 id 또는 `#RRGGBB`
 */
export const getCardTheme = (id) => {
  const found = CARD_THEMES.find((t) => t.id === id);
  if (found) return found;
  if (isHex(id)) {
    const hex = String(id).trim().toUpperCase();
    return { id: hex, name: '직접 입력', hex, light: lighten(hex) };
  }
  return CARD_THEMES[0];
};

/**
 * 노트형 좌상단 심볼.
 *
 * 레퍼런스(쓸모실험실)의 심볼은 **실험실 컨셉의 아이콘**이다 — 굵은 검은 실루엣, 평면, 그림자 없음.
 * 요청자 요구(2026-08-03): 그 무드에 맞는 아이콘을 여러 개 넣어 고를 수 있게 할 것.
 *
 * 실제 브랜드 로고가 아니라 **같은 결의 대체 아이콘**이다. 로고 파일이 생기면
 * 이미지 슬롯으로 넣으면 되고, 그때는 이 심볼 대신 이미지가 그려진다.
 */
export const NOTE_SYMBOLS = [
  // 실험실 무드 — 레퍼런스 계정의 결
  { id: 'flask', name: '플라스크' },
  { id: 'beaker', name: '비커' },
  { id: 'magnifier', name: '돋보기' },
  { id: 'atom', name: '원자' },
  { id: 'gear', name: '톱니바퀴' },
  { id: 'clip', name: '클립보드' },
  // 주제형 — 이 프로젝트의 상품(시상식·인증·TV광고)에 쓰이는 것들
  { id: 'award', name: '트로피' },
  { id: 'medal', name: '인증 도장' },
  { id: 'calendar', name: '달력' },
  { id: 'chart', name: '그래프' },
  { id: 'tv', name: 'TV' },
  { id: 'megaphone', name: '확성기' },
  { id: 'none', name: '없음' },
];

export const DEFAULT_NOTE_SYMBOL = NOTE_SYMBOLS[0].id;

/**
 * 노트형 종이 색.
 * 기존 #F2F2F0 은 누런(브라운) 회색이라는 지적이 있어 계열을 나눴다.
 * 셋 다 밝아서 본문색(#3F3F3D)·부제색(#5F5F5D) 대비는 그대로 유지된다.
 */
export const NOTE_PAPERS = [
  { id: 'white', name: '흰색', hex: '#FAFAF9' },
  { id: 'gray', name: '회색', hex: '#EFEFEE' },
  { id: 'blue', name: '블루 그레이', hex: '#ECF0F4' },
];

export const DEFAULT_NOTE_PAPER = NOTE_PAPERS[0].id;
export const getNotePaper = (id) => NOTE_PAPERS.find((x) => x.id === id) || NOTE_PAPERS[0];

/**
 * 노트형 **글씨 색**(잉크) — 2026-08-20 신설, 요청자 요구.
 *
 * 예전에는 `layout.titleColor` / `bodyColor` 가 코드에 박혀 있어 검정 말고는 쓸 수 없었다.
 * 종이 색은 고를 수 있는데 글씨 색은 못 고르니 짝이 맞지 않았다.
 *
 * ⚠️ 고르는 것은 **잉크 하나**다. 제목·본문·부제·강조 박스 색을 따로 고르게 하면
 *    조합이 금방 무너진다(넷 중 하나만 튀는 카드가 나온다). 하나에서 **파생**시킨다.
 */
export const NOTE_INKS = [
  { id: 'black', name: '검정', hex: '#111111' },
  { id: 'charcoal', name: '차콜', hex: '#2D3138' },
  { id: 'navy', name: '네이비', hex: '#1B2A4A' },
  { id: 'brown', name: '브라운', hex: '#3A2A1E' },
  { id: 'green', name: '딥그린', hex: '#17342A' },
  { id: 'wine', name: '와인', hex: '#4A1D28' },
];

export const DEFAULT_NOTE_INK = NOTE_INKS[0].id;

/** 프리셋 id 또는 직접 입력한 `#RRGGBB` 를 받는다 (카드형 테마 색과 같은 규칙). */
export const getNoteInk = (id) => {
  const found = NOTE_INKS.find((x) => x.id === id);
  if (found) return found;
  if (isHex(id)) {
    const hex = String(id).trim().toUpperCase();
    return { id: hex, name: '직접 입력', hex };
  }
  return NOTE_INKS[0];
};

/**
 * 고른 잉크로 노트형 레이아웃 색을 다시 만든다.
 *
 * 제목·강조 박스는 잉크 그대로, 본문·부제는 **종이 쪽으로 섞어** 한 단계씩 흐리게 한다.
 * 원래 값(제목 #111111 / 본문 #3F3F3D / 부제 #5F5F5D)의 간격을 그대로 옮긴 비율이다.
 *
 * ⚠️ **섞는 비율은 실측으로 정했다.** 잉크 6종 × 종이 3종 = 18조합의 **최악값** 기준이다.
 *    처음에 본문 0.22 / 부제 0.38 로 잡았더니 검정 말고는 부제가 3.84~4.10 으로 기준에 미달했다
 *    (시작 색이 #111111 보다 밝으면 같은 비율이라도 결과가 더 밝게 떨어진다).
 *
 *      비율 0.18 → 최악 6.40:1 (본문)   비율 0.28 → 최악 4.65:1 (부제)
 *      0.30 부터 4.38 로 떨어져 기준을 넘긴다. **올리기 전에 18조합을 다시 잴 것.**
 *
 * ⚠️ 프리셋 6종은 이 비율에서 전부 4.5:1 을 넘긴다. **직접 입력은 보장하지 않는다** —
 *    화면에서 `contrastOn()` 으로 경고하되 막지 않는다(요청자 지시: 막지 말 것).
 */
export function noteLayout(layout, ink) {
  const { hex } = getNoteInk(ink);
  return {
    ...layout,
    titleColor: hex,
    accent: hex,
    bodyColor: lighten(hex, 0.18),
    subColor: lighten(hex, 0.28),
  };
}

/**
 * 종이 결 강도 — 0~100 무단계.
 *
 * 예전엔 4단계(없음/약/보통/강)였고 질감도 2px 점을 흩뿌리는 방식이라 **점무늬로 보였다.**
 * 요청자 지적: "종이결이 점으로만 되어 있다. 바스락거리는 걸로, 강도도 편하게 조절되게."
 * 그래서 (1) 짧은 섬유 선 + 미세 반점으로 바꾸고 (2) 슬라이더로 0~100 을 직접 고르게 했다.
 *
 * 실제 그리기는 lib/cardrender.js 의 paperTexture() 가 한다.
 */
export const DEFAULT_NOTE_GRAIN = 35;

/** 예전 저장값(0~3 단계)을 0~100 으로 올려 준다 */
const LEGACY_GRAIN = { 0: 0, 1: 25, 2: 55, 3: 85 };

/**
 * @param {number|string} v 0~100
 * @returns {{level:number, fibers:number, specks:number, alpha:number}}
 */
export function getNoteGrain(v) {
  let n = Number(v);
  if (!Number.isFinite(n)) n = DEFAULT_NOTE_GRAIN;
  if (Number.isInteger(n) && n <= 3) n = LEGACY_GRAIN[n] ?? DEFAULT_NOTE_GRAIN;
  const level = Math.max(0, Math.min(100, Math.round(n)));
  const k = level / 100;
  return {
    level,
    /**
     * 입자만 쓴다. 넓게 번지는 얼룩(저주파)을 섞었더니 **종이가 우는 것처럼** 보였다.
     * 한쪽이 뭉치면 구겨진 자국으로 읽힌다 — 요청자 지적. 레퍼런스는 전면이 고르다.
     */
    speckle: k * 22,      // 픽셀 단위 밝기 흔들림 — 종이 올(tooth)
    mottle: 0,            // 얼룩 없음 (일부러 0이다. 올리면 우는 느낌이 난다)
    fleck: k * 0.00012,   // 아주 드문 티끌 — 많으면 때 탄 것처럼 보인다
  };
}

/** @param {string} id */
export const getNoteSymbol = (id) => NOTE_SYMBOLS.find((s) => s.id === id) || NOTE_SYMBOLS[0];

/** @param {string} id */
export const getMark = (id) => MARKS.find((m) => m.id === id) || MARKS[0];

/**
 * ⚠️ `ref` 는 **화면에 그리지 않는다** (2026-08-14, 요청자 지시:
 *    "각 플랫폼 밑에 참고는 왜 적어 둔 건지 모르겠다. 다 제거해줘").
 *    남의 인스타 계정을 우리 화면에 적어 둘 이유가 없다 — 프로필 유형 카드에서 `refs` 를
 *    뺀 것(2026-08-13)과 같은 판단이다.
 *    값은 **어느 계정을 보고 만든 배치인지 적어 둔 기록**이라 남긴다. 화면에 되살리지 말 것.
 */
export const CONCEPTS = [
  {
    id: 'magazine',
    badge: 'A',
    name: '매거진형',
    ref: 'ai.brief.kr',
    desc: '실사 사진 위 하단 검정 그라데이션. 상단 중앙 계정명, 흰 제목 + 형광색 강조 한 줄.',
    mood: '후킹 최강. 스크롤을 멈춰 세워야 하는 뉴스·이슈형 콘텐츠에 잘 맞습니다.',
    accentPicker: true,        // 강조 색상을 고를 수 있는 유일한 컨셉
    style: [
      'cinematic editorial news photograph, dramatic directional lighting, rich saturated colors',
      'wide dynamic composition, high detail, magazine cover quality',
      'darker tone toward the bottom of the frame for text legibility',
      NO_TEXT,
    ].join(', '),
    layout: {
      surface: '#0B0F14',
      titleColor: '#FFFFFF',
      bodyColor: '#FFFFFF',
      subColor: 'rgba(255,255,255,0.92)',
      overlay: 'bottom-dark',
    },
  },
  {
    id: 'card',
    badge: 'B',
    name: '카드형',
    ref: 'soosangmarket',
    desc: '하단 파랑 그라데이션. 2페이지부터 파란 박스(대주제) + 흰 박스(소주제), 마지막은 파랑 단색 팔로우 유도.',
    mood: '정보 전달. 순서대로 읽히는 정리형 콘텐츠에 잘 맞습니다.',
    style: [
      'bright natural documentary photograph, clear daylight, open sky or wide scene',
      'clean uncluttered composition with generous empty space in the middle and lower area',
      'cool blue leaning color grading',
      NO_TEXT,
    ].join(', '),
    /**
     * 레퍼런스의 파랑은 #3B93F7 이지만 흰 글씨 대비가 3.13:1 이라 요청자 지정 기준(4.5:1)에 못 미친다.
     * 큰 글씨만 올라가서 WCAG 기준으로는 통과하지만(3:1) 여유가 없어 한 단계 낮춘 값을 쓴다 — 4.7:1.
     * 레퍼런스 색으로 되돌리려면 아래 두 줄만 #3B93F7 / #2E8BF7 로 바꾸면 된다.
     */
    layout: {
      surface: '#2673D2',      // 마무리 카드의 단색 배경
      brand: '#2673D2',        // 대주제 박스 · 그라데이션 · 별표 마크
      titleColor: '#FFFFFF',
      bodyColor: '#191F28',    // 흰 박스 안 검은 글씨
      panel: '#FFFFFF',
      overlay: 'bottom-brand',
    },
  },
  {
    id: 'note',
    badge: 'C',
    name: '노트형',
    ref: 'sslmo.lab',
    desc: '종이 배경에 검은 글씨. 미니멀 아이콘 + 대주제 + 본문. 번호·강조로 끊어 읽게 만듭니다.',
    mood: '담백·솔직. 정보를 조곤조곤 풀어주는 콘텐츠에 잘 맞습니다.',
    style: [
      'hand-drawn black ink illustration, thick bold outlines, flat monochrome, no color',
      'single simple centered subject on a plain off-white background, generous empty space',
      'minimal icon-like shape, high contrast, no shading',
      NO_TEXT,
    ].join(', '),
    layout: {
      surface: '#F2F2F0',      // 종이
      titleColor: '#111111',
      bodyColor: '#3F3F3D',
      // #8A8A88 은 종이 배경에서 2.9:1 이라 부제에 쓸 수 없다 → 5.6:1 인 값으로 올렸다
      subColor: '#5F5F5D',
      accent: '#111111',
      overlay: 'paper',
    },
  },
  /**
   * 직관형 — **다른 셋과 성격이 다르다.** 카드를 그리지 않고 이미지 프롬프트만 만든다.
   *
   * 레퍼런스: 바탕화면 `concept_직관형` 9장(요청자 제공, 2026-08-20). 말풍선 후킹 · 극태
   * 헤드라인 · 큰 숫자 · 체크리스트 · 하단 CTA 바가 **글자까지 전부 이미지 안에** 들어 있는
   * 한국형 성과 광고 배너다. 캔버스가 배경 위에 글자를 얹는 방식으로는 나올 수 없는 배치라,
   * 요청자 판단대로 템플릿이 아니라 **프롬프트 생성기**로 만들었다 (`lib/adprompt.js`).
   *
   * ⚠️ `promptOnly` 를 보고 `pages/template.js` 가 화면을 통째로 갈아 끼운다. 이 값을 빼면
   *    캔버스 편집 화면이 뜨는데, 직관형에는 슬롯 정의(`lib/templates.js`)가 없어서
   *    매거진형 슬롯으로 떨어진다 — 고장 난 것처럼 보인다.
   * ⚠️ `style` 은 비워 둔다. `lib/imageprompt.js` 는 직관형을 그리지 않는다.
   */
  {
    id: 'intuitive',
    badge: 'D',
    name: '직관형',
    ref: 'concept_직관형 (요청자 제공 레퍼런스 9장)',
    desc: '글자까지 이미지 안에 들어가는 한국형 광고 배너. 카드를 그리지 않고 이미지 프롬프트를 원하는 장수만큼 만듭니다.',
    mood: '즉각 반응. 문의·전환을 노리는 성과 광고에 잘 맞습니다.',
    promptOnly: true,
    style: '',
    layout: {
      surface: '#FAF3E3',
      titleColor: '#111111',
      bodyColor: '#111111',
      subColor: '#4A4A46',
      accent: '#E8391F',
    },
  },
];

/** @param {string} id */
export const getConcept = (id) => CONCEPTS.find((c) => c.id === id) || CONCEPTS[0];

/** 매거진형만 강조 색상을 쓴다. 나머지는 자기 레이아웃 색을 유지한다. */
export function accentOf(concept, chosen) {
  if (!concept.accentPicker) return concept.layout.accent || concept.layout.brand || '#FFFFFF';
  return chosen || DEFAULT_ACCENT;
}
