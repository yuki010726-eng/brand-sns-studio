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
import { getConcept, accentOf, getMark } from './concepts.js';
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
      rows.push({ type: 'bar', lines, boxH, boxW: Math.min(inner + bar.padX * 2, maxW), bar });
      h += bar.gapTop + boxH + bar.gapBottom;
      continue;
    }

    const indent = b.type === 'num' ? num.w + num.gap : 0;
    const lines = layoutRuns(g, b.runs, maxW - indent, size, 400, 700);
    rows.push({ type: b.type, n: b.n, lines, indent, num });
    h += lines.length * size * lh;
    if (b.type === 'num') h += size * 0.4;
  }
  return { rows, height: h, size, lh };
}

/** 영역에 들어가는 가장 큰 크기를 고른다 */
function fitRich(g, blocks, { maxW, maxH, sizes, lh }) {
  let last = null;
  for (const size of sizes) {
    last = layoutRich(g, blocks, { maxW, size, lh });
    if (last.height <= maxH) return last;
  }
  return last;
}

function drawRich(g, laid, { x, y, maxW, color, strongColor, boxBg, boxFg }) {
  const { size, lh } = laid;
  let cur = y;

  for (const row of laid.rows) {
    if (row.type === 'gap') { cur += row.h; continue; }

    if (row.type === 'bar') {
      cur += row.bar.gapTop;
      g.fillStyle = boxBg;
      roundRect(g, x, cur, row.boxW, row.boxH, 8);
      g.fill();
      let ty = cur + row.bar.padY;
      for (const line of row.lines) {
        ty += size * 1.34;
        let cx = x + row.bar.padX;
        for (const p of line) {
          g.font = FONT(700, size);
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
        g.font = FONT(p.strong ? 700 : 400, size);
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

function fallbackBg(g, conceptId, L) {
  if (conceptId === 'note') {
    g.fillStyle = L.surface;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(17,17,17,0.04)';   // 종이 느낌만 살짝
    circle(g, W * 0.86, H * 0.14, 240);
    circle(g, W * 0.1, H * 0.92, 180);
    return;
  }
  if (conceptId === 'card') {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#8FC4FB');
    grad.addColorStop(1, L.brand);
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

function renderCardCover(g, t, L, image, markId) {
  if (image) drawCover(g, image);
  else fallbackBg(g, 'card', L);
  bottomScrim(g, L.brand, { from: 0.34, mid: 0.66, midA: 0.62, endA: 1 });

  drawMark(g, markId, { cx: W - PAD - 26, cy: PAD + 26, r: 42, color: L.brand });

  const handleH = t.footer ? 64 : 0;
  const bottom = H - PAD - handleH;
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

function renderCardBody(g, t, L, image, markId) {
  if (image) drawCover(g, image);
  else fallbackBg(g, 'card', L);
  bottomScrim(g, L.brand, { from: 0.5, mid: 0.8, midA: 0.28, endA: 0.7 });

  drawMark(g, markId, { cx: W - PAD - 26, cy: PAD + 26, r: 42, color: L.brand });

  // 대주제 — 파란 박스. 박스도 글자도 카드 가운데에 맞춘다.
  const TP = { x: 36, y: 22 };
  const headY = PAD + 76;
  let headBottom = headY;
  if (t.title) {
    const head = fit(g, t.title, {
      maxW: MAXW - TP.x * 2, maxLines: 2, sizes: [46, 42, 38, 34], weight: 900, lh: 1.34,
    });
    g.font = FONT(head.weight, head.size);
    let inner = 0;
    head.lines.forEach((l) => { inner = Math.max(inner, g.measureText(l).width); });

    const boxW = Math.min(inner + TP.x * 2, MAXW);
    const boxH = head.height + TP.y * 2;
    const boxX = (W - boxW) / 2;

    g.fillStyle = L.brand;
    roundRect(g, boxX, headY, boxW, boxH, 16);
    g.fill();
    draw(g, head, { x: boxX + TP.x, y: headY + TP.y, color: C.white, align: 'center', boxW: boxW - TP.x * 2 });
    headBottom = headY + boxH;
  }

  // 소주제 — 흰 박스 (하단 정렬). 좌우 여백은 BP 로 정확히 대칭이다.
  const BP = 40;
  const handleH = t.footer ? 64 : 0;
  const boxBottom = H - PAD - handleH;
  if (t.body) {
    const body = fit(g, t.body, {
      maxW: MAXW - BP * 2, maxLines: 13, sizes: [34, 31, 28, 25, 23], weight: 400, lh: 1.72,
    });
    const boxH = body.height + BP * 2;
    const boxY = Math.max(boxBottom - boxH, headBottom + 34);
    g.fillStyle = L.panel;
    roundRect(g, PAD, boxY, MAXW, boxH, 14);
    g.fill();
    draw(g, body, { x: PAD + BP, y: boxY + BP - body.size * 0.18, color: L.bodyColor });
  }
  cardHandle(g, t.footer);
}

function renderCardOutro(g, t, L, markId) {
  g.fillStyle = L.surface;              // 마무리는 사진 없이 파랑 단색
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

function renderNoteCover(g, t, L, image) {
  fallbackBg(g, 'note', L);   // 사진은 배경이 아니라 아이콘으로 쓴다

  const title = fit(g, t.title, { maxW: MAXW, maxLines: 3, sizes: [78, 70, 62, 55], weight: 900, lh: 1.26 });
  let y = draw(g, title, { x: PAD, y: PAD + 40, color: L.titleColor, align: 'center', boxW: MAXW });

  if (t.body) {
    const sub = fit(g, t.body, { maxW: MAXW, maxLines: 2, sizes: [38, 34, 30], weight: 400, lh: 1.5 });
    y = draw(g, sub, { x: PAD, y: y + 26, color: L.subColor, align: 'center', boxW: MAXW });
  }

  if (image) {
    const top = y + 78;
    drawContain(g, image, { x: W * 0.14, y: top, w: W * 0.72, h: H - top - PAD - 40 });
  }
}

function renderNoteBody(g, t, L, image) {
  fallbackBg(g, 'note', L);

  let y = PAD;
  if (image) {
    drawContain(g, image, { x: PAD, y, w: 132, h: 132 });
    y += 132 + 52;
  }

  if (t.title) {
    const title = fit(g, t.title, { maxW: MAXW, maxLines: 3, sizes: [72, 64, 57, 50], weight: 900, lh: 1.24 });
    y = draw(g, title, { x: PAD, y, color: L.titleColor });
    y += 50;
  }

  if (t.body) {
    const laid = fitRich(g, parseBody(t.body), {
      maxW: MAXW, maxH: H - PAD - y, sizes: [38, 35, 32, 29, 26], lh: 1.6,
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
export function renderCard(canvas, texts, { conceptId = 'magazine', kind = 'body', image = null, accent, mark } = {}) {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const concept = getConcept(conceptId);
  const L = concept.layout;
  const t = texts || {};

  g.clearRect(0, 0, W, H);

  if (concept.id === 'card') {
    const role = roleOf('card', kind);
    if (role === 'cover') renderCardCover(g, t, L, image, mark);
    else if (role === 'outro') renderCardOutro(g, t, L, mark);
    else renderCardBody(g, t, L, image, mark);
    return;
  }

  if (concept.id === 'note') {
    if (roleOf('note', kind) === 'cover') renderNoteCover(g, t, L, image);
    else renderNoteBody(g, t, L, image);
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
