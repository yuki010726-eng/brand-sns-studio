/**
 * app/template/page.jsx 가 쓰는 순수 함수 모음 — 옛 pages/template.js 의 같은 이름 함수들을
 * 그대로 옮긴 것이다. 모듈 전역 변수(`deck`, `active`) 대신 인자로 받는다는 점만 다르다.
 *
 * 로직 자체는 바꾸지 않는다 — 화면(React)과 상태 모델만 새 구조에 맞춘다.
 */
import { defaultsFor } from '../../../lib/templates.js';
import { HEAD_MARK, buildDeck } from '../../../lib/copywriter.js';
import { draftKeyOf } from '../../../store.js';
import { outlineKeyOf } from '../../../lib/outline.js';

/**
 * `state`·`product` 만으로 지금 보여줄 카드 덱을 세운다 — `app/template/page.jsx` 의
 * `deck` useMemo, `NaverBlogPreview.jsx` 의 미리보기, 새 카드 편집 모달이 전부 같은
 * 순서(뼈대 → 블로그 원문 반영 → 팔로우 장 추가)를 거쳐야 카드 번호가 어긋나지 않는다.
 * ⚠️ 매거진형 표지 한 장만 남기는 처리(`d.slice(0,1)`)는 여기 없다 — 그건 카드 탭이
 *    있는 화면(template/page.jsx)만의 사정이라 호출한 쪽이 필요하면 직접 자른다.
 */
export function buildPreviewDeck(state, product) {
  const core = state.outline?.key === outlineKeyOf(state) ? state.outline.core : null;
  let deck = buildDeck({
    product,
    topic: String(state.topic || '').trim(),
    tone: state.tone,
    variant: state.image?.variant ?? 0,
    cardCount: state.cardCount,
    core,
    allowRuleFallback: !core,
  });
  deck = deckFromBlog(deck, state);
  deck = withFollowCard(deck, state.concept, product);
  return deck;
}

/* ---------------- 문구 상태 재조정 (옛 ensureTexts/mergeTexts/baseOf) ---------------- */

export function baseOf(conceptId, deck, product, coverRecommendations = []) {
  const base = deck.map((card) => defaultsFor(conceptId, card, product));
  const first = coverRecommendations[0];
  if (conceptId === 'magazine' && base[0] && first?.title && first?.highlight) {
    base[0] = { ...base[0], title: first.title, highlight: first.highlight };
  }
  return base;
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
  const recommendations = state.cardCopy?.key === key
    ? state.cardCopy.coverRecommendations || []
    : [];
  const base = baseOf(state.concept, deck, product, recommendations);
  // 카드 문구는 블로그뿐 아니라 cardCopy, outline, 상품 정보에서도 만들어진다.
  // 블로그만 지문으로 삼으면 cardCopy가 바뀌었을 때 기존 texts는 그대로인데
  // base만 새 값이 되어, 손대지 않은 문구가 사용자 편집으로 오인된다.
  const source = cardBaseFingerprint(base);
  const card = state.card;

  let next;
  if (!card || !Array.isArray(card.texts) || card.texts.length !== deck.length) {
    next = { key, source, concept: state.concept, texts: cloneTexts(base), base, layout: emptyLayout(deck), extraTexts: emptyExtraTexts(deck) };
  } else if (card.concept !== state.concept) {
    // 템플릿(컨셉)마다 문구를 완전히 독립적으로 다룬다. "title"·"footer"·"brand" 같은
    // 필드 id가 매거진·카드·노트 세 템플릿에 공통으로 쓰이기 때문에, texts를 하나로
    // 공유하면 mergeTexts가 다른 템플릿에서 고친 값을 "편집됨"으로 오인해 그대로
    // 새 템플릿에 넘긴다 (예: 매거진형에서 고친 계정 아이디가 카드형에도 나타남).
    // layout·extraTexts처럼 컨셉별로 따로 저장해 서로 새지 않게 한다.
    const extraTextsByConcept = { ...(card.extraTextsByConcept || {}), [card.concept]: card.extraTexts };
    const layoutByConcept = { ...(card.layoutByConcept || {}), [card.concept]: card.layout };
    const textsByConcept = { ...(card.textsByConcept || {}), [card.concept]: { texts: card.texts, base: card.base } };
    const savedForTarget = textsByConcept[state.concept];
    const texts = savedForTarget
      ? mergeTexts({ texts: savedForTarget.texts, base: savedForTarget.base }, base)
      : cloneTexts(base);
    next = {
      key: card.key,
      source,
      concept: state.concept,
      texts,
      base,
      layout: fitLayout(layoutByConcept[state.concept], deck),
      extraTexts: fitExtraTexts(extraTextsByConcept[state.concept], deck),
      extraTextsByConcept,
      layoutByConcept,
      textsByConcept,
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

    // 새 배치(소제목 → 본문 → 이미지)는 위쪽 소제목과 문단을 사용한다.
    // 아래 탐색은 이미지가 소제목 앞에 있던 기존 저장 글과의 호환을 위해 남긴다.
    let head = above;
    let para = above ? paragraphAt(i - 1, -1) : '';
    for (let j = i + 1; j < lines.length; j++) {
      if (head) break;
      const u = lines[j].trim();
      if (isHead(u)) { head = u.slice(HEAD_MARK.length).trim(); para = paragraphAt(j + 1, 1); break; }
      if (!u || noise(u)) continue;
      if (isShot(u)) break;
      break;
    }
    if (!head) para = paragraphAt(i + 1, 1) || paragraphAt(i - 1, -1);
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

/**
 * 카드 전용 문구가 있을 때만 덱 문구를 바꿔 끼운다.
 *
 * 블로그의 `📷` 아래 캡션은 이미지 위치를 설명하는 편집 메모이고, 이어지는 문단에는
 * `[ai_video · 길이] 15초` 같은 자료 필드가 포함될 수 있다. 이것을 카드 오버레이로
 * 재사용하면 카드뉴스가 헤드라인이 아니라 내부 메모/본문 복사본이 된다.
 * 카드 전용 결과가 없을 때는 이미 짧은 제목으로 구성된 `buildDeck()` 결과를 유지한다.
 */
export function deckFromBlog(cards, state) {
  const copy = state.cardCopy?.key === draftKeyOf(state) ? state.cardCopy.cards : null;
  if (copy?.length === cards.length) {
    return cards.map((card, i) => ({
      ...card,
      title: copy[i].title || card.title,
      // Older saved cardCopy values were generated with a 36-character ceiling and
      // often render as a single line. Prefer the fuller outline copy when it fits the
      // new shared card/note body range, so existing drafts improve without regeneration.
      body: fullerCardBody(copy[i].body, card.body),
    }));
  }
  return cards;
}

const CARD_BODY_MIN = 60;
const CARD_BODY_MAX = 120;

function fullerCardBody(generated, fallback) {
  const current = String(generated || '').trim();
  if (current.length >= CARD_BODY_MIN) return current;

  const source = String(fallback || '').replace(/\s+/g, ' ').trim();
  if (source.length >= CARD_BODY_MIN && source.length <= CARD_BODY_MAX) return source;

  const sentences = source.split(/(?<=[.?!])\s+/).filter(Boolean);
  let candidate = '';
  for (const sentence of sentences) {
    const next = candidate ? `${candidate} ${sentence}` : sentence;
    if (next.length > CARD_BODY_MAX) break;
    candidate = next;
    if (candidate.length >= CARD_BODY_MIN) return candidate;
  }
  return current || candidate || source;
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
