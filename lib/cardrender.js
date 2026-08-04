/**
 * 카드뉴스 렌더러 — Canvas 2D로 1080x1350(4:5) PNG를 직접 그린다.
 *
 * 4:5 를 쓰는 이유: 레퍼런스 세 계정이 모두 세로형이고, 인스타 피드에서 화면을 크게 차지한다.
 *
 * 외부 라이브러리를 쓰지 않으므로 한글 줄바꿈과 글자 크기 자동 축소를 직접 구현한다.
 * 배경은 3단계에서 준비한 이미지를 깔고, 없으면 컨셉별 배경으로 폴백한다.
 *
 * 템플릿마다 장(page)의 역할에 따라 배치가 다르다 — lib/templates.js 의 roleOf() 와 짝을 이룬다.
 *   매거진형  모든 장 동일       상단 계정명 · 하단 검정 그라데이션 · 흰 제목 + 형광 강조
 *   카드형    표지/본문/마무리   파랑 그라데이션 · 파란 박스(중앙)+흰 박스 · 파랑 단색 팔로우
 *   노트형    표지/본문          종이 배경 · 아이콘 · 아주 굵은 제목 + 회색 본문 + 검정 하이라이트 바
 */
import { getConcept, accentOf, getMark, getCardTheme, getNoteSymbol, getNotePaper, getNoteGrain } from './concepts.js';
import { roleOf } from './templates.js';

export const W = 1080;
export const H = 1350;
const PAD = 88;
const MAXW = W - PAD * 2;

const C = {
  white: '#FFFFFF',
  dark: '#1B64DA',
};

const FONT = (weight, size) => `${weight} ${size}px 'Noto Sans KR', sans-serif`;
/** 이모지는 한글 폰트에 없어서 시스템 이모지 폰트로 넘긴다 */
const EMOJI_FONT = (size) => `${size}px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`;

/** 웹폰트가 로드되기 전에 그리면 기본 폰트로 렌더되므로 반드시 먼저 기다린다 */
export async function ensureFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load(FONT(900, 78)),   // 제목은 900 — 700 은 레퍼런스보다 얇다
    document.fonts.load(FONT(700, 40)),
    document.fonts.load(FONT(500, 34)),
    document.fonts.load(FONT(400, 38)),
  ]);
  await document.fonts.ready;
}

/* ---------------- 텍스트 ---------------- */

/**
 * 한글은 단어 경계가 공백으로 보장되지 않아 글자 단위로 줄을 만든다.
 *
 * 공백에서 끊으면 영문·숫자가 어색하게 잘리지 않지만, 공백이 줄 앞쪽에 있으면
 * 오른쪽이 크게 비어 박스가 헐거워 보인다. 그래서 '공백까지의 폭이 충분히 찼을 때만'
 * 공백에서 끊고, 아니면 글자 단위로 끊는다.
 */
function wrap(g, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (line && g.measureText(test).width > maxW) {
        const sp = line.lastIndexOf(' ');
        if (sp > 0 && g.measureText(line.slice(0, sp)).width >= maxW * 0.82) {
          lines.push(line.slice(0, sp));
          line = line.slice(sp + 1) + ch;
        } else {
          lines.push(line);
          line = ch;
        }
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * 주어진 영역에 들어가는 가장 큰 글자 크기를 고른다.
 * weight·lh 를 결과에 함께 담는다 — 여러 블록을 먼저 재고 나중에 그리는 배치에서
 * draw() 가 자기 폰트를 스스로 복구해야 하기 때문이다.
 */
function fit(g, text, { maxW, maxLines, sizes, weight, lh }) {
  for (const size of sizes) {
    g.font = FONT(weight, size);
    const lines = wrap(g, text, maxW);
    if (lines.length <= maxLines) return { lines, size, height: lines.length * size * lh, weight, lh };
  }
  const size = sizes.at(-1);
  g.font = FONT(weight, size);
  const lines = wrap(g, text, maxW).slice(0, maxLines);
  lines[lines.length - 1] = lines.at(-1).slice(0, -1) + '…';
  return { lines, size, height: lines.length * size * lh, weight, lh };
}

/**
 * 두 문장을 같은 크기로 맞춰 잰다.
 * 매거진형의 흰 제목과 형광 강조줄은 한 덩어리로 읽혀야 해서 크기가 달라지면 안 된다.
 */
function fitPair(g, a, b, { maxW, maxLines, sizes, weight, lh }) {
  for (const size of sizes) {
    g.font = FONT(weight, size);
    const la = a ? wrap(g, a, maxW) : [];
    const lb = b ? wrap(g, b, maxW) : [];
    if (la.length + lb.length <= maxLines) {
      return { la, lb, size, weight, lh, height: (la.length + lb.length) * size * lh };
    }
  }
  const size = sizes.at(-1);
  g.font = FONT(weight, size);
  let la = a ? wrap(g, a, maxW) : [];
  let lb = b ? wrap(g, b, maxW) : [];
  while (la.length + lb.length > maxLines && lb.length > 1) lb.pop();
  while (la.length + lb.length > maxLines && la.length > 1) la.pop();
  return { la, lb, size, weight, lh, height: (la.length + lb.length) * size * lh };
}

/**
 * 글자 덩어리를 '박스 기준 세로 중앙'에 놓기 위한 보정값.
 *
 * draw()·drawRich() 는 줄마다 **먼저 행간만큼 내려간 뒤** 그린다.
 * 그래서 첫 줄 위에는 행간이 통째로 여백으로 남고 마지막 줄 아래는 거의 붙는다.
 * 그대로 두면 글이 박스 중앙보다 아래로 쏠려 보인다 — 요청자가 두 번 지적한 부분이다.
 *
 * 위·아래 여백 차이의 절반만큼 올린다. 한글 기준 대문자 높이 0.73em, 하강부 0.12em 로 잡았다.
 */
function centerLift(size, lh) {
  return (size * (lh - 0.7 * (lh - 1) - 0.61)) / 2;
}

/** fit 결과를 실제로 그리고 다음 y 좌표를 돌려준다 */
function draw(g, block, { x, y, color, lh = block.lh, align = 'left', boxW = 0 }) {
  g.font = FONT(block.weight, block.size);
  g.fillStyle = color;
  g.textBaseline = 'alphabetic';
  let cur = y;
  for (const line of block.lines) {
    cur += block.size * lh;
    const lx = align === 'center' ? x + (boxW - g.measureText(line).width) / 2 : x;
    g.fillText(line, lx, cur - block.size * (lh - 1) * 0.35);
  }
  return cur;
}

/** fitPair 의 두 덩어리를 색만 달리해 이어 그린다 */
function drawPair(g, pair, { x, y, colorA, colorB }) {
  g.font = FONT(pair.weight, pair.size);
  g.textBaseline = 'alphabetic';
  let cur = y;
  const put = (lines, color) => {
    g.fillStyle = color;
    for (const line of lines) {
      cur += pair.size * pair.lh;
      g.fillText(line, x, cur - pair.size * (pair.lh - 1) * 0.35);
    }
  };
  put(pair.la, colorA);
  put(pair.lb, colorB);
  return cur;
}

/* ---------------- 도형 ---------------- */

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function circle(g, cx, cy, r) {
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
}

/** 뾰족한 별 — points 갈래, 안쪽 반지름 비율 inner */
function spikes(g, cx, cy, r, points, inner) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 ? r * inner : r;
    const a = (Math.PI / points) * i - Math.PI / 2;
    const fn = i ? 'lineTo' : 'moveTo';
    g[fn](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
}

/** 카드형 우상단 마크 — 도형이면 그리고, 이모지면 글자로 찍는다 */
function drawMark(g, markId, { cx, cy, r, color }) {
  const m = getMark(markId);
  if (m.id === 'none') return;

  if (m.glyph) {
    g.font = EMOJI_FONT(r * 2);
    g.textBaseline = 'middle';
    g.fillText(m.glyph, cx - g.measureText(m.glyph).width / 2, cy + 2);
    g.textBaseline = 'alphabetic';
    return;
  }

  g.fillStyle = color;
  if (m.draw === 'dot') { circle(g, cx, cy, r * 0.72); return; }
  if (m.draw === 'star') { spikes(g, cx, cy, r, 5, 0.45); return; }
  if (m.draw === 'sparkle') { spikes(g, cx, cy, r, 4, 0.28); return; }

  // asterisk(6갈래) · plus(십자) — 막대를 회전시켜 그린다
  const bars = m.draw === 'plus' ? 2 : 3;
  const arm = r * (m.draw === 'plus' ? 0.3 : 0.36);
  g.save();
  g.translate(cx, cy);
  if (bars === 2) g.rotate(Math.PI / 2);
  for (let i = 0; i < bars; i++) {
    g.rotate(Math.PI / bars);
    roundRect(g, -arm / 2, -r, arm, r * 2, arm / 2);
    g.fill();
  }
  g.restore();
}

/** #RRGGBB → rgba() — 그라데이션 정지점에 투명도를 주려면 필요하다 */
function hexA(hex, a) {
  const n = parseInt(String(hex).slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** 알약 라벨 */
function pill(g, text, { x, y, bg, fg, size = 30, border = null, borderW = 2 }) {
  g.font = FONT(700, size);
  const padX = 30;
  const h = size + 30;
  const w = g.measureText(text).width + padX * 2;
  if (bg) {
    g.fillStyle = bg;
    roundRect(g, x, y, w, h, h / 2);
    g.fill();
  }
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = borderW;
    roundRect(g, x + borderW / 2, y + borderW / 2, w - borderW, h - borderW, (h - borderW) / 2);
    g.stroke();
  }
  g.fillStyle = fg;
  g.textBaseline = 'middle';
  g.fillText(text, x + padX, y + h / 2 + 1);
  g.textBaseline = 'alphabetic';
  return { w, h };
}

/* ---------------- 서식 있는 본문 (노트형) ---------------- */

/** `**강조**` 를 굵은 조각으로 나눈다 */
function parseInline(line) {
  const runs = [];
  for (const part of String(line).split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    const strong = part.startsWith('**') && part.endsWith('**') && part.length > 4;
    runs.push({ text: strong ? part.slice(2, -2) : part, strong });
  }
  return runs.length ? runs : [{ text: '', strong: false }];
}

/**
 * 본문을 문단·번호항목·하이라이트 바·빈 줄로 나눈다.
 *   `> 문장`   → 검정 하이라이트 바 (레퍼런스에서 가장 눈에 띄는 요소)
 *   `1. 문장`  → 번호 박스
 *   `**강조**` → 굵고 진하게
 */
function parseBody(text) {
  return String(text).split('\n').map((raw) => {
    const line = raw.trimEnd();
    if (!line.trim()) return { type: 'gap' };
    const bar = line.match(/^\s*>\s?(.*)$/);
    if (bar) return { type: 'bar', runs: parseInline(bar[1]) };
    const num = line.match(/^\s*(\d{1,2})[.)]\s+(.*)$/);
    if (num) return { type: 'num', n: num[1], runs: parseInline(num[2]) };
    return { type: 'p', runs: parseInline(line) };
  });
}

/** 조각들을 글자 단위로 흘려보내며 줄을 만든다 (이모지는 for..of 가 한 글자로 센다) */
function layoutRuns(g, runs, maxW, size, weightNormal, weightStrong) {
  const lines = [];
  let cur = [];
  let curW = 0;
  let piece = null;

  const flushPiece = () => { if (piece) { cur.push(piece); piece = null; } };
  const breakLine = () => { flushPiece(); lines.push(cur); cur = []; curW = 0; };

  for (const run of runs) {
    const font = FONT(run.strong ? weightStrong : weightNormal, size);
    for (const ch of run.text) {
      g.font = font;
      const w = g.measureText(ch).width;
      if (curW + w > maxW && (cur.length || piece)) {
        breakLine();
        if (ch === ' ') continue;
      }
      if (!piece || piece.strong !== run.strong) {
        flushPiece();
        piece = { text: '', strong: run.strong };
      }
      piece.text += ch;
      curW += w;
    }
    flushPiece();
  }
  if (cur.length || !lines.length) lines.push(cur);
  return lines;
}

const lineWidth = (g, line, size, wn, ws) => line.reduce((sum, p) => {
  g.font = FONT(p.strong ? ws : wn, size);
  return sum + g.measureText(p.text).width;
}, 0);

const NUM = (size) => ({ w: size * 1.55, h: size * 1.55, gap: size * 0.72 });
const BAR = (size) => ({ padX: size * 0.85, padY: size * 0.58, gapTop: size * 0.7, gapBottom: size * 0.55 });

/** 주어진 크기로 본문 전체를 배치했을 때의 줄 목록과 높이 */
function layoutRich(g, blocks, { maxW, size, lh }) {
  const num = NUM(size);
  const bar = BAR(size);
  const rows = [];
  let h = 0;

  for (const b of blocks) {
    if (b.type === 'gap') { rows.push({ type: 'gap', h: size * 0.8 }); h += size * 0.8; continue; }

    if (b.type === 'bar') {
      const lines = layoutRuns(g, b.runs, maxW - bar.padX * 2, size, 700, 700);
      let inner = 0;
      lines.forEach((l) => { inner = Math.max(inner, lineWidth(g, l, size, 700, 700)); });
      const boxH = lines.length * size * 1.34 + bar.padY * 2;
      const rowH = bar.gapTop + boxH + bar.gapBottom;
      rows.push({ type: 'bar', lines, boxH, boxW: Math.min(inner + bar.padX * 2, maxW), bar, h: rowH });
      h += rowH;
      continue;
    }

    const indent = b.type === 'num' ? num.w + num.gap : 0;
    const lines = layoutRuns(g, b.runs, maxW - indent, size, 400, 700);
    const rowH = lines.length * size * lh + (b.type === 'num' ? size * 0.4 : 0);
    rows.push({ type: b.type, n: b.n, lines, indent, num, h: rowH });
    h += rowH;
  }
  return { rows, height: h, size, lh };
}

/**
 * 영역에 들어가는 가장 큰 크기를 고른다.
 *
 * 가장 작은 크기로도 넘치면 **뒤에서부터 덜어낸다.** 예전엔 넘치는 배치를 그대로 돌려줘서
 * 본문이 카드 밖으로 흘러나갔다. 기본 문구를 길게 만들면서 실제로 넘칠 수 있게 됐다.
 */
function fitRich(g, blocks, { maxW, maxH, sizes, lh }) {
  let last = null;
  for (const size of sizes) {
    last = layoutRich(g, blocks, { maxW, size, lh });
    if (last.height <= maxH) return last;
  }
  while (last.rows.length > 1 && last.height > maxH) {
    last.height -= last.rows.pop().h;
  }
  return last;
}

function drawRich(g, laid, { x, y, maxW, color, strongColor, boxBg, boxFg, weight = 400, strongWeight = 700 }) {
  const { size, lh } = laid;
  let cur = y;

  for (const row of laid.rows) {
    if (row.type === 'gap') { cur += row.h; continue; }

    if (row.type === 'bar') {
      cur += row.bar.gapTop;
      g.fillStyle = boxBg;
      roundRect(g, x, cur, row.boxW, row.boxH, 8);
      g.fill();
      // draw() 와 같은 이유로 글이 박스 아래로 쏠린다 — 위·아래 여백 차이의 절반만큼 올린다.
      // 요청자 지적: "하이라이트 바 글자가 네모칸 중앙보다 아래에 있다."
      let ty = cur + row.bar.padY - centerLift(size, 1.34);
      for (const line of row.lines) {
        ty += size * 1.34;
        let cx = x + row.bar.padX;
        for (const p of line) {
          g.font = FONT(Math.max(strongWeight, 700), size);
          g.fillStyle = boxFg;
          g.fillText(p.text, cx, ty - size * 0.34 * 0.35);
          cx += g.measureText(p.text).width;
        }
      }
      cur += row.boxH + row.bar.gapBottom;
      continue;
    }

    if (row.type === 'num') {
      g.fillStyle = boxBg;
      roundRect(g, x, cur + size * 0.16, row.num.w, row.num.h, 7);
      g.fill();
      g.font = FONT(700, size * 0.84);
      g.fillStyle = boxFg;
      g.textBaseline = 'middle';
      g.fillText(row.n, x + row.num.w / 2 - g.measureText(row.n).width / 2, cur + size * 0.16 + row.num.h / 2 + 1);
      g.textBaseline = 'alphabetic';
    }

    for (const line of row.lines) {
      cur += size * lh;
      let cx = x + row.indent;
      for (const p of line) {
        g.font = FONT(p.strong ? strongWeight : weight, size);
        g.fillStyle = p.strong ? strongColor : color;
        g.fillText(p.text, cx, cur - size * (lh - 1) * 0.35);
        cx += g.measureText(p.text).width;
      }
    }
    if (row.type === 'num') cur += size * 0.4;
  }
  return cur;
}

/* ---------------- 배경 ---------------- */

/**
 * Blob 을 캔버스에 그릴 수 있는 형태로 바꾼다.
 * createImageBitmap 이 막힌 환경을 위해 <img> 폴백을 둔다.
 */
export async function loadImage(blob) {
  if (!blob) return null;
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* 아래 폴백으로 내려간다 */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했습니다.')); };
    img.src = url;
  });
}

/** object-fit: cover — 프레임을 꽉 채우고 넘치는 쪽은 잘린다 */
function drawCover(g, img) {
  const iw = img.width;
  const ih = img.height;
  if (!iw || !ih) return;
  const scale = Math.max(W / iw, H / ih);
  const w = iw * scale;
  const h = ih * scale;
  g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

/** object-fit: contain — 잘리지 않게 상자 안에 넣고 가운데 정렬 (노트형 아이콘) */
function drawContain(g, img, { x, y, w, h }) {
  const iw = img.width;
  const ih = img.height;
  if (!iw || !ih) return;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/**
 * 씨앗 고정 난수 (mulberry32).
 * 렌더는 결정적이어야 한다 — 같은 카드를 다시 그렸을 때 무늬가 달라지면 안 된다.
 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 종이 질감 — 요청자가 준 수채 용지 사진과 같은 결.
 *
 * 두 번 헛짚었다. 처음엔 2px 사각형을 흩뿌려 **점무늬**로 보였고,
 * 다음엔 짧은 선을 그어 **긁힌 자국**처럼 보였다. 레퍼런스는 둘 다 아니다 —
 * 방향이 없는 **아주 고운 입자**와 넓게 번지는 옅은 얼룩이다.
 *
 * 그래서 도형을 그리지 않고 픽셀을 직접 흔든다:
 *   1. 저주파 얼룩 — 성긴 난수 격자를 보간해 넓게 번지는 밝기 차이를 만든다
 *   2. 픽셀 입자 — 한 픽셀씩 밝기를 흔들어 종이 올을 만든다
 *   3. 티끌 — 드물게 짙은 점 하나
 *
 * 150만 픽셀을 매번 훑으므로 **결과를 캐시한다.** 종이색·강도가 그대로면 다시 만들지 않는다.
 */
/** 최대 강도에서의 밝기 흔들림 폭 — 저장할 때 이 값으로 정규화한다 */
const GRAIN_SPAN = 14.5;

/**
 * 무늬는 강도와 무관하게 **한 번만** 만든다.
 * 예전엔 강도를 바꿀 때마다 난수를 150만 번 다시 돌려 한 장에 180ms 가 걸렸다.
 * 슬라이더를 끄는 동안 그 값이 계속 바뀌므로 눈에 띄게 버벅였다.
 */
let noiseCache = null;

function grainNoise() {
  if (noiseCache) return noiseCache;
  const rand = rng(20260804);
  const n = W * H;
  const noise = new Int8Array(n);
  const flecks = [];

  /**
   * **저주파 얼룩을 일부러 넣지 않는다.**
   * 성긴 격자를 보간해 넓게 번지는 밝기 차이를 넣었더니 종이가 구겨져 보였다("우는 느낌").
   * 레퍼런스 종이는 전면이 고르고 입자만 살아 있다. 얼룩을 다시 넣지 말 것.
   */
  for (let i = 0; i < n; i++) {
    const v = (rand() - 0.5) * 22;          // 최대 강도 기준 ±11
    noise[i] = Math.max(-127, Math.min(127, Math.round((v / GRAIN_SPAN) * 127)));
    // 티끌은 드물어서 배열에 담지 않고 좌표만 모아 둔다
    if (rand() < 0.00012) flecks.push(i, 14 + rand() * 18, rand());
  }

  noiseCache = { noise, flecks };
  return noiseCache;
}

let paperCache = null;

function paperCanvas(paper, grain) {
  const key = `${paper.hex}|${grain.level}`;
  if (paperCache && paperCache.key === key) return paperCache.canvas;

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const cg = cv.getContext('2d');
  cg.fillStyle = paper.hex;
  cg.fillRect(0, 0, W, H);

  if (grain.level) {
    const k = grain.level / 100;
    const { noise, flecks } = grainNoise();
    const img = cg.getImageData(0, 0, W, H);
    const d = img.data;
    const amp = (GRAIN_SPAN / 127) * k;

    for (let i = 0, j = 0; i < noise.length; i++, j += 4) {
      const delta = noise[i] * amp;
      d[j] = clamp255(d[j] + delta);
      d[j + 1] = clamp255(d[j + 1] + delta);
      d[j + 2] = clamp255(d[j + 2] + delta);
    }
    // 티끌은 강도가 올라갈수록 더 많이 드러난다
    for (let f = 0; f < flecks.length; f += 3) {
      if (flecks[f + 2] > k) continue;
      const j = flecks[f] * 4;
      const depth = flecks[f + 1];
      d[j] = clamp255(d[j] - depth);
      d[j + 1] = clamp255(d[j + 1] - depth);
      d[j + 2] = clamp255(d[j + 2] - depth);
    }
    cg.putImageData(img, 0, 0);
  }

  paperCache = { key, canvas: cv };
  return cv;
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function fallbackBg(g, conceptId, L, theme, paper, grain) {
  if (conceptId === 'note') {
    /**
     * 레퍼런스 10장은 **얼룩 없는 균일한 종이**다. 예전엔 큰 원 두 개를 깔았는데 전혀 달라 보였다.
     * 지금은 색과 결(자글자글) 강도를 요청자가 고른다 — `notePaper` / `noteGrain`.
     * 점 위치는 소수 곱셈으로 만들어 **매번 같은 무늬**가 나온다(렌더가 결정적이어야 한다).
     */
    g.drawImage(paperCanvas(paper, grain), 0, 0);
    return;
  }
  if (conceptId === 'card') {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme?.light || '#8FC4FB');
    grad.addColorStop(1, theme?.hex || L.brand);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    return;
  }
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#16202B');
  grad.addColorStop(1, L.surface);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}

/** 글자가 얹힐 하단의 대비를 확보한다 */
function bottomScrim(g, color, { from = 0.3, mid = 0.6, midA = 0.55, endA = 0.92 } = {}) {
  const grad = g.createLinearGradient(0, H * from, 0, H);
  grad.addColorStop(0, hexA(color, 0));
  grad.addColorStop(mid, hexA(color, midA));
  grad.addColorStop(1, hexA(color, endA));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}

/* ============================================================
   매거진형 — 모든 장이 같은 구조
   ============================================================ */

function renderMagazine(g, t, L, accent, image) {
  if (image) drawCover(g, image);
  else fallbackBg(g, 'magazine', L);
  bottomScrim(g, '#000000', { from: 0.26, mid: 0.62, midA: 0.55, endA: 0.9 });

  if (t.brand) {
    g.font = FONT(900, 36);
    g.fillStyle = C.white;
    g.textBaseline = 'alphabetic';
    g.fillText(t.brand, (W - g.measureText(t.brand).width) / 2, PAD + 34);
  }

  const handleH = t.footer ? 62 : 0;
  const bottom = H - PAD - handleH;

  // 레퍼런스는 짧은 두 줄이다. 줄 수를 늘리면 행간이 무너지므로 4줄까지만 허용한다.
  const pair = fitPair(g, t.title, t.highlight, {
    maxW: MAXW, maxLines: 4, sizes: [82, 74, 66, 58], weight: 900, lh: 1.2,
  });
  const pillH = t.eyebrow ? 60 : 0;
  const gapPill = t.eyebrow ? 28 : 0;

  let y = bottom - (pillH + gapPill + pair.height);
  if (t.eyebrow) {
    pill(g, t.eyebrow, {
      x: PAD, y, bg: 'rgba(0,0,0,0.42)', fg: C.white, border: 'rgba(255,255,255,0.72)', borderW: 2,
    });
    y += pillH + gapPill;
  }
  drawPair(g, pair, { x: PAD, y, colorA: L.titleColor, colorB: accent });

  if (t.footer) {
    g.font = FONT(500, 30);
    g.fillStyle = L.subColor;
    g.fillText(t.footer, PAD, H - PAD);
  }
}

/* ============================================================
   카드형 — 표지 / 본문 / 마무리
   ============================================================ */

function cardHandle(g, text) {
  if (!text) return;
  g.font = FONT(700, 32);
  g.fillStyle = C.white;
  g.textBaseline = 'alphabetic';
  g.fillText(text, PAD, H - PAD);
}

/**
 * 카드형 표지 — 레퍼런스(soosangmarket) 표지 3장의 구조.
 *
 *   배경 사진 → 하단 테마색 그라데이션 → 우상단 마크
 *   → 하단에 테두리 알약(라벨) → 그 아래 아주 큰 흰 제목 → 좌하단 계정
 *
 * ⚠️ 표지를 본문과 같은 배치로 합쳤다가 되돌렸다(2026-08-03). 요청자 지적:
 *    "카드형 표지는 기존 작업이 맞다." 본문만 상단 알약 + 하단 흰 박스다.
 */
function renderCardCover(g, t, L, image, markId, theme) {
  if (image) drawCover(g, image);
  else fallbackBg(g, 'card', L, theme);
  bottomScrim(g, theme.hex, { from: 0.34, mid: 0.66, midA: 0.62, endA: 1 });

  drawMark(g, markId, { cx: W - PAD - 26, cy: PAD + 26, r: 42, color: theme.hex });

  const handleH = t.footer ? 64 : 0;
  // 레퍼런스는 제목 아래에 여백이 한 뼘 더 있다. 바닥에 붙이면 답답해 보인다 — 요청자 지적.
  const TITLE_LIFT = 64;
  const bottom = H - PAD - handleH - TITLE_LIFT;
  const title = fit(g, t.title, { maxW: MAXW, maxLines: 4, sizes: [80, 72, 64, 56], weight: 900, lh: 1.3 });
  const pillH = t.eyebrow ? 58 : 0;
  const gapPill = t.eyebrow ? 26 : 0;

  let y = bottom - (pillH + gapPill + title.height);
  if (t.eyebrow) {
    pill(g, t.eyebrow, { x: PAD, y, bg: null, fg: C.white, size: 28, border: C.white, borderW: 2.5 });
    y += pillH + gapPill;
  }
  draw(g, title, { x: PAD, y, color: L.titleColor });
  cardHandle(g, t.footer);
}

/**
 * 카드형 본문 — 레퍼런스 본문 카드의 구조.
 *
 * 요청자가 준 카드 5장을 보면 표지든 본문이든 배치가 같다.
 *   배경 사진 → 상단에 테마색 알약(제목) → 하단에 흰 박스(본문) → 좌하단 계정
 *
 * 예전 구현은 표지와 본문을 따로 만들어서(표지는 하단 큰 제목, 본문은 가운데 파란 박스)
 * 레퍼런스와 레이아웃이 어긋났다. 요청자 지적 그대로다.
 *
 * ⚠️ 본문 글씨는 500 이상으로 그린다. 400 으로 그렸더니 배경 위 흰 박스에서 눈에 띄게 얇았다.
 * ⚠️ 색은 `theme` 하나로 들어온다. 카드마다 따로 두지 않는다 — 한 장을 바꾸면 전부 바뀌어야 한다.
 */
function renderCardPage(g, t, L, image, markId, theme) {
  if (image) drawCover(g, image);
  else fallbackBg(g, 'card', L, theme);

  // 배경이 밝아도 흰 박스가 떠 보이도록 아주 옅게만 깐다
  bottomScrim(g, theme.hex, { from: 0.42, mid: 0.78, midA: 0.18, endA: 0.42 });

  drawMark(g, markId, { cx: W - PAD - 26, cy: PAD + 26, r: 42, color: theme.hex });

  // ── 상단 알약 제목 ──
  const headY = PAD + 92;
  let headBottom = headY;
  if (t.title) {
    const head = fit(g, t.title, {
      maxW: MAXW - 76, maxLines: 2, sizes: [44, 40, 36, 32], weight: 900, lh: 1.3,
    });
    g.font = FONT(head.weight, head.size);
    let inner = 0;
    head.lines.forEach((l) => { inner = Math.max(inner, g.measureText(l).width); });

    const padX = 34;
    const padY = 20;
    const boxW = Math.min(inner + padX * 2, MAXW);
    const boxH = head.height + padY * 2;

    g.fillStyle = theme.hex;
    roundRect(g, PAD, headY, boxW, boxH, 14);
    g.fill();
    draw(g, head, { x: PAD + padX, y: headY + padY - centerLift(head.size, head.lh), color: C.white });
    headBottom = headY + boxH;
  }

  // ── 하단 흰 박스 ──
  const BP = 42;
  const handleH = t.footer ? 66 : 0;
  const srcH = t.source ? 34 : 0;
  const boxBottom = H - PAD - handleH;

  if (t.body) {
    const blocks = parseBody(t.body);
    const maxH = boxBottom - (headBottom + 40) - BP * 2 - srcH;
    const body = fitRich(g, blocks, { maxW: MAXW - BP * 2, maxH, sizes: [34, 32, 30, 28, 26, 24], lh: 1.72 });
    const boxH = body.height + BP * 2 + srcH;
    const boxY = Math.max(boxBottom - boxH, headBottom + 40);

    g.fillStyle = L.panel;
    roundRect(g, PAD, boxY, MAXW, boxH, 12);
    g.fill();

    /**
     * ⚠️ 박스 위치·크기는 그대로 두고 **글자만** 위로 당긴다.
     *
     * drawRich 는 줄마다 먼저 lh 만큼 내려간 뒤 그린다. 그래서 첫 줄 위에 lh 여백이
     * 통째로 생기고 마지막 줄 아래는 거의 붙어, 글이 박스 중앙보다 아래로 쏠려 보였다.
     * 요청자 지적 그대로다. 위아래 여백 차이의 절반만큼 올려 맞춘다.
     */
    const lift = centerLift(body.size, body.lh);
    drawRich(g, body, {
      x: PAD + BP, y: boxY + BP - lift, maxW: MAXW - BP * 2,
      color: L.bodyColor, strongColor: '#000000', boxBg: theme.hex, boxFg: C.white,
      weight: 600, strongWeight: 900,   // 사진 위 흰 박스라 400 으로는 눈에 띄게 얇다
    });

    // 출처는 레퍼런스처럼 박스 오른쪽 아래에 아주 작게
    if (t.source) {
      g.font = FONT(500, 22);
      g.fillStyle = '#8B95A1';
      const tw = g.measureText(t.source).width;
      g.textBaseline = 'alphabetic';
      g.fillText(t.source, PAD + MAXW - BP - tw, boxY + boxH - BP + 8);
    }
  }

  cardHandle(g, t.footer);
}

function renderCardOutro(g, t, L, markId, theme) {
  g.fillStyle = theme.hex;              // 마무리는 사진 없이 테마색 단색
  g.fillRect(0, 0, W, H);

  const body = fit(g, t.body, { maxW: MAXW, maxLines: 9, sizes: [48, 44, 40, 36], weight: 900, lh: 1.58 });
  const handleH = t.footer ? 96 : 0;
  const markR = 46;
  const total = markR * 2 + 56 + body.height + handleH;
  let y = (H - total) / 2;

  drawMark(g, markId, { cx: W / 2, cy: y + markR, r: markR, color: C.white });
  y += markR * 2 + 56;

  y = draw(g, body, { x: PAD, y, color: C.white, align: 'center', boxW: MAXW });

  if (t.footer) {
    g.font = FONT(700, 32);
    g.fillStyle = C.white;
    g.fillText(t.footer, (W - g.measureText(t.footer).width) / 2, y + 74);
  }
}

/* ============================================================
   노트형 — 표지 / 본문
   레퍼런스(sslmo.lab)의 뼈대: 아주 굵은 검은 제목 · 연한 회색 본문 ·
   문단 사이 넉넉한 빈 줄 · 검정 하이라이트 바 · 아래쪽은 시원하게 비운다.
   ============================================================ */

/**
 * 좌상단 심볼 — 레퍼런스 10장 중 8장에 같은 자리에 같은 크기로 들어간다.
 * 이미지가 있으면 그걸 쓰고, 없으면 검은 도형으로 대신 그린다.
 */
const LOGO = 84;

/**
 * 실험실 무드 심볼 — 굵은 검은 실루엣, 평면, 그림자 없음.
 *
 * 0~1 정규 좌표에 그리고 크기만 곱한다. 그래야 어느 크기로 넣어도 선 굵기 비율이 유지된다.
 * 레퍼런스(쓸모실험실)의 심볼과 같은 결을 맞추는 것이 목적이다 — 브랜드 로고 자체가 아니다.
 */
function drawNoteSymbol(g, id, { x, y, size, color }) {
  const sym = getNoteSymbol(id);
  if (sym.id === 'none') return;

  g.save();
  g.translate(x, y);
  g.scale(size, size);
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineJoin = 'round';
  g.lineCap = 'round';

  const stroke = (w, fn) => { g.lineWidth = w; g.beginPath(); fn(); g.stroke(); };
  const fill = (fn) => { g.beginPath(); fn(); g.fill(); };

  if (sym.id === 'award') {
    // 트로피 — 컵 + 양쪽 손잡이 + 받침
    fill(() => {
      g.moveTo(0.28, 0.08); g.lineTo(0.72, 0.08); g.lineTo(0.70, 0.42);
      g.quadraticCurveTo(0.68, 0.62, 0.50, 0.62);
      g.quadraticCurveTo(0.32, 0.62, 0.30, 0.42); g.closePath();
    });
    stroke(0.075, () => { g.moveTo(0.28, 0.14); g.quadraticCurveTo(0.10, 0.16, 0.13, 0.28); g.quadraticCurveTo(0.16, 0.38, 0.30, 0.38); });
    stroke(0.075, () => { g.moveTo(0.72, 0.14); g.quadraticCurveTo(0.90, 0.16, 0.87, 0.28); g.quadraticCurveTo(0.84, 0.38, 0.70, 0.38); });
    fill(() => roundRectPath(g, 0.44, 0.60, 0.12, 0.18, 0.03));
    fill(() => roundRectPath(g, 0.26, 0.78, 0.48, 0.14, 0.05));
  } else if (sym.id === 'medal') {
    // 인증 도장 — 톱니 원 + 안쪽 체크
    for (let i = 0; i < 16; i++) {
      g.save(); g.translate(0.5, 0.5); g.rotate((Math.PI / 8) * i);
      fill(() => roundRectPath(g, -0.055, -0.48, 0.11, 0.16, 0.03));
      g.restore();
    }
    fill(() => g.arc(0.5, 0.5, 0.37, 0, Math.PI * 2));
    g.globalCompositeOperation = 'destination-out';
    stroke(0.09, () => { g.moveTo(0.34, 0.51); g.lineTo(0.45, 0.62); g.lineTo(0.68, 0.39); });
    g.globalCompositeOperation = 'source-over';
  } else if (sym.id === 'calendar') {
    fill(() => roundRectPath(g, 0.10, 0.14, 0.80, 0.78, 0.09));
    fill(() => roundRectPath(g, 0.26, 0.03, 0.09, 0.18, 0.045));
    fill(() => roundRectPath(g, 0.65, 0.03, 0.09, 0.18, 0.045));
    g.globalCompositeOperation = 'destination-out';
    stroke(0.07, () => { g.moveTo(0.10, 0.36); g.lineTo(0.90, 0.36); });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      fill(() => roundRectPath(g, 0.22 + c * 0.20, 0.48 + r * 0.19, 0.12, 0.11, 0.03));
    }
    g.globalCompositeOperation = 'source-over';
  } else if (sym.id === 'chart') {
    fill(() => roundRectPath(g, 0.12, 0.52, 0.20, 0.42, 0.05));
    fill(() => roundRectPath(g, 0.40, 0.30, 0.20, 0.64, 0.05));
    fill(() => roundRectPath(g, 0.68, 0.10, 0.20, 0.84, 0.05));
  } else if (sym.id === 'tv') {
    fill(() => roundRectPath(g, 0.06, 0.22, 0.88, 0.60, 0.09));
    g.globalCompositeOperation = 'destination-out';
    fill(() => roundRectPath(g, 0.15, 0.31, 0.70, 0.42, 0.05));
    g.globalCompositeOperation = 'source-over';
    stroke(0.065, () => { g.moveTo(0.32, 0.06); g.lineTo(0.50, 0.21); });
    stroke(0.065, () => { g.moveTo(0.68, 0.06); g.lineTo(0.50, 0.21); });
    fill(() => roundRectPath(g, 0.24, 0.86, 0.52, 0.08, 0.04));
  } else if (sym.id === 'megaphone') {
    fill(() => {
      g.moveTo(0.86, 0.10); g.lineTo(0.86, 0.80); g.lineTo(0.34, 0.62);
      g.lineTo(0.34, 0.28); g.closePath();
    });
    fill(() => roundRectPath(g, 0.10, 0.30, 0.26, 0.30, 0.06));
    fill(() => { g.moveTo(0.20, 0.60); g.lineTo(0.34, 0.60); g.lineTo(0.30, 0.94); g.lineTo(0.18, 0.94); g.closePath(); });
  } else if (sym.id === 'flask') {
    // 삼각 플라스크 — 레퍼런스와 가장 가까운 모양
    fill(() => {
      g.moveTo(0.36, 0.10); g.lineTo(0.64, 0.10); g.lineTo(0.64, 0.38);
      g.lineTo(0.93, 0.84); g.quadraticCurveTo(0.99, 0.95, 0.86, 0.95);
      g.lineTo(0.14, 0.95); g.quadraticCurveTo(0.01, 0.95, 0.07, 0.84);
      g.lineTo(0.36, 0.38); g.closePath();
    });
    fill(() => roundRectPath(g, 0.27, 0.03, 0.46, 0.13, 0.065));
  } else if (sym.id === 'beaker') {
    fill(() => {
      g.moveTo(0.18, 0.12); g.lineTo(0.82, 0.12); g.lineTo(0.82, 0.84);
      g.quadraticCurveTo(0.82, 0.95, 0.70, 0.95); g.lineTo(0.30, 0.95);
      g.quadraticCurveTo(0.18, 0.95, 0.18, 0.84); g.closePath();
    });
    fill(() => { g.moveTo(0.80, 0.12); g.lineTo(0.99, 0.06); g.lineTo(0.99, 0.19); g.closePath(); });
  } else if (sym.id === 'magnifier') {
    stroke(0.13, () => g.arc(0.44, 0.42, 0.30, 0, Math.PI * 2));
    stroke(0.16, () => { g.moveTo(0.66, 0.64); g.lineTo(0.92, 0.90); });
  } else if (sym.id === 'atom') {
    fill(() => g.arc(0.5, 0.5, 0.11, 0, Math.PI * 2));
    for (let i = 0; i < 3; i++) {
      g.save(); g.translate(0.5, 0.5); g.rotate((Math.PI / 3) * i);
      stroke(0.075, () => g.ellipse(0, 0, 0.46, 0.19, 0, 0, Math.PI * 2));
      g.restore();
    }
  } else if (sym.id === 'gear') {
    for (let i = 0; i < 8; i++) {
      g.save(); g.translate(0.5, 0.5); g.rotate((Math.PI / 4) * i);
      fill(() => roundRectPath(g, -0.09, -0.50, 0.18, 0.24, 0.05));
      g.restore();
    }
    fill(() => g.arc(0.5, 0.5, 0.30, 0, Math.PI * 2));
    g.globalCompositeOperation = 'destination-out';
    fill(() => g.arc(0.5, 0.5, 0.12, 0, Math.PI * 2));
    g.globalCompositeOperation = 'source-over';
  } else if (sym.id === 'clip') {
    stroke(0.10, () => roundRectPath(g, 0.14, 0.14, 0.72, 0.80, 0.10));
    fill(() => roundRectPath(g, 0.34, 0.04, 0.32, 0.17, 0.07));
    stroke(0.075, () => { g.moveTo(0.32, 0.44); g.lineTo(0.68, 0.44); });
    stroke(0.075, () => { g.moveTo(0.32, 0.62); g.lineTo(0.58, 0.62); });
  }

  g.restore();
}
/** roundRect 의 경로만 만드는 판 — beginPath 는 호출한 쪽이 이미 했다 */
function roundRectPath(g, x, y, w, h, r) {
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function noteLogo(g, L, image, symbolId) {
  // 실제 로고 이미지가 있으면 그게 우선이다. 심볼은 없을 때 쓰는 대체물이다.
  if (image) { drawContain(g, image, { x: PAD, y: PAD, w: LOGO, h: LOGO }); return; }
  drawNoteSymbol(g, symbolId, { x: PAD, y: PAD, size: LOGO, color: L.titleColor });
}

/** 테두리 알약 라벨 — 레퍼런스의 "솔직한 AI 단점 01" 자리 */
function noteLabel(g, text, L, y) {
  g.font = FONT(700, 28);
  const padX = 26;
  const h = 56;
  const w = g.measureText(text).width + padX * 2;
  g.strokeStyle = L.titleColor;
  g.lineWidth = 2.5;
  roundRect(g, PAD, y, w, h, h / 2);
  g.stroke();
  g.fillStyle = L.titleColor;
  g.textBaseline = 'middle';
  g.fillText(text, PAD + padX, y + h / 2 + 1);
  g.textBaseline = 'alphabetic';
  return y + h;
}

/**
 * 노트형 표지 — 레퍼런스 이미지 10·15번 구조.
 * 가운데 정렬 큰 제목 → 회색 부제 → 그 아래 일러스트.
 */
function renderNoteCover(g, t, L, image, paper, grain) {
  fallbackBg(g, 'note', L, null, paper, grain);

  const title = fit(g, t.title, { maxW: MAXW, maxLines: 3, sizes: [84, 76, 68, 60], weight: 900, lh: 1.22 });
  let y = draw(g, title, { x: PAD, y: PAD + 96, color: L.titleColor, align: 'center', boxW: MAXW });

  if (t.body) {
    const sub = fit(g, t.body, { maxW: MAXW - 80, maxLines: 2, sizes: [34, 31, 28], weight: 400, lh: 1.5 });
    y = draw(g, sub, { x: PAD + 40, y: y + 30, color: L.subColor, align: 'center', boxW: MAXW - 80 });
  }

  /**
   * 레퍼런스는 일러스트가 **아래 절반을 시원하게 채운다** (가로 약 76%, 세로 42~89%).
   * 예전 값(가로 68%, 위쪽에 붙임)은 그림이 작고 위로 뜬 느낌이었다.
   * 부제가 짧아도 그림이 위로 올라붙지 않게 시작 높이에 바닥을 둔다.
   */
  /**
   * 표지 그림은 **이미지로만** 넣는다. 올리거나 AI 로 만들면 여기에 들어간다.
   *
   * 예전엔 이미지가 없을 때 도형으로 그린 일러스트를 대신 넣었는데, 요청자가 원한 결이
   * 전혀 아니어서 걷어냈다(2026-08-04). 좌상단 심볼을 키워 쓰지도 말 것 —
   * 그러면 표지와 본문이 같은 그림이 된다.
   */
  if (image) {
    const top = Math.max(y + 70, H * 0.38);
    drawContain(g, image, { x: W * 0.10, y: top, w: W * 0.80, h: H - top - PAD * 1.6 });
  }
}

/**
 * 노트형 본문 — 레퍼런스 이미지 6~9·11~14번 구조.
 *
 *   좌상단 작은 심볼 → (선택) 테두리 알약 라벨 → **좌측 정렬** 아주 굵은 검은 제목
 *   → 회색 본문 → 검은 박스·번호 박스
 *
 * ⚠️ 제목을 가운데 정렬하지 않는다. 예전 구현은 표지·본문 모두 가운데였는데
 *    레퍼런스는 본문이 전부 **왼쪽 정렬**이다. 요청자 지적 그대로다.
 * ⚠️ 아래쪽은 비워 둔다. 레퍼런스가 하단 1/3을 늘 비운다.
 */
function renderNoteBody(g, t, L, image, symbolId, paper, grain) {
  fallbackBg(g, 'note', L, null, paper, grain);

  noteLogo(g, L, image, symbolId);
  let y = PAD + LOGO + 44;

  // eyebrow 가 있으면 테두리 알약으로 — "솔직한 AI 단점 01"
  if (t.eyebrow) y = noteLabel(g, t.eyebrow, L, y) + 34;

  if (t.title) {
    const title = fit(g, t.title, { maxW: MAXW, maxLines: 3, sizes: [76, 68, 60, 53], weight: 900, lh: 1.22 });
    y = draw(g, title, { x: PAD, y, color: L.titleColor });
    y += 44;
  }

  if (t.body) {
    const laid = fitRich(g, parseBody(t.body), {
      maxW: MAXW, maxH: H - PAD - y - 40, sizes: [34, 32, 29, 27, 25], lh: 1.68,
    });
    drawRich(g, laid, {
      x: PAD, y, maxW: MAXW,
      color: L.bodyColor, strongColor: L.titleColor, boxBg: L.accent, boxFg: C.white,
    });
  }
}

/* ---------------- 진입점 ---------------- */

/**
 * 카드 한 장을 캔버스에 그린다.
 * @param {HTMLCanvasElement} canvas
 * @param {object} texts 편집된 문구 — 슬롯 정의(lib/templates.js)와 같은 키를 쓴다
 * @param {{conceptId?:string, kind?:string, image?:any, accent?:string, mark?:string}} opts
 */
export function renderCard(canvas, texts, { conceptId = 'magazine', kind = 'body', image = null, accent, mark, cardTheme, noteSymbol, notePaper, noteGrain } = {}) {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const concept = getConcept(conceptId);
  const L = concept.layout;
  const t = texts || {};
  // 카드형 색은 한 곳(state.cardTheme)에서만 온다 — 한 장을 바꾸면 전부 바뀌어야 하기 때문이다
  const theme = getCardTheme(cardTheme);

  g.clearRect(0, 0, W, H);

  if (concept.id === 'card') {
    const role = roleOf('card', kind);
    if (role === 'cover') renderCardCover(g, t, L, image, mark, theme);
    else if (role === 'outro') renderCardOutro(g, t, L, mark, theme);
    else renderCardPage(g, t, L, image, mark, theme);
    return;
  }

  if (concept.id === 'note') {
    const paper = getNotePaper(notePaper);
    const grain = getNoteGrain(noteGrain);
    if (roleOf('note', kind) === 'cover') renderNoteCover(g, t, L, image, paper, grain);
    else renderNoteBody(g, t, L, image, noteSymbol, paper, grain);
    return;
  }

  renderMagazine(g, t, L, accentOf(concept, accent), image);
}

/** 스크린리더용 설명 — canvas 는 그림이라 대체 텍스트가 반드시 필요하다 */
export function cardAlt(texts, i) {
  const t = texts || {};
  const parts = [t.title, t.highlight, t.body].filter(Boolean).map((s) => String(s).replace(/\n/g, ' '));
  return `${i + 1}번째 카드. ${parts.join('. ') || '내용 없음'}`;
}

/** 캔버스를 PNG 파일로 내려받는다 */
export function downloadCanvas(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // 즉시 해제하면 다운로드가 취소되는 브라우저가 있어 한 틱 뒤에 정리한다
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve();
    }, 'image/png');
  });
}
