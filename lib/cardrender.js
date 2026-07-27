/**
 * 카드뉴스 렌더러 — Canvas 2D로 1080x1080 PNG를 직접 그린다.
 *
 * 1:1 을 쓰는 이유: 인스타 피드에서 잘리지 않고, 네이버 블로그 본문 폭(약 800px)에
 * 축소만 하면 그대로 들어가서 한 벌로 두 채널을 커버할 수 있다.
 *
 * 외부 라이브러리를 쓰지 않으므로 한글 줄바꿈과 글자 크기 자동 축소를 직접 구현한다.
 */

export const SIZE = 1080;
const PAD = 88;

/** 디자인 토큰과 같은 값 (Canvas 는 CSS 변수를 못 읽으므로 복제한다) */
const C = {
  primary: '#3182F6',
  dark: '#1B64DA',
  head: '#191F28',
  text: '#4E5968',
  sub: '#5F6B7A',
  weak: '#E8F2FE',
  border: '#E5E8EB',
  white: '#FFFFFF',
};

const FONT = (weight, size) => `${weight} ${size}px 'Noto Sans KR', sans-serif`;

/** 웹폰트가 로드되기 전에 그리면 기본 폰트로 렌더되므로 반드시 먼저 기다린다 */
export async function ensureFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load(FONT(700, 72)),
    document.fonts.load(FONT(500, 40)),
    document.fonts.load(FONT(400, 38)),
  ]);
  await document.fonts.ready;
}

/* ---------------- 텍스트 ---------------- */

/**
 * 한글은 단어 경계가 공백으로 보장되지 않아 글자 단위로 줄을 만든다.
 * 공백이 줄 뒷부분에 있으면 그쪽을 우선해 영문·숫자가 어색하게 끊기지 않게 한다.
 */
function wrap(g, text, maxW) {
  const lines = [];

  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (line && g.measureText(test).width > maxW) {
        const sp = line.lastIndexOf(' ');
        if (sp > line.length * 0.6) {
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
 * 가장 작은 크기로도 넘치면 마지막 줄을 말줄임 처리한다.
 */
function fit(g, text, { maxW, maxLines, sizes, weight, lh }) {
  for (const size of sizes) {
    g.font = FONT(weight, size);
    const lines = wrap(g, text, maxW);
    if (lines.length <= maxLines) return { lines, size, height: lines.length * size * lh };
  }
  const size = sizes.at(-1);
  g.font = FONT(weight, size);
  const lines = wrap(g, text, maxW).slice(0, maxLines);
  lines[lines.length - 1] = lines.at(-1).slice(0, -1) + '…';
  return { lines, size, height: lines.length * size * lh };
}

/** fit 결과를 실제로 그리고 다음 y 좌표를 돌려준다 */
function draw(g, block, { x, y, color, lh }) {
  g.fillStyle = color;
  g.textBaseline = 'alphabetic';
  let cur = y;
  for (const line of block.lines) {
    cur += block.size * lh;
    g.fillText(line, x, cur - block.size * (lh - 1) * 0.35);
  }
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

/** 알약 라벨 — 버튼과 같은 형태를 유지한다 */
function pill(g, text, { x, y, bg, fg, size = 30 }) {
  g.font = FONT(700, size);
  const padX = 30;
  const h = size + 30;
  const w = g.measureText(text).width + padX * 2;
  g.fillStyle = bg;
  roundRect(g, x, y, w, h, h / 2);
  g.fill();
  g.fillStyle = fg;
  g.textBaseline = 'middle';
  g.fillText(text, x + padX, y + h / 2 + 1);
  g.textBaseline = 'alphabetic';
  return { w, h };
}

/** 표지·마무리용 배경 — 진한 파랑에서 밝은 파랑으로 */
function gradientBg(g) {
  const grad = g.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, C.dark);
  grad.addColorStop(1, C.primary);
  g.fillStyle = grad;
  g.fillRect(0, 0, SIZE, SIZE);

  // 은은한 원형 장식 — 단색 배경의 심심함만 덜어내는 정도로
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.beginPath();
  g.arc(SIZE * 0.92, SIZE * 0.12, 300, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(SIZE * 0.08, SIZE * 0.95, 220, 0, Math.PI * 2);
  g.fill();
}

/* ---------------- 카드별 렌더 ---------------- */

const MAXW = SIZE - PAD * 2;

function renderCover(g, card) {
  gradientBg(g);
  pill(g, card.eyebrow, { x: PAD, y: PAD, bg: C.white, fg: C.dark });

  const title = fit(g, card.title, { maxW: MAXW, maxLines: 5, sizes: [78, 70, 62, 54], weight: 700, lh: 1.34 });
  let y = draw(g, title, { x: PAD, y: 290, color: C.white, lh: 1.34 });

  if (card.body) {
    const sub = fit(g, card.body, { maxW: MAXW, maxLines: 2, sizes: [38, 34], weight: 400, lh: 1.5 });
    draw(g, sub, { x: PAD, y: y + 24, color: C.weak, lh: 1.5 });
  }

  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(PAD, SIZE - PAD - 92, 120, 4);
  g.font = FONT(500, 34);
  g.fillStyle = C.white;
  g.fillText(card.footer, PAD, SIZE - PAD - 20);
}

function renderBody(g, card, { tinted }) {
  g.fillStyle = tinted ? C.weak : C.white;
  g.fillRect(0, 0, SIZE, SIZE);

  const accent = tinted ? C.dark : C.primary;
  g.fillStyle = accent;
  roundRect(g, PAD, PAD, 76, 10, 5);
  g.fill();

  g.font = FONT(700, 30);
  g.fillStyle = C.dark;
  g.fillText(card.eyebrow, PAD, PAD + 76);

  const title = fit(g, card.title, { maxW: MAXW, maxLines: 3, sizes: [60, 54, 48], weight: 700, lh: 1.36 });
  let y = draw(g, title, { x: PAD, y: PAD + 130, color: C.head, lh: 1.36 });

  const body = fit(g, card.body, { maxW: MAXW, maxLines: 9, sizes: [40, 36, 32], weight: 400, lh: 1.62 });
  draw(g, body, { x: PAD, y: y + 40, color: C.text, lh: 1.62 });

  g.fillStyle = tinted ? 'rgba(27,100,218,0.18)' : C.border;
  g.fillRect(PAD, SIZE - PAD - 76, MAXW, 2);
  g.font = FONT(500, 28);
  g.fillStyle = C.sub;
  g.fillText(card.footer, PAD, SIZE - PAD - 20);
}

function renderOutro(g, card) {
  gradientBg(g);
  pill(g, card.eyebrow, { x: PAD, y: PAD, bg: C.white, fg: C.dark });

  const title = fit(g, card.title, { maxW: MAXW, maxLines: 5, sizes: [60, 54, 48], weight: 700, lh: 1.4 });
  let y = draw(g, title, { x: PAD, y: 300, color: C.white, lh: 1.4 });

  const body = fit(g, card.body, { maxW: MAXW, maxLines: 4, sizes: [36, 32], weight: 400, lh: 1.6 });
  draw(g, body, { x: PAD, y: y + 30, color: C.weak, lh: 1.6 });

  pill(g, card.footer, { x: PAD, y: SIZE - PAD - 72, bg: C.white, fg: C.dark, size: 32 });
}

/**
 * 카드 한 장을 캔버스에 그린다.
 * @param {HTMLCanvasElement} canvas
 * @param {{kind:string}} card buildDeck() 결과의 한 항목
 */
export function renderCard(canvas, card) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, SIZE, SIZE);

  if (card.kind === 'cover') renderCover(g, card);
  else if (card.kind === 'outro') renderOutro(g, card);
  else renderBody(g, card, { tinted: card.kind === 'note' });
}

/** 스크린리더용 설명 — canvas 는 그림이라 대체 텍스트가 반드시 필요하다 */
export function cardAlt(card, i) {
  return `${i + 1}번째 카드. ${card.title}${card.body ? `. ${card.body.replace(/\n/g, ' ')}` : ''}`;
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
