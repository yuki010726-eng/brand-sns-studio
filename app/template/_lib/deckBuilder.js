/**
 * app/template/page.jsx 가 쓰는 순수 함수 모음 — 옛 pages/template.js 의 같은 이름 함수들을
 * 그대로 옮긴 것이다. 모듈 전역 변수(`deck`, `active`) 대신 인자로 받는다는 점만 다르다.
 *
 * 로직 자체는 바꾸지 않는다 — 화면(React)과 상태 모델만 새 구조에 맞춘다.
 */
import { defaultsFor } from '../../../lib/templates.js';
import { HEAD_MARK } from '../../../lib/copywriter.js';
import { draftKeyOf } from '../../../store.js';

/* ---------------- 문구 상태 재조정 (옛 ensureTexts/mergeTexts/baseOf) ---------------- */

export function baseOf(conceptId, deck, product) {
  return deck.map((card) => defaultsFor(conceptId, card, product));
}

/** 새 템플릿의 슬롯을 기준으로, 사용자가 직접 고쳤던 값만 덮어쓴다 */
export function mergeTexts(card, base) {
  return base.map((b, i) => {
    const prev = card.texts[i] || {};
    const prevBase = card.base?.[i] || {};
    const out = { ...b };
    for (const id of Object.keys(b)) {
      const edited = prev[id] !== undefined && prev[id] !== (prevBase[id] ?? '');
      if (edited) out[id] = prev[id];
    }
    return out;
  });
}

export const cloneTexts = (t) => t.map((x) => ({ ...x }));

const emptyLayout = (deck) => deck.map(() => ({}));
const emptyExtraTexts = (deck) => deck.map(() => []);
const fitExtraTexts = (items, deck) => deck.map((_, i) => (Array.isArray(items?.[i]) ? items[i].map((x) => ({ ...x })) : []));
const fitLayout = (layout, deck) => deck.map((_, i) => ({ ...(layout?.[i] || {}) }));

/**
 * `state.card`를 지금 상품·주제·톤·장수·템플릿·블로그 원문에 맞춰 다시 세운다.
 * 바뀔 필요가 없으면 `null`을 돌려준다 — React 이펙트에서 불필요한 setState 를 막는다.
 */
export function reconcileCard(state, deck, product) {
  const key = draftKeyOf(state);
  const base = baseOf(state.concept, deck, product);
  // 카드 문구는 블로그뿐 아니라 cardCopy, outline, 상품 정보에서도 만들어진다.
  // 블로그만 지문으로 삼으면 cardCopy가 바뀌었을 때 기존 texts는 그대로인데
  // base만 새 값이 되어, 손대지 않은 문구가 사용자 편집으로 오인된다.
  const source = cardBaseFingerprint(base);
  const card = state.card;

  let next;
  if (!card || !Array.isArray(card.texts) || card.texts.length !== deck.length) {
    next = { key, source, concept: state.concept, texts: cloneTexts(base), base, layout: emptyLayout(deck), extraTexts: emptyExtraTexts(deck) };
  } else if (card.concept !== state.concept) {
    const extraTextsByConcept = { ...(card.extraTextsByConcept || {}), [card.concept]: fitExtraTexts(card.extraTexts, deck) };
    const layoutByConcept = { ...(card.layoutByConcept || {}), [card.concept]: fitLayout(card.layout, deck) };
    next = {
      key: card.key,
      source,
      concept: state.concept,
      texts: mergeTexts(card, base),
      base,
      layout: fitLayout(layoutByConcept[state.concept], deck),
      extraTexts: fitExtraTexts(extraTextsByConcept[state.concept], deck),
      extraTextsByConcept,
      layoutByConcept,
    };
  } else {
    const layout = fitLayout(card.layout, deck);
    const extraTexts = fitExtraTexts(card.extraTexts, deck);
    if (card.key === key) {
      const texts = card.source === source ? card.texts : mergeTexts(card, base);
      next = { ...card, source, base, texts, layout, extraTexts };
    } else {
      next = { key, source, concept: state.concept, texts: cloneTexts(base), base, layout, extraTexts };
    }
  }

  return JSON.stringify(next) === JSON.stringify(card) ? null : next;
}

/* ---------------- 블로그 원문에서 카드 재료 뽑기 ---------------- */

function draftImageCaptions(state) {
  const drafts = [state.drafts?.blog, ...Object.values(state.drafts || {})];
  for (const draft of drafts) {
    const lines = String(draft || '').split(/\r?\n/);
    const captions = {};
    lines.forEach((line, i) => {
      const imageNo = line.match(/^\s*📷\s*\[이미지\s*(\d+)(?:\s*[·・-][^\]]*)?\]/)?.[1];
      if (!imageNo) return;
      const caption = String(lines[i + 1] || '').match(/^\s*⤷\s*(.+?)\s*$/)?.[1];
      if (caption) captions[Number(imageNo) - 1] = caption;
    });
    if (Object.keys(captions).length) return captions;
  }
  return {};
}

export function imageCaptionFor(state, index) {
  return draftImageCaptions(state)[index] || '';
}

/**
 * 블로그 원문에서 카드별 재료(소제목·문단·캡션)를 뽑는다.
 * 자세한 배경은 옛 pages/template.js 의 blogCardSource 머리말 참고.
 */
export function blogCardSource(state) {
  const draft = String(state.drafts?.blog || '');
  if (!draft.trim()) return {};
  const lines = draft.split(/\r?\n/);
  const isHead = (t) => t.startsWith(HEAD_MARK);
  const isShot = (t) => /^📷/.test(t);
  const noise = (t) => !isHead(t)
    && (/^[⤷🔔─>#]/.test(t) || /^\[테이블/.test(t) || /^\d+\.\s/.test(t) || t === '목차');

  const paragraphAt = (from, step) => {
    const got = [];
    for (let j = from; j >= 0 && j < lines.length; j += step) {
      const t = lines[j].trim();
      if (!t) { if (got.length) break; continue; }
      if (isHead(t) || isShot(t)) break;
      if (noise(t)) continue;
      got.push(t);
    }
    return (step > 0 ? got : got.reverse()).join(' ').trim();
  };

  const out = {};
  let above = '';
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    if (isHead(t)) { above = t.slice(HEAD_MARK.length).trim(); return; }
    const no = t.match(/^📷\s*\[이미지\s*(\d+)/)?.[1];
    if (!no) return;
    const caption = String(lines[i + 1] || '').match(/^\s*⤷\s*(.+?)\s*$/)?.[1] || '';

    let head = '';
    let para = '';
    for (let j = i + 1; j < lines.length; j++) {
      const u = lines[j].trim();
      if (isHead(u)) { head = u.slice(HEAD_MARK.length).trim(); para = paragraphAt(j + 1, 1); break; }
      if (!u || noise(u)) continue;
      if (isShot(u)) break;
      break;
    }
    if (!head) {
      head = above;
      para = paragraphAt(i + 1, 1) || paragraphAt(i - 1, -1);
    }
    out[Number(no) - 1] = { head, caption, para };
  });
  return out;
}

/**
 * 카드형·노트형 팔로우 카드를 한 장 더한다 (`withFollowCard`, 2026-08-21 결정 그대로 ·
 * 2026-08-31 노트형까지 확장).
 */
export function withFollowCard(cards, conceptId, product) {
  if ((conceptId !== 'card' && conceptId !== 'note') || !cards.length) return cards;
  const total = cards.length + 1;
  const pad = (n) => String(n).padStart(2, '0');
  const numbered = cards.map((card, i) => (card.eyebrow && card.eyebrow.includes('/')
    ? { ...card, eyebrow: `${pad(i + 1)} / ${pad(total)}` }
    : card));
  return [...numbered, {
    kind: 'follow',
    eyebrow: `${pad(total)} / ${pad(total)}`,
    title: '',
    body: '',
    footer: product.short,
  }];
}

/** 카드 문구를 블로그 원문(또는 파생 1회 결과) 기준으로 바꿔 끼운다 */
export function deckFromBlog(cards, state) {
  const copy = state.cardCopy?.key === draftKeyOf(state) ? state.cardCopy.cards : null;
  if (copy?.length === cards.length) {
    return cards.map((card, i) => (card.kind === 'outro' ? card : {
      ...card,
      title: copy[i].title || card.title,
      body: copy[i].body || card.body,
    }));
  }
  const src = blogCardSource(state);
  if (!Object.keys(src).length) return cards;
  return cards.map((card, i) => {
    const slot = src[i];
    if (!slot) return card;
    if (card.kind === 'cover') return { ...card, title: card.title || slot.caption };
    if (card.kind === 'outro') return card;
    return {
      ...card,
      // 블로그 소제목을 그대로 복사하지 않는다. 글 생성 단계가 각 이미지에 붙인 캡션은
      // 해당 소제목 아래 내용을 압축한 "핵심 한 줄"이므로 카드의 제목·강조 문구 재료로 쓴다.
      // 예전 원고처럼 캡션이 없는 경우에만 소제목으로 폴백한다.
      title: slot.caption || slot.head || card.title,
      body: slot.para || slot.caption || card.body,
    };
  });
}

/** 지금 카드가 어느 블로그 원문에서 나왔는지 나타내는 지문 */
export function blogFingerprint(state) {
  const t = String(state.drafts?.blog || '');
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return `${t.length}:${h}`;
}

/** 카드 편집기의 실제 자동 생성 문구 전체를 식별한다. */
export function cardBaseFingerprint(base) {
  const text = JSON.stringify(base || []);
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return `card:${text.length}:${hash}`;
}
