/**
 * 4단계 — 카드뉴스 템플릿
 *
 * 템플릿(매거진형·카드형·노트형)을 고르고, 그 아래에서 카드 한 장씩 편집한다.
 * 시스템이 문구를 미리 채워 두고, 사용자는 슬롯별 입력칸에서 고친다.
 * 왼쪽 미리보기는 입력할 때마다 다시 그려진다.
 *
 * 입력칸 구성은 lib/templates.js 의 슬롯 정의를 따른다 — 템플릿마다,
 * 그리고 표지/본문/마무리마다 들어가는 글의 자리가 다르기 때문이다.
 *
 * 배경 이미지는 선택 사항이다. 3단계에서 만든 이미지가 있으면 쓰고, 없으면 기본 배경으로 그린다.
 */
import { icon } from '../assets/icons.js';
import { getProduct } from '../lib/products.js';
import { BANNED_PHRASES } from '../data/banned-phrases.js';
import {
  CONCEPTS, ACCENTS, MARKS, CARD_THEMES, NOTE_SYMBOLS, NOTE_PAPERS, NOTE_INKS, DEFAULT_NOTE_GRAIN,
  getConcept, getCardTheme, getMark, getNoteInk, getNotePaper, isHex, contrastWithWhite, contrastOn,
} from '../lib/concepts.js';
import { slotsFor, defaultsFor, roleOf, objectsFor } from '../lib/templates.js';
import { stepperHTML, bindStepper } from '../components/stepper.js';
import { getState, setState, subscribe, navigate, draftKeyOf } from '../store.js';
import { buildDeck, TONE_LABEL, findBanned, HEAD_MARK } from '../lib/copywriter.js';
import { outlineKeyOf } from '../lib/outline.js';
import { getImage, putImage, deleteImage, imageKey } from '../lib/imagestore.js';
import { renderCard, loadImage, cardAlt, downloadCanvas, ensureFonts, lastClipped, lastBoxes, lastSizes, W, H } from '../lib/cardrender.js';
import { buildPrompt } from '../lib/imageprompt.js';
import {
  buildAdPrompts, AD_CONCEPTS, getAdConcept, roleLabel, adConceptForTone,
} from '../lib/adprompt.js';
import { imagePanelHTML, bindImagePanel } from '../components/imagepanel.js';
import { toast } from '../components/toast.js';
import { saveToLibrary, hasLibraryChanges } from '../lib/librarystore.js';

export const title = '카드뉴스 템플릿';

export function guard() {
  const s = getState();
  // A persisted/synced product id can outlive the product itself (for example,
  // when it is disabled in Supabase).  Checking only the id lets a null
  // product reach defaultsFor(), which expects fields such as `short`.
  return getProduct(s.productId) && s.topic.trim() ? null : '/';
}

const KIND_LABEL = { cover: '표지', body: '본문', note: '반론', outro: '마무리', follow: '팔로우' };

/** 노트형 아이콘처럼 배경이 아닌 자리에 이미지가 들어가는 경우가 있어 문구를 나눠 쓴다 */
const IMAGE_ROLE = {
  note: { label: '아이콘 이미지', desc: '카드에 아이콘으로 들어갑니다. 배경이 아니라 그림 자리입니다.' },
  magazine: { label: '배경 이미지', desc: '카드 전체를 채우는 배경으로 깔립니다.' },
  card: { label: '배경 이미지', desc: '카드 전체를 채우는 배경으로 깔립니다.' },
};

/* 화면을 벗어나면 사라져도 되는 값이라 스토어에 넣지 않는다 */
let deck = [];
let active = 0;
let bitmaps = [];
let repaintTimer = null;
let currentRoot = null;
let archiveTimer = null;
let unsubscribeArchive = null;
let archiveSaving = false;
/** 직관형(D)에서 만든 프롬프트 묶음 — 화면을 벗어나면 사라져도 되는 값이다 */
let adPrompts = [];

const refreshArchiveButton = (root) => {
  const btn = root?.querySelector('#save-library');
  if (btn && !archiveSaving) btn.disabled = !hasLibraryChanges();
};

function bindArchiveAutosave(root) {
  clearInterval(archiveTimer);
  unsubscribeArchive?.();
  unsubscribeArchive = subscribe(() => {
    if (!root.isConnected) { unsubscribeArchive?.(); unsubscribeArchive = null; return; }
    refreshArchiveButton(root);
  });
  archiveTimer = setInterval(() => {
    if (!root.isConnected) { clearInterval(archiveTimer); archiveTimer = null; return; }
    if (hasLibraryChanges()) saveToArchive(root, { automatic: true });
  }, 60_000);
  refreshArchiveButton(root);
}

/* ---------------- 작업 되돌리기·다시 실행 ---------------- */

/**
 * 이 페이지에 머무는 동안의 작업 이력이다. 스토어(localStorage)에 넣지 않는다 —
 * 새로고침·다른 기기까지 따라갈 값이 아니라 "지금 이 편집 세션"만의 되돌리기다.
 *
 * 담는 것: 문구(`card`)·배치(`card.layout`)·강조색·테마색·마크·노트 종이·심볼 — 오른쪽 폼과
 * 왼쪽 미리보기에서 바꿀 수 있는 값 전부. 담지 않는 것: 이미지(파일이라 IndexedDB에 있고
 * 스냅샷에 넣기엔 무겁다), 템플릿 선택(템플릿을 바꾸면 슬롯 구성 자체가 달라져 이력을 새로 시작한다),
 * 지금 보고 있는 카드 탭(화면 상태일 뿐 "작업"이 아니다).
 */
let history = [];
let historyIndex = -1;
let historyTimer = null;
const HISTORY_KEYS = ['card', 'accent', 'cardTheme', 'mark', 'noteSymbol', 'notePaper', 'noteGrain', 'noteInk'];

function historySnapshot() {
  const s = getState();
  return JSON.parse(JSON.stringify(Object.fromEntries(HISTORY_KEYS.map((k) => [k, s[k]]))));
}

/** 페이지에 새로 들어오거나 템플릿을 바꿀 때 이력을 지금 상태 하나로 다시 시작한다 */
function resetHistory() {
  history = [historySnapshot()];
  historyIndex = 0;
}

/**
 * 편집이 몰릴 때(타이핑·슬라이더 끌기·연속 드래그) 한 번만 기록한다.
 * 글자 하나·픽셀 하나마다 되돌리기 칸이 쌓이면 몇 번을 눌러도 소용없는 이력이 된다.
 */
function markDirty(root) {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    const snap = historySnapshot();
    if (JSON.stringify(snap) === JSON.stringify(history[historyIndex])) return;   // 실제로 안 바뀌었으면 안 쌓는다
    history = history.slice(0, historyIndex + 1);   // 되돌린 다음 새로 고치면 그 뒤 미래는 버린다
    history.push(snap);
    historyIndex = history.length - 1;
    refreshHistoryButtons(root);
  }, 600);
}

function applyHistory(root, index) {
  historyIndex = index;
  setState(history[index]);
  selectedObj = null;   // 배치가 바뀌었을 수 있다 — 안전하게 선택을 비운다
  refreshForm(root);
  refreshNotices(root);
  paint(root);
  refreshHistoryButtons(root);
}

function undo(root) { if (historyIndex > 0) applyHistory(root, historyIndex - 1); }
function redo(root) { if (historyIndex < history.length - 1) applyHistory(root, historyIndex + 1); }

/** 이 카드뉴스를 처음 열었을 때(또는 마지막 템플릿 교체) 상태로 한 번에 되돌린다 */
function resetToOriginal(root) {
  if (historyIndex === 0) return;
  applyHistory(root, 0);
  toast('작업 시작 시점으로 되돌렸습니다.');
}

function refreshHistoryButtons(root) {
  const u = root.querySelector('#hist-undo');
  if (u) u.disabled = historyIndex <= 0;
  const r = root.querySelector('#hist-redo');
  if (r) r.disabled = historyIndex >= history.length - 1;
  const o = root.querySelector('#hist-reset');
  if (o) o.disabled = historyIndex <= 0;
}

function historyHTML() {
  return `
    <div class="tpl-history" role="group" aria-label="작업 되돌리기">
      <button type="button" class="btn btn--ghost btn--sm" id="hist-undo" aria-label="바로 전 작업으로 되돌리기">
        ${icon('undo', 'icon--sm')} 되돌리기
      </button>
      <button type="button" class="btn btn--ghost btn--sm" id="hist-redo" aria-label="되돌린 작업 다시 실행하기">
        ${icon('redo', 'icon--sm')} 다시 실행
      </button>
      <button type="button" class="btn btn--ghost btn--sm" id="hist-reset" aria-label="문구·배치·색상을 작업 시작 시점으로 되돌리기">
        ${icon('refresh', 'icon--sm')} 처음 상태로
      </button>
    </div>`;
}

function bindHistory(root) {
  root.querySelector('#hist-undo')?.addEventListener('click', () => undo(root));
  root.querySelector('#hist-redo')?.addEventListener('click', () => redo(root));
  root.querySelector('#hist-reset')?.addEventListener('click', () => resetToOriginal(root));
  refreshHistoryButtons(root);
}

/* ---------------- 오브젝트 자유 배치(위치·크기) ---------------- */

/** 지금 손잡이로 선택된 오브젝트 id — 화면을 벗어나면 사라져도 되는 값이라 스토어에 넣지 않는다 */
let selectedObj = null;
/** 이름표가 잠깐 떴다 사라지는 오브젝트 id. 클릭(선택)할 때마다 새로 켜고 타이머로 끈다 */
let flashObj = null;
let flashTimer = null;
/** 드래그·리사이즈 중일 때만 값이 있다. 끝나면(pointerup) state.card.layout 에 확정 저장하고 비운다 */
let dragging = null;
/** 드래그 중 실시간 미리보기용 상자(0~1 정규화) — 확정 전까지는 여기서만 산다 */
let draftBox = null;
/** 캔버스 반복 그리기를 rAF 로 한 프레임에 한 번만 하도록 묶는다(드래그는 pointermove 가 매우 잦다) */
let paintScheduled = false;
/**
 * 바깥을 눌렀을 때 선택을 푸는 document 리스너.
 *
 * ⚠️ 오버레이(`#tpl-overlay`)는 `pointer-events: none` 이라 **손잡이 밖의 클릭이 오버레이에 닿지 않는다.**
 *    그래서 여기서 문서 전체를 듣는다. 화면을 다시 그릴 때마다 이전 것을 반드시 떼어야
 *    라우트를 오갈수록 리스너가 쌓인다(프로필 라디오에서 겪었던 것과 같은 실패다).
 */
let outsideTap = null;
/**
 * 편집 영역 밖을 눌러 손잡이를 통째로 감춘 상태 (요청자 지시 2026-08-14).
 *
 * 선택만 푸는 것으로는 부족했다 — `.tpl-handle` 은 선택 여부와 무관하게 **늘 파란 점선**이라
 * 폼을 만지는 동안에도 미리보기가 점선으로 덮여 있었다("파란색 점점점이 시야에 방해된다").
 * 그래서 미리보기·크기 패널 밖을 누르면 손잡이 자체를 안 보이게 한다.
 *
 * ⚠️ **손잡이를 없애지는 않는다.** 테두리만 투명해지고 클릭은 그대로 받는다.
 *    지우면 다시 켤 방법이 없어져서 미리보기가 죽은 그림이 된다.
 */
let overlayIdle = false;

/* ---------------- 문구 상태 ---------------- */

/**
 * 문구 상태는 두 가지 이유로 낡는다. 둘을 구분해서 다뤄야 한다.
 *
 * 1. 상품·주제·톤이 바뀜 → 새 AI 주제의 문구로 즉시 교체한다. (card.key)
 * 2. 템플릿이 바뀜 → **슬롯 구성 자체가 달라진다.** 그대로 두면 새 템플릿에 없는 칸이
 *    빈 채로 남아 카드가 비어 보인다. 직접 고친 값만 살리고 나머지는 새 기본값으로 채운다. (card.concept)
 */
function baseOf(conceptId, product) {
  return deck.map((card) => defaultsFor(conceptId, card, product));
}

/** 새 템플릿의 슬롯을 기준으로, 사용자가 직접 고쳤던 값만 덮어쓴다 */
function mergeTexts(card, base) {
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

const cloneTexts = (t) => t.map((x) => ({ ...x }));

const slotIds = (i) => slotsFor(getState().concept, deck[i].kind).map((s) => s.id);
const isEdited = (card, i) => slotIds(i).some((id) => (card.texts[i]?.[id] ?? '') !== (card.base[i]?.[id] ?? ''));
const hasEdits = (card) => card.texts.some((_, i) => isEdited(card, i));

/**
 * 조건이 바뀌면 이전 주제의 편집본도 새 AI 추천 문구로 교체한다.
 * 주제와 맞지 않는 카드가 남는 것보다 현재 생성 결과를 정확히 보여주는 것이 우선이다.
 */
/** 카드마다 빈 오버라이드 배치 — "전부 자동 배치"의 초기값 */
const emptyLayout = () => deck.map(() => ({}));
const emptyExtraTexts = () => deck.map(() => []);
const fitExtraTexts = (items) => deck.map((_, i) => Array.isArray(items?.[i]) ? items[i].map((x) => ({ ...x })) : []);

/**
 * 저장된 배치를 새 덱 길이에 맞춘다. 카드 장수가 바뀌면 텍스트처럼 배열 길이가 어긋난다.
 * 옛 저장값(이 기능 이전)엔 `layout` 자체가 없을 수 있어 그 경우도 여기서 안전하게 채운다.
 */
const fitLayout = (layout) => deck.map((_, i) => ({ ...(layout?.[i] || {}) }));

function ensureTexts(product) {
  const s = getState();
  const key = draftKeyOf(s);
  const source = blogFingerprint(s);
  const base = baseOf(s.concept, product);
  const card = s.card;

  if (!card || !Array.isArray(card.texts) || card.texts.length !== deck.length) {
    setState({ card: { key, source, concept: s.concept, texts: cloneTexts(base), base, layout: emptyLayout(), extraTexts: emptyExtraTexts() } });
    return;
  }

  // 템플릿 교체 — 슬롯이 달라졌으므로 반드시 새 구성으로 다시 세운다.
  // 오브젝트 구성도 템플릿마다 다르므로 배치도 함께 새로 시작한다.
  if (card.concept !== s.concept) {
    // 템플릿마다 추가 텍스트와 배치를 따로 보관한다. A → B → A처럼 돌아와도
    // A에서 만든 상자와 위치·크기 설정이 복원되며 B/C에는 나타나지 않는다.
    const extraTextsByConcept = {
      ...(card.extraTextsByConcept || {}),
      [card.concept]: fitExtraTexts(card.extraTexts),
    };
    const layoutByConcept = {
      ...(card.layoutByConcept || {}),
      [card.concept]: fitLayout(card.layout),
    };
    setState({ card: {
      key: card.key,
      source,
      concept: s.concept,
      texts: mergeTexts(card, base),
      base,
      layout: fitLayout(layoutByConcept[s.concept]),
      extraTexts: fitExtraTexts(extraTextsByConcept[s.concept]),
      extraTextsByConcept,
      layoutByConcept,
    } });
    return;
  }

  // 배치는 내용이 낡는 것과 다른 축이다(디자인 결정) — 여기서는 길이만 맞춰 보존한다.
  const layout = fitLayout(card.layout);
  const extraTexts = fitExtraTexts(card.extraTexts);

  if (card.key === key) {
    /**
     * 상품·주제·톤·장수는 그대로인데 **글만 다시 뽑은 경우**(AI 2, 블로그 직접 수정).
     * 예전에는 여기서 `base` 만 갈고 `texts` 를 그대로 뒀다 — 그래서 새 글을 뽑아도
     * 카드에는 옛 문구가 남았다. 이제 지문이 다르면 `mergeTexts()` 로 다시 맞춘다:
     * **직접 고친 칸은 지키고, 손대지 않은 칸만** 새 글의 문구로 바뀐다(템플릿 교체와 같은 규칙).
     */
    const texts = card.source === source ? card.texts : mergeTexts(card, base);
    setState({ card: { ...card, source, base, texts, layout, extraTexts } });   // 되돌리기 기준을 최신으로
    return;
  }
  setState({ card: { key, source, concept: s.concept, texts: cloneTexts(base), base, layout, extraTexts } });
}

/* ---------------- 렌더 ---------------- */

export function render(root) {
  const s = getState();
  const p = getProduct(s.productId);
  const concept = getConcept(s.concept);

  /**
   * ⚠️ AI 가 짠 뼈대가 있으면 **그것으로 카드를 만든다.**
   *    예전에는 늘 규칙 기반이라 글귀를 새로 뽑아도 카드 문구가 그대로였다 — 요청자 지적.
   *    뼈대는 2단계에서 만들어 `state.outline` 에 담긴다.
   */
  const hasDraft = Object.values(s.drafts || {}).some((value) => String(value || '').trim());
  if (!hasDraft) {
    toast('현재 주제로 AI 글을 먼저 생성해 주세요.');
    navigate('/copy');
    return;
  }
  // Older library/sync snapshots can contain the generated channel drafts but
  // not the outline that was added later. The drafts are the actual completion
  // requirement; when their matching outline is unavailable, buildDeck() uses
  // its deterministic core so the user can still continue to the template.
  const core = s.outline?.key === outlineKeyOf(s) ? s.outline.core : null;
  deck = buildDeck({
    product: p, topic: s.topic.trim(), tone: s.tone,
    variant: s.image?.variant ?? 0, cardCount: s.cardCount,
    core,
    allowRuleFallback: !core,
  });
  // 카드 문구의 최종 출처는 **완성된 블로그**다. 뼈대(outline)는 카드 개수·역할만 잡고,
  // 실제 제목·본문은 블로그의 소제목과 문단에서 가져온다 (blogCardSource 주석 참고).
  deck = deckFromBlog(deck, s);
  deck = withFollowCard(deck, concept.id, p);

  /**
   * ⚠️ **직관형(D)은 여기서 갈라진다.** 카드를 그리지 않고 이미지 프롬프트만 만든다
   *    (`lib/concepts.js` 의 `promptOnly` 주석 참고). 아래 캔버스 준비를 타면 안 된다 —
   *    직관형에는 슬롯 정의(`lib/templates.js`)가 없어서 `ensureTexts()` 가 매거진형 슬롯으로
   *    카드를 세운다. 그러면 A 로 돌아갔을 때 편집본이 어긋난다.
   */
  if (concept.promptOnly) { renderAdPage(root, p, s); return; }

  ensureTexts(p);
  if (active >= deck.length) active = 0;
  resetHistory();   // 이 화면에 새로 들어오거나(마운트) 템플릿을 바꿀 때 이력을 지금 상태로 다시 시작한다

  root.innerHTML = `
    <div class="container">
      ${stepperHTML('/template')}

      <section class="section">
        <div class="section__head">
          <h1>템플릿을 고르고 문구를 얹습니다</h1>
          <p class="section__desc">
            템플릿 3종 중 하나를 고르면 카드 ${deck.length}장의 문구가 자동으로 채워집니다.
            오른쪽 입력칸에서 고치면 왼쪽 미리보기에 바로 반영됩니다. 규격은 ${W}×${H}(4:5)입니다.
          </p>
        </div>

        <div class="ctxbar card">
          <dl class="ctxbar__list">
            <div><dt>상품</dt><dd>${esc(p.name)}</dd></div>
            <div><dt>주제</dt><dd>${esc(s.topic)}</dd></div>
            <div><dt>톤</dt><dd>${esc(TONE_LABEL[s.tone] || s.tone)}</dd></div>
          </dl>
          <div class="ctxbar__actions">
            <a class="btn btn--ghost btn--sm" href="#/copy" aria-label="글귀 단계로 돌아가기">
              ${icon('arrowLeft', 'icon--sm')} 글귀 수정
            </a>
            <button type="button" class="btn btn--soft btn--sm" id="reset-all"
                    aria-label="모든 카드 문구를 추천 문구로 되돌리기">
              ${icon('refresh', 'icon--sm')} 전체 추천 문구로
            </button>
          </div>
        </div>

        <!-- 템플릿 선택 -->
        <h2 class="sub-head">템플릿 선택</h2>
        <fieldset class="concept-grid" id="tpl-concepts">
          <legend class="sr-only">카드뉴스 템플릿을 선택하세요</legend>
          ${CONCEPTS.map((c) => conceptCardHTML(c, c.id === s.concept)).join('')}
        </fieldset>

        <div class="tpl-toolbar">
          <!-- 카드 선택 -->
          <div class="tpl-tabs" role="tablist" aria-label="편집할 카드 선택">
            ${deck.map((c, i) => tabHTML(c, i)).join('')}
          </div>
          ${historyHTML()}
        </div>

        <div class="tpl-editor">
          <div class="tpl-stage">
            <div class="tpl-stage__canvas-wrap" id="tpl-canvas-wrap">
              <canvas class="tpl-stage__canvas" id="tpl-canvas" width="${W}" height="${H}"
                      role="img" aria-label="카드 미리보기"></canvas>
              <!-- 오브젝트 자유 배치 손잡이. 렌더러가 실제로 그린 자리(lastBoxes())를 그대로 옮겨 그린다. -->
              <div class="tpl-stage__overlay" id="tpl-overlay"></div>
            </div>
            <p class="tpl-stage__note" id="tpl-src">이미지 확인 중…</p>
            <p class="tpl-stage__note" id="tpl-layout-hint">${layoutHintHTML()}</p>
            <!-- 글이 잘렸을 때만 채워진다. 미리보기 바로 아래라 눈에 바로 걸린다. -->
            <div id="tpl-overflow"></div>
          </div>

          <div class="tpl-form card" id="tpl-form">
            <div id="tpl-form-fields">${formHTML()}</div>

            <div class="tpl-form__footer">
              <div class="tpl-stage__actions" aria-label="카드 이미지 저장">
              <button type="button" class="btn btn--ghost btn--sm" id="save-one"
                      aria-label="이 카드 PNG로 저장하기">
                ${icon('download', 'icon--sm')} 이 카드 저장
              </button>
              <button type="button" class="btn btn--sm" id="save-all"
                      aria-label="카드 ${deck.length}장 모두 PNG로 저장하기">
                ${icon('download', 'icon--sm')} ${deck.length}장 모두 저장
              </button>
              </div>

              <!-- 카드 편집을 마친 뒤 바로 이어서 이미지 프롬프트와 파일을 다룬다. -->
              <div id="tpl-image">${imagePanelSlot()}</div>
            </div>
          </div>
        </div>

        <div class="flow-actions">
          <button type="button" class="btn btn--ghost" id="go-copy"
                  aria-label="아이디어 문서화 단계로 돌아가기">
            ${icon('arrowLeft', 'icon--sm')} 글귀 단계로
          </button>
          <button type="button" class="btn" id="save-library"
                  aria-label="지금 게시물 저장하기">
            ${icon('archive', 'icon--sm')} 저장
          </button>
        </div>
      </section>
    </div>`;

  currentRoot = root;
  bindStepper(root);
  bindConcepts(root);
  bindTabs(root);
  bindForm(root);
  bindNotices(root);
  bindImagePanelHere(root);
  bindOverlay(root);
  bindHistory(root);

  root.querySelector('#reset-all')?.addEventListener('click', () => resetAll(root));
  root.querySelector('#save-one')?.addEventListener('click', () => saveOne(root));
  root.querySelector('#save-all')?.addEventListener('click', () => saveAll(root));
  root.querySelector('#save-library')?.addEventListener('click', () => saveToArchive(root));
  root.querySelector('#go-copy')?.addEventListener('click', () => navigate('/copy'));
  bindArchiveAutosave(root);

  (async () => {
    await ensureFonts();
    await loadBitmaps();
    if (!root.querySelector('#tpl-canvas')) return;   // 그 사이 페이지를 떠난 경우
    refreshSource(root);
    paint(root);
  })();
}

function conceptCardHTML(c, checked) {
  return `
    <div class="concept">
      <!-- autocomplete=off: 새로고침 시 브라우저가 예전 선택을 되살리며 change 를 쏴서
           저장된 선택을 덮어쓰는 것을 막는다 -->
      <input class="sr-only concept__input" type="radio" name="tpl-concept" id="tc-${c.id}"
             value="${c.id}" autocomplete="off" ${checked ? 'checked' : ''}
             aria-label="템플릿 ${c.badge} ${c.name} — ${c.desc}" />
      <label class="concept__body card card--hover" for="tc-${c.id}">
        <span class="concept__top">
          <span class="badge">${c.badge}</span>
          <span class="concept__check" aria-hidden="true">${icon('check', 'icon--sm')}</span>
        </span>
        <span class="concept__name">${c.name}</span>
        <span class="concept__desc">${c.desc}</span>
        <span class="concept__mood">${c.mood}</span>
      </label>
    </div>`;
}

function tabHTML(card, i) {
  const on = i === active;
  return `
    <button type="button" class="tpl-tab" role="tab" data-card-tab="${i}"
            aria-selected="${on}" tabindex="${on ? '0' : '-1'}"
            aria-label="${i + 1}번 카드 ${KIND_LABEL[card.kind] || '본문'} 편집">
      <span class="tpl-tab__no">${String(i + 1).padStart(2, '0')}</span>
      <span>${KIND_LABEL[card.kind] || '본문'}</span>
    </button>`;
}

/* ---------------- 오른쪽 입력 폼 ---------------- */

/** 마무리 카드(카드형)는 단색 배경 고정이라 이미지를 쓰지 않는다 */
const usesImage = (conceptId, kind) => !(conceptId === 'card' && roleOf('card', kind) === 'outro');

/**
 * ⚠️ 오브젝트 자유 배치는 1단계라 매거진형에만 있다 — `objectsFor()` 가 다른 템플릿엔
 *    빈 배열을 돌려주므로 손잡이 자체가 안 뜬다. 왜 안 보이는지 헷갈리지 않게 안내한다.
 */
function layoutHintHTML() {
  return '미리보기 위 점선 상자를 드래그하면 위치·크기를 바꿀 수 있습니다. 상자를 누르면 이름이 잠깐 떴다 사라지고, 아래에서 숫자·글자 크기로도 조정할 수 있어요. 오른쪽 입력칸처럼 미리보기 밖을 누르면 점선이 사라지고, 미리보기를 다시 누르면 나타납니다.';
}

function imagePanelSlot() {
  const s = getState();
  const concept = getConcept(s.concept);
  const info = IMAGE_ROLE[concept.id] || IMAGE_ROLE.magazine;
  return imagePanelHTML({
    index: active,
    total: deck.length,
    hasImage: Boolean(s.images[active]),
    source: s.images[active]?.source || null,
    prompt: promptFor(active),
    label: info.label,
    disabled: !usesImage(s.concept, deck[active].kind),
    lockable: concept.id !== 'note' && Boolean(s.images[active]),
    locked: Boolean(s.images[active]?.locked),
  });
}

function formHTML() {
  const s = getState();
  const concept = getConcept(s.concept);
  const t = s.card.texts[active] || {};
  const edited = isEdited(s.card, active);
  const slots = slotsFor(s.concept, deck[active].kind);

  return `
    <div class="tpl-form__head">
      <div class="panel__meta">
        <span class="badge">${String(active + 1).padStart(2, '0')} ${KIND_LABEL[deck[active].kind] || '본문'}</span>
        <span class="badge badge--neutral">${esc(concept.name)}</span>
        ${edited ? '<span class="badge badge--neutral">편집됨</span>' : ''}
      </div>
      <button type="button" class="btn btn--ghost btn--sm" id="reset-one"
              aria-label="이 카드 문구를 추천 문구로 되돌리기" ${edited ? '' : 'disabled'}>
        ${icon('refresh', 'icon--sm')} 추천 문구로
      </button>
      <button type="button" class="btn btn--soft btn--sm" id="add-text-box"
              aria-label="현재 카드에 텍스트 상자 추가">
        ${icon('plus', 'icon--sm')} 텍스트 상자 추가
      </button>
    </div>

    <div id="tpl-layout-slot">${layoutPanelHTML()}</div>

    <h3 class="tpl-form__legend">문구</h3>
    ${slots.map((f) => fieldHTML(f, t[f.id] ?? '', concept.id, deck[active].kind)).join('')}
    ${extraTextsHTML(s.card.extraTexts?.[active] || [])}

    ${concept.accentPicker ? accentHTML(s.accent) : ''}
    ${concept.id === 'note' ? notePaperHTML(s.notePaper, s.noteGrain) : ''}
    ${concept.id === 'note' ? noteSymbolHTML(s.noteSymbol) : ''}
    ${concept.id === 'card' ? cardThemeHTML(s.cardTheme) : ''}
    ${concept.id === 'card' ? markHTML(s.mark) : ''}

    <div id="tpl-warn">${warnHTML(t)}</div>`;
}

/** 노트형 본문에 넣을 수 있는 요소 — 커서 자리에 바로 꽂아 준다 */
const INSERTS = [
  { label: '강조', wrap: ['**', '**'], hint: '굵고 진하게' },
  { label: '하이라이트 바', line: '> ', hint: '검정 바 + 흰 글씨' },
  { label: '번호 목록', line: '1. ', hint: '번호 박스' },
  { label: '✅', text: '✅ ' }, { label: '👉', text: '👉 ' },
  { label: '🔥', text: '🔥 ' }, { label: '💡', text: '💡 ' }, { label: '⚠️', text: '⚠️ ' },
];

function insertToolsHTML(targetId, targetLabel, conceptId = 'note') {
  return `<div class="tpl-inserts" aria-label="${esc(targetLabel)} 서식 도구">
    ${INSERTS.map((x, i) => `
      <button type="button" class="tpl-insert" data-insert="${i}" data-insert-target="${esc(targetId)}"
              aria-label="${esc(targetLabel)}에 ${x.hint || x.label} 넣기"
              title="${esc(x.hint || x.label)}">${x.label}</button>`).join('')}
  </div>`;
}

function fieldHTML(f, value, conceptId, kind = 'body') {
  const control = f.tag === 'textarea'
    ? `<textarea class="textarea tpl-ta" id="f-${f.id}" data-f="${f.id}" rows="${f.rows || 3}"
                 spellcheck="false" autocomplete="off"
                 aria-describedby="h-${f.id}">${esc(value)}</textarea>`
    : `<input class="input" type="text" id="f-${f.id}" data-f="${f.id}"
              value="${esc(value)}" spellcheck="false" autocomplete="off"
              aria-describedby="h-${f.id}" />`;

  /**
   * ⚠️ **카드형 본문도 서식을 지원한다** (2026-08-21, 요청자 지시).
   *    렌더러는 처음부터 지원하고 있었다 — `renderCardPage()` 가 노트형과 **같은**
   *    `parseBody → fitRich → drawRich` 를 탄다. 입력칸 안내(`CARD_BODY_HINT`)에도 적혀 있었다.
   *    없던 것은 **버튼뿐**이라 손으로 `**` 를 쳐야만 쓸 수 있었다. 그래서 아무도 안 썼다.
   *    ⚠️ 표지 칸에는 붙이지 않는다 — 표지 흰 박스는 서식을 그리지 않는다.
   */
  const rich = conceptId === 'note' || (conceptId === 'card' && roleOf('card', kind) !== 'outro');
  const tools = rich && f.id === 'body'
    ? insertToolsHTML(`f-${f.id}`, f.label, conceptId)
    : '';

  /**
   * 글자 수 카운터. 상한(`f.max`)은 **막는 값이 아니라 알리는 값**이다 —
   * 요청자 지시: 처음 생성은 제한하되 이후 수정은 자유롭게. 넘으면 빨갛게만 표시한다.
   */
  const counter = f.max
    ? `<span class="tpl-count${value.length > f.max ? ' tpl-count--over' : ''}" data-count="${f.id}"
             aria-live="polite">${value.length} / ${f.max}자</span>`
    : '';

  /**
   * ⚠️ **자리 설명은 라벨 옆에 둔다** (2026-08-14, 요청자 지시).
   *    예전에는 라벨 → 입력칸 → 설명 순이라 「계정 이름」과 「카드 맨 위 가운데」 사이를
   *    입력칸이 갈라놓고 있었다. 무엇을 어디에 쓰는 칸인지 한 번에 안 읽혔다.
   *    ⚠️ 세 템플릿이 **모두 이 함수 하나**를 쓴다. 여기만 고치면 셋 다 바뀐다 —
   *       템플릿별로 따로 만들지 말 것.
   *    ⚠️ 노트형 본문처럼 설명이 긴 칸은 라벨 아래로 감긴다(`flex-wrap`). 그건 정상이다.
   */
  return `
    <div class="field tpl-field">
      <div class="tpl-field__head">
        <span class="tpl-field__title">
          <label class="field__label" for="f-${f.id}">${f.label}</label>
          <span class="field__hint field__hint--inline" id="h-${f.id}">${f.hint}</span>
        </span>
        ${counter}
      </div>
      ${control}
      ${tools}
    </div>`;
}

/** 노트형 종이 — 색과 결(자글자글) 강도를 따로 고른다 */
function notePaperHTML(paper, grain) {
  const swatch = (name, list, current, prefix) => `
    <fieldset class="accent__swatches" id="${prefix}-swatches">
      <legend class="sr-only">${name}을 선택하세요</legend>
      ${list.map((x) => `
        <div class="accent__item">
          <input class="sr-only accent__input" type="radio" name="${prefix}" id="${prefix}-${x.id}"
                 value="${x.id}" autocomplete="off" ${String(x.id) === String(current) ? 'checked' : ''}
                 aria-label="${name} ${x.name}" />
          <label class="accent__chip" for="${prefix}-${x.id}">
            ${x.hex ? `<span class="accent__dot" style="background:${x.hex};border:1px solid #D6D6D4"></span>` : ''}${x.name}
          </label>
        </div>`).join('')}
    </fieldset>`;
  // 결은 눈으로 맞추는 값이라 단계로 끊지 않고 슬라이더로 둔다 (요청자 요구)
  const g = Number.isFinite(Number(grain)) ? Number(grain) : DEFAULT_NOTE_GRAIN;
  const level = Number.isInteger(g) && g <= 3 ? [0, 25, 55, 85][g] : g;
  return `
    <h3 class="tpl-form__legend">종이 색</h3>
    ${swatch('종이 색', NOTE_PAPERS, paper || 'white', 'paper')}
    ${noteInkHTML(getState().noteInk, paper)}
    <h3 class="tpl-form__legend">종이 결</h3>
    <div class="grain">
      <input class="grain__range" type="range" id="grain-range" min="0" max="100" step="5"
             value="${level}" autocomplete="off"
             aria-label="종이 결 강도" aria-describedby="grain-hint" />
      <output class="grain__value" id="grain-value" for="grain-range">${level}</output>
    </div>
    <p class="field__hint" id="grain-hint">
      0이면 매끈한 단색, 올릴수록 섬유가 살아나 바스락거리는 종이가 됩니다. 모든 장에 함께 적용됩니다.
    </p>`;
}

/**
 * 노트형 **글씨 색**(2026-08-20 신설, 요청자 요구).
 *
 * ⚠️ 고르는 건 잉크 하나뿐이다. 제목·본문·부제·강조 박스 색은 `noteLayout()` 이 파생시킨다 —
 *    넷을 따로 고르게 하면 조합이 금방 무너진다.
 * ⚠️ 대비 기준이 **흰색이 아니라 지금 고른 종이 색**이다. 카드형(흰 글씨 고정)과 다르다.
 */
function noteInkHTML(current, paper) {
  const ink = getNoteInk(current);
  const paperHex = getNotePaper(paper).hex;
  const custom = isHex(ink.id) ? ink.hex : '';
  return `
    <h3 class="tpl-form__legend">글씨 색</h3>
    <fieldset class="accent__swatches" id="ink-swatches">
      <legend class="sr-only">노트형 글씨 색을 선택하세요</legend>
      ${NOTE_INKS.map((c) => `
        <div class="accent__item">
          <input class="sr-only accent__input" type="radio" name="noteink" id="ink-${c.id}"
                 value="${c.id}" autocomplete="off" ${c.id === ink.id ? 'checked' : ''}
                 aria-label="글씨 색 ${c.name}" />
          <label class="accent__chip" for="ink-${c.id}">
            <span class="accent__dot" style="background:${c.hex}"></span>${c.name}
          </label>
        </div>`).join('')}
      <label class="color-custom" title="원하는 글씨 색 선택">
        <input class="color-custom__input" type="color" id="ink-custom"
               value="${esc(custom || ink.hex)}" autocomplete="off"
               aria-label="원하는 글씨 색 선택" />
        <span class="color-custom__rainbow" aria-hidden="true"></span>
        <span>직접 선택</span>
      </label>
    </fieldset>
    <p class="field__hint" id="ink-hint">${inkHintHTML(ink, paperHex)}</p>`;
}

function inkHintHTML(ink, paperHex) {
  const base = '제목·본문·강조 박스에 함께 적용됩니다.';
  if (!isHex(ink.id)) return `${base} 종이 색 대비를 지키는 색만 넣어 뒀습니다.`;
  const ratio = contrastOn(ink.hex, paperHex);
  return ratio >= 4.5
    ? `${base} 종이 대비 ${ratio.toFixed(2)}:1 — 기준(4.5:1)을 넘깁니다.`
    : `⚠️ ${base} 종이 대비가 ${ratio.toFixed(2)}:1 로 기준(4.5:1)에 못 미칩니다. 글이 잘 안 보일 수 있어요.`;
}

function refreshInkHint(root) {
  const s = getState();
  const hint = root.querySelector('#ink-hint');
  if (hint) hint.innerHTML = inkHintHTML(getNoteInk(s.noteInk), getNotePaper(s.notePaper).hex);
}

/**
 * 노트형 좌상단 심볼 — 레퍼런스의 실험실 아이콘과 같은 결로 여러 개 둔다.
 * 실제 로고 이미지를 넣으면 그쪽이 우선이고 이 심볼은 그려지지 않는다.
 */
function noteSymbolHTML(current) {
  return `
    <h3 class="tpl-form__legend">좌상단 심볼 (본문·마무리)</h3>
    <fieldset class="accent__swatches" id="symbol-swatches">
      <legend class="sr-only">노트형 좌상단 심볼을 선택하세요</legend>
      ${NOTE_SYMBOLS.map((x) => `
        <div class="accent__item">
          <input class="sr-only accent__input" type="radio" name="notesymbol" id="ns-${x.id}"
                 value="${x.id}" autocomplete="off" ${x.id === (current || 'flask') ? 'checked' : ''}
                 aria-label="심볼 ${x.name}" />
          <label class="accent__chip" for="ns-${x.id}">${x.name}</label>
        </div>`).join('')}
    </fieldset>
    <p class="field__hint">모든 본문 장의 왼쪽 위에 함께 들어갑니다. 이미지를 넣으면 그 이미지가 대신 그려집니다.</p>`;
}

/**
 * 카드형 테마 색.
 * ⚠️ 카드마다 두지 않는다. 한 곳(state.cardTheme)에만 두고 모든 장이 그 값을 본다 —
 *    요청자 요구가 "한번 바꾸면 나머지 페이지도 다 바뀌도록" 이다.
 */
function cardThemeHTML(current) {
  // 직접 입력 색이면 어느 견본에도 안 걸린다 — 그때 입력칸에 그 값을 채워 보여준다
  const theme = getCardTheme(current);
  const custom = isHex(theme.id) ? theme.hex : '';
  return `
    <h3 class="tpl-form__legend">테마 색상</h3>
    <fieldset class="accent__swatches" id="theme-swatches">
      <legend class="sr-only">카드 테마 색상을 선택하세요</legend>
      ${CARD_THEMES.map((c) => `
        <div class="accent__item">
          <input class="sr-only accent__input" type="radio" name="cardtheme" id="ct-${c.id}"
                 value="${c.id}" autocomplete="off" ${c.id === theme.id ? 'checked' : ''}
                 aria-label="테마 ${c.name}" />
          <label class="accent__chip" for="ct-${c.id}">
            <span class="accent__dot" style="background:${c.hex}"></span>${c.name}
          </label>
        </div>`).join('')}
      <label class="color-custom" title="원하는 테마 색상 선택">
        <input class="color-custom__input" type="color" id="theme-custom"
               value="${esc(custom || theme.hex)}" autocomplete="off"
               aria-label="원하는 테마 색상 선택" />
        <span class="color-custom__rainbow" aria-hidden="true"></span>
        <span>직접 선택</span>
      </label>
    </fieldset>
    <p class="field__hint" id="theme-hint">${themeHintHTML(theme)}</p>`;
}

/**
 * 테마 색 안내.
 *
 * ⚠️ 카드형은 **모든 글씨가 흰색**이다. 직접 입력한 색이 밝으면 글이 안 읽힌다.
 *    막지는 않는다(요청자 지시 — 직접 입력은 막지 말 것). 대신 몇 대 몇인지 바로 알려 준다.
 *    프리셋은 전부 4.5:1 을 넘기므로 경고가 뜰 일이 없다.
 */
/** 대비 안내만 다시 그린다 — 폼 전체를 다시 그리면 입력 중인 캐럿이 튄다 */
function refreshThemeHint(root) {
  const hint = root.querySelector('#theme-hint');
  if (hint) hint.innerHTML = themeHintHTML(getCardTheme(getState().cardTheme));
}

function themeHintHTML(theme) {
  const base = '모든 장에 함께 적용됩니다.';
  if (!isHex(theme.id)) return `${base} 흰 글씨 대비를 지키는 색만 넣어 뒀습니다.`;
  const ratio = contrastWithWhite(theme.hex);
  return ratio >= 4.5
    ? `${base} 흰 글씨 대비 ${ratio.toFixed(2)}:1 — 기준(4.5:1)을 넘깁니다.`
    : `⚠️ ${base} 흰 글씨 대비가 ${ratio.toFixed(2)}:1 로 기준(4.5:1)에 못 미칩니다. 글이 잘 안 보일 수 있어요.`;
}

/**
 * 카드형 우상단 마크 — 레퍼런스의 별표 말고도 고를 수 있게.
 *
 * ⚠️ 저장된 값을 그대로 비교하지 않고 `getMark()` 를 거친다. 없앤 이모지 마크가
 *    localStorage 에 남아 있으면 어느 견본도 안 켜지는데 렌더러는 별표를 그려서
 *    **화면과 그림이 어긋난다.** getMark 가 기본값으로 되돌려 주므로 그 값으로 맞춘다.
 */
function markHTML(current) {
  const active = getMark(current).id;
  return `
    <h3 class="tpl-form__legend">우상단 마크</h3>
    <fieldset class="accent__swatches" id="mark-swatches">
      <legend class="sr-only">우상단 마크를 선택하세요</legend>
      ${MARKS.map((m) => `
        <div class="accent__item">
          <input class="sr-only accent__input" type="radio" name="mark" id="mk-${m.id}"
                 value="${m.id}" autocomplete="off" ${m.id === active ? 'checked' : ''}
                 aria-label="마크 ${m.name}" />
          <label class="accent__chip" for="mk-${m.id}">${m.name}</label>
        </div>`).join('')}
    </fieldset>
    <p class="field__hint">모든 장의 오른쪽 위에 함께 적용됩니다.</p>`;
}

/**
 * 매거진형 강조 색상 — 형광 초록 말고도 고를 수 있게 한다.
 *
 * ⚠️ 직접 입력칸은 **견본과 같은 줄**에 둔다 (요청자 지시 2026-08-11).
 *    예전에는 아래 줄에 「직접 입력」 라벨과 함께 따로 있었다. 라벨은 뺐고,
 *    무슨 칸인지는 `aria-label` 과 `#RRGGBB` 플레이스홀더가 대신한다.
 *    라벨을 다시 붙이지 말 것 — 줄이 나뉘어 다시 두 단이 된다.
 */
function accentHTML(current) {
  return `
    <h3 class="tpl-form__legend">강조 색상</h3>
    <fieldset class="accent__swatches">
      <legend class="sr-only">강조 색상을 선택하세요</legend>
      ${ACCENTS.map((a) => `
        <div class="accent__item">
          <input class="sr-only accent__input" type="radio" name="accent" id="ac-${a.id}"
                 value="${a.hex}" autocomplete="off" ${a.hex.toLowerCase() === String(current).toLowerCase() ? 'checked' : ''}
                 aria-label="강조 색상 ${a.name}" />
          <label class="accent__chip" for="ac-${a.id}" style="--sw:${a.hex}">
            <span class="accent__dot" aria-hidden="true"></span>${a.name}
          </label>
        </div>`).join('')}
      <label class="color-custom" title="원하는 강조 색상 선택">
        <input class="color-custom__input" type="color" id="accent-custom"
               value="${isHex(current) ? esc(current) : '#B9F73E'}" autocomplete="off"
               aria-label="원하는 강조 색상 선택" />
        <span class="color-custom__rainbow" aria-hidden="true"></span>
        <span>직접 선택</span>
      </label>
    </fieldset>
    <p class="field__hint">모든 장의 강조 문구에 함께 적용됩니다.</p>`;
}

/** 편집 중에도 금지 표현을 잡는다 — 2단계와 같은 기준 */
function warnHTML(t) {
  const text = ['title', 'highlight', 'body'].map((k) => t[k] || '').join('\n');
  const banned = findBanned(text, BANNED_PHRASES);
  if (!banned.length) return '';
  return `
    <div class="notice notice--warn" role="alert">
      <span class="notice__icon" aria-hidden="true">${icon('alert', 'icon--sm')}</span>
      <div>
        <strong>게시 전 확인이 필요합니다</strong>
        <ul>${banned.map((b) => `<li>금지 표현 포함: "${esc(b)}"</li>`).join('')}</ul>
      </div>
    </div>`;
}

/* ---------------- 바인딩 ---------------- */

function bindConcepts(root) {
  root.querySelector('#tpl-concepts')?.addEventListener('change', (e) => {
    if (e.target.name !== 'tpl-concept') return;
    setState({ concept: e.target.value });
    active = 0;
    selectedObj = null;   // 오브젝트 구성 자체가 바뀐다
    render(root);   // 슬롯 구성·저장 키·추천 문구가 모두 바뀌므로 전체를 다시 그린다
    toast(`${getConcept(e.target.value).name} 템플릿으로 바꿨습니다.`);
  });
}

function bindTabs(root) {
  const tabs = [...root.querySelectorAll('[data-card-tab]')];

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => selectCard(root, Number(tab.dataset.cardTab)));

    // 좌우 화살표 / Home / End (WAI-ARIA 탭 패턴)
    tab.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(tab);
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const next = (map[e.key] + tabs.length) % tabs.length;
      selectCard(root, next);
      root.querySelector(`[data-card-tab="${next}"]`)?.focus();
    });
  });
}

function selectCard(root, i) {
  active = i;
  selectedObj = null;   // 카드마다 상자 좌표가 다르다 — 선택은 넘겨받지 않는다
  flashObj = null;
  clearTimeout(flashTimer);
  root.querySelectorAll('[data-card-tab]').forEach((t) => {
    const on = Number(t.dataset.cardTab) === i;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  refreshForm(root);
  refreshImagePanel(root);
  refreshSource(root);
  paint(root);
}

function refreshForm(root) {
  const slot = root.querySelector('#tpl-form-fields');
  if (!slot) return;
  slot.innerHTML = formHTML();
  bindForm(root);
}

/** 카운터만 갱신한다 — 폼을 다시 그리면 입력 중 캐럿이 튄다 */
function updateCount(root, el) {
  const slot = slotsFor(getState().concept, deck[active].kind).find((x) => x.id === el.dataset.f);
  const out = root.querySelector(`[data-count="${el.dataset.f}"]`);
  if (!slot?.max || !out) return;
  out.textContent = `${el.value.length} / ${slot.max}자`;
  out.classList.toggle('tpl-count--over', el.value.length > slot.max);
}

function bindForm(root) {
  root.querySelector('#add-text-box')?.addEventListener('click', () => {
    const s = getState();
    const extraTexts = fitExtraTexts(s.card.extraTexts);
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    extraTexts[active].push({ id, text: '텍스트를 입력하세요', x: 0.1, y: 0.42, w: 0.8, h: 0.14, fontSize: 40, fontWeight: 400, textAlign: 'left' });
    setState({ card: { ...s.card, extraTexts } });
    selectedObj = `extra-${id}`;
    refreshForm(root);
    paint(root);
    markDirty(root);
  });

  root.querySelectorAll('[data-extra-text]').forEach((el) => {
    el.addEventListener('input', () => {
      const s = getState();
      const extraTexts = fitExtraTexts(s.card.extraTexts);
      const item = extraTexts[active].find((x) => x.id === el.dataset.extraText);
      if (!item) return;
      item.text = el.value;
      setState({ card: { ...s.card, extraTexts } });
      schedulePaint(root);
      markDirty(root);
    });
  });

  root.querySelectorAll('[data-delete-extra]').forEach((button) => {
    button.addEventListener('click', () => {
      const s = getState();
      const id = button.dataset.deleteExtra;
      const extraTexts = fitExtraTexts(s.card.extraTexts);
      extraTexts[active] = extraTexts[active].filter((x) => x.id !== id);
      const layout = fitLayout(s.card.layout);
      delete layout[active][`extra-${id}`];
      setState({ card: { ...s.card, extraTexts, layout } });
      if (selectedObj === `extra-${id}`) selectedObj = null;
      refreshForm(root);
      paint(root);
      markDirty(root);
    });
  });

  root.querySelectorAll('[data-extra-align]').forEach((button) => {
    button.addEventListener('click', () => {
      const s = getState();
      const extraTexts = fitExtraTexts(s.card.extraTexts);
      const item = extraTexts[active].find((x) => x.id === button.dataset.extraId);
      if (!item) return;
      item.textAlign = button.dataset.extraAlign;
      setState({ card: { ...s.card, extraTexts } });
      refreshForm(root);
      paint(root);
      markDirty(root);
    });
  });

  root.querySelectorAll('[data-f]').forEach((el) => {
    el.addEventListener('input', () => {
      const s = getState();
      const texts = cloneTexts(s.card.texts);
      texts[active] = { ...texts[active], [el.dataset.f]: el.value };
      setState({ card: { ...s.card, texts } });

      // 입력 중에는 캔버스만 갱신한다 — 폼을 다시 그리면 캐럿이 튄다
      schedulePaint(root);
      markDirty(root);
      updateCount(root, el);
      const warn = root.querySelector('#tpl-warn');
      if (warn) warn.innerHTML = warnHTML(texts[active]);
      const reset = root.querySelector('#reset-one');
      if (reset) reset.disabled = !isEdited(getState().card, active);
    });
  });

  root.querySelector('.accent__swatches')?.addEventListener('change', (e) => {
    if (e.target.name !== 'accent') return;
    setState({ accent: e.target.value });
    paint(root);
    markDirty(root);
    refreshForm(root);   // 직접 선택 칩의 활성 표시를 견본 기준으로 되돌린다
  });

  /**
   * 강조 색상 직접 선택 — 무지개 동그라미를 누르면 시스템 색상 팔레트가 열린다(요청자 지시
   * 2026-08-11). 예전엔 `#RRGGBB` 를 손으로 쳐야 했는데, 팔레트가 훨씬 자유롭게 고를 수 있다.
   * 드래그하는 동안은 `input` 이 계속 온다 — 그때마다 캔버스만 갱신하고, 팔레트를 닫을 때
   * (`change`) 이력에 남기고 폼(직접 선택 칩의 활성 표시)을 다시 그린다.
   */
  root.querySelector('#accent-custom')?.addEventListener('input', (e) => {
    setState({ accent: e.target.value });
    root.querySelectorAll('[name="accent"]').forEach((r) => { r.checked = false; });
    schedulePaint(root);
  });
  root.querySelector('#accent-custom')?.addEventListener('change', () => {
    markDirty(root);
    refreshForm(root);
  });

  root.querySelector('#mark-swatches')?.addEventListener('change', (e) => {
    if (e.target.name !== 'mark') return;
    setState({ mark: e.target.value });
    paint(root);
    markDirty(root);
  });

  // 테마 색은 모든 장에 걸린다. 상태 한 곳만 바꾸면 나머지 장은 다시 그릴 때 따라온다.
  root.querySelector('#theme-swatches')?.addEventListener('change', (e) => {
    if (e.target.name !== 'cardtheme') return;
    setState({ cardTheme: e.target.value });
    refreshThemeHint(root);
    paint(root);
    markDirty(root);
    refreshForm(root);   // 직접 선택 칩의 활성 표시를 견본 기준으로 되돌린다
  });

  /** 테마 색 직접 선택 — 강조 색상(`#accent-custom`)과 같은 규칙이다 */
  root.querySelector('#theme-custom')?.addEventListener('input', (e) => {
    setState({ cardTheme: e.target.value });
    root.querySelectorAll('[name="cardtheme"]').forEach((r) => { r.checked = false; });
    refreshThemeHint(root);
    schedulePaint(root);
  });
  root.querySelector('#theme-custom')?.addEventListener('change', () => {
    markDirty(root);
    refreshForm(root);
  });

  root.querySelector('#symbol-swatches')?.addEventListener('change', (e) => {
    if (e.target.name !== 'notesymbol') return;
    setState({ noteSymbol: e.target.value });
    paint(root);
    markDirty(root);
  });

  root.querySelector('#paper-swatches')?.addEventListener('change', (e) => {
    if (e.target.name !== 'paper') return;
    setState({ notePaper: e.target.value });
    refreshInkHint(root);   // 대비 기준이 종이 색이라 종이를 바꾸면 안내도 다시 계산한다
    paint(root);
    markDirty(root);
  });

  // 글씨 색 — 카드형 테마 색과 같은 규칙(견본 선택 / 직접 선택 / 막지 않고 경고만)
  root.querySelector('#ink-swatches')?.addEventListener('change', (e) => {
    if (e.target.name !== 'noteink') return;
    setState({ noteInk: e.target.value });
    refreshInkHint(root);
    paint(root);
    markDirty(root);
    refreshForm(root);   // 직접 선택 칩의 활성 표시를 견본 기준으로 되돌린다
  });
  root.querySelector('#ink-custom')?.addEventListener('input', (e) => {
    setState({ noteInk: e.target.value });
    root.querySelectorAll('[name="noteink"]').forEach((r) => { r.checked = false; });
    refreshInkHint(root);
    schedulePaint(root);
  });
  root.querySelector('#ink-custom')?.addEventListener('change', () => {
    markDirty(root);
    refreshForm(root);
  });

  // 슬라이더는 끄는 동안 계속 그리면 무거워서 캔버스만 모아 그린다
  root.querySelector('#grain-range')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    setState({ noteGrain: v });
    const out = root.querySelector('#grain-value');
    if (out) out.textContent = String(v);
    schedulePaint(root);
    markDirty(root);
  });

  root.querySelectorAll('[data-insert]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ta = root.querySelector(`#${btn.dataset.insertTarget}`);
      if (!ta) return;
      const x = INSERTS[Number(btn.dataset.insert)];
      const { selectionStart: a, selectionEnd: b, value: v } = ta;
      const before = v.slice(0, a);
      const sel = v.slice(a, b);
      const after = v.slice(b);
      let next;
      let caret;

      if (x.wrap) {
        const inner = sel || '강조할 문구';
        next = before + x.wrap[0] + inner + x.wrap[1] + after;
        caret = (before + x.wrap[0] + inner + x.wrap[1]).length;
      } else if (x.line) {
        // 줄 표시는 커서가 있는 줄의 맨 앞에 붙여야 뜻이 통한다
        const ls = before.lastIndexOf('\n') + 1;
        next = before.slice(0, ls) + x.line + before.slice(ls) + sel + after;
        caret = (before.slice(0, ls) + x.line + before.slice(ls) + sel).length;
      } else {
        next = before + x.text + sel + after;
        caret = (before + x.text + sel).length;
      }

      ta.value = next;
      ta.dispatchEvent(new Event('input', { bubbles: true }));   // 상태 저장·미리보기 갱신
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  });

  root.querySelector('#reset-one')?.addEventListener('click', () => {
    const s = getState();
    const texts = cloneTexts(s.card.texts);
    texts[active] = { ...s.card.base[active] };
    setState({ card: { ...s.card, texts } });
    refreshForm(root);
    refreshNotices(root);
    paint(root);
    markDirty(root);
    toast(`${active + 1}번 카드를 추천 문구로 되돌렸습니다.`);
  });

  bindLayoutPanel(root);
}

/* ---------------- 이미지 패널 ---------------- */

function refreshImagePanel(root) {
  const slot = root.querySelector('#tpl-image');
  if (!slot) return;
  slot.innerHTML = imagePanelSlot();
  bindImagePanelHere(root);
}

function bindImagePanelHere(root) {
  bindImagePanel(root, {
    onUpload: (file) => putUploaded(root, file),
    onDelete: () => removeImage(root),
    onCopy: () => copyText(promptFor(active), `${active + 1}번 프롬프트를 복사했습니다.`),
    onToggleLock: () => toggleBackgroundLock(root),
  });
}

function toggleBackgroundLock(root) {
  const s = getState();
  const current = s.images[active] || {};
  const locked = !current.locked;
  setState({ images: { ...s.images, [active]: { ...current, locked } } });
  if (locked && selectedObj === 'image') selectedObj = null;
  refreshImagePanel(root);
  paint(root);
  toast(`배경 이미지 잠금을 ${locked ? '켰습니다.' : '해제했습니다.'}`);
}

/** 이미지가 바뀌면 미리보기·안내문·패널을 함께 맞춘다 */
async function applyImage(root, i, blob, source) {
  const s = getState();
  if (blob) {
    await putImage(imageKey(s.productId, s.concept, i), blob);
    const previous = getState().images[i] || {};
    setState({ images: { ...getState().images, [i]: { ...previous, source, at: Date.now() } } });
    bitmaps[i] = await loadImage(blob).catch(() => null);
  } else {
    await deleteImage(imageKey(s.productId, s.concept, i));
    const images = { ...s.images };
    delete images[i];
    setState({ images });
    bitmaps[i] = null;
  }
  if (i === active) {
    refreshImagePanel(root);
    refreshSource(root);
    paint(root);
  }
  refreshNotices(root);
}

async function putUploaded(root, file) {
  if (!file.type.startsWith('image/')) { toast('이미지 파일만 올릴 수 있습니다.'); return; }
  await applyImage(root, active, file, 'upload');
  toast('이미지를 올렸습니다.');
}

async function removeImage(root) {
  await applyImage(root, active, null);
  toast('이미지를 지웠습니다.');
}

function refreshNotices(root) {
  const slot = root.querySelector('#tpl-notices');
  if (!slot) return;
  bindNotices(root);
}

function bindNotices(root) {
}

/* ---------------- 그리기 ---------------- */

async function loadBitmaps() {
  const s = getState();
  bitmaps = new Array(deck.length).fill(null);
  for (let i = 0; i < deck.length; i++) {
    const blob = await getImage(imageKey(s.productId, s.concept, i));
    if (blob) bitmaps[i] = await loadImage(blob).catch(() => null);
  }
}

/**
 * 그림 프롬프트 — 지금 화면에 보이는 **대주제**를 함께 넘긴다.
 * 노트형은 그 주제를 아이콘으로 그리므로 제목이 빠지면 엉뚱한 그림이 나온다.
 */
/**
 * 블로그의 `📷 [이미지 N …]` 바로 다음 `⤷` 문장은 해당 카드 이미지의
 * 실제 주제다. AI가 만든 shot보다 사용자가 보고 있는 최종 문구를 우선한다.
 */
function draftImageCaptions(s) {
  const drafts = [s.drafts?.blog, ...Object.values(s.drafts || {})];
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

function imageCaptionFor(s, index) {
  return draftImageCaptions(s)[index] || '';
}

/**
 * 블로그 원문에서 **카드별 재료**를 뽑는다 (2026-08-20 신설).
 *
 * ⚠️ 왜 바꿨나 — 요청자 지적: "템플릿에 들어가는 내용이 본문 요약이 아니라 다른 내용 같다."
 *
 * 예전에는 카드 제목이 **아웃라인 뼈대**(`core.points[].q`)에서 오고, 본문은
 * 뼈대의 `a` 첫 문장만 블로그 캡션으로 바꿔 끼웠다. 그런데 블로그는 뼈대를 받아
 * AI 가 **자기 문장으로 다시 쓴다.** 그래서 화면의 글과 카드의 글이 서로 다른 말을 했고,
 * 섞인 자리(캡션 + 뼈대 나머지)는 앞뒤가 안 맞았다.
 *
 * 이제 **완성된 블로그에서 직접** 가져온다. 대응 규칙은 앱이 이미 정해 둔 그대로다 —
 * 블로그 프롬프트가 `📷` 줄을 "그 카드가 대응하는 단락 **바로 뒤**"에 놓게 하므로,
 * `📷 [이미지 N]` 기준으로 **바로 위 소제목**과 **바로 위 문단**이 곧 N번 카드의 재료다.
 *
 * @returns {Object<number, {head:string, para:string, caption:string}>} 0-based 카드 index 기준
 */
function blogCardSource(s) {
  const draft = String(s.drafts?.blog || '');
  if (!draft.trim()) return {};
  const lines = draft.split(/\r?\n/);
  const isHead = (t) => t.startsWith(HEAD_MARK);
  const isShot = (t) => /^📷/.test(t);
  /**
   * 본문이 아닌 줄 — 캡션·개요표·해시태그·구분선·인용 요약·목차.
   *
   * ⚠️ **소제목을 먼저 걸러낸다.** `HEAD_MARK` 는 `■` 가 아니라 **`##`** 이고(화면에서만 ■ 로 보인다),
   *    해시태그를 잡으려고 넣은 `#` 가 소제목까지 함께 삼켰다. 그러면 카드 제목이 영영 안 잡힌다.
   */
  const noise = (t) => !isHead(t)
    && (/^[⤷🔔─>#]/.test(t) || /^\[테이블/.test(t) || /^\d+\.\s/.test(t) || t === '목차');

  /** from 부터 step 방향으로 훑어 문단 하나를 모은다. */
  const paragraphAt = (from, step) => {
    const got = [];
    for (let j = from; j >= 0 && j < lines.length; j += step) {
      const t = lines[j].trim();
      if (!t) { if (got.length) break; continue; }   // 문단 사이 빈 줄에서 끊는다
      if (isHead(t) || isShot(t)) break;             // 다른 대목으로 넘어갔다
      if (noise(t)) continue;
      got.push(t);
    }
    return (step > 0 ? got : got.reverse()).join(' ').trim();
  };

  const out = {};
  let above = '';   // 이 이미지보다 위에 있던 마지막 소제목 (옛 배치 폴백용)
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    if (isHead(t)) { above = t.slice(HEAD_MARK.length).trim(); return; }
    const no = t.match(/^📷\s*\[이미지\s*(\d+)/)?.[1];
    if (!no) return;
    const caption = String(lines[i + 1] || '').match(/^\s*⤷\s*(.+?)\s*$/)?.[1] || '';

    /**
     * 배치는 `📷 -> 캡션 -> 소제목 -> 본문 문단` 이다 (요청자 지시 2026-08-20).
     * 이미지는 그 대목을 **여는** 그림이므로, 이 카드의 제목은 **아래에 있는 소제목**이고
     * 본문은 그 소제목의 첫 문단이다.
     *
     * 아래에서 소제목을 못 찾으면 **위 소제목으로 떨어진다.** 옛 글·보관본은 이미지가
     * 문단 뒤에 있어서 그때는 위가 맞다. 두 배치 모두 살아 있어야 예전 게시물이 안 깨진다.
     */
    let head = '';
    let para = '';
    for (let j = i + 1; j < lines.length; j++) {
      const u = lines[j].trim();
      if (isHead(u)) { head = u.slice(HEAD_MARK.length).trim(); para = paragraphAt(j + 1, 1); break; }
      if (!u || noise(u)) continue;
      if (isShot(u)) break;              // 다음 카드까지 왔다 - 아래에 소제목이 없다
      break;                             // 소제목 없이 본문이 먼저 나왔다 (옛 배치)
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
 * 카드 문구를 블로그 원문 기준으로 바꿔 끼운다.
 *
 * - **표지**: 제목은 첫 캡션(= 글 전체를 한 줄로 요약한 후킹)
 * - **본문·반론**: 제목은 그 자리의 `■ 소제목`, 본문은 `📷` 바로 위 문단
 * - **마무리**: 건드리지 않는다 — 승인된 마무리 문장이라 바꾸면 안 된다(사실성 원칙 4번)
 *
 * 블로그에 `📷` 줄이 없으면(규칙 기반 글·옛 보관본) 원래 카드를 그대로 둔다.
 */
/**
 * 카드형에만 **팔로우 카드를 한 장 더한다** (2026-08-21, 요청자 지시).
 *
 * 요청자: "카드형은 4장을 선택하더라도 마무리 한 장을 추가해 줘. 4장이면 5번째 장, 2장이면 3번째 장."
 *
 * 왜 카드형만인가 — 카드형의 마무리 장은 **테마색 단색 + 팔로우 문구**라 내용을 하나도 담지 않는다
 * (8절 템플릿 표). 그래서 4장을 고르면 실제로 읽을 카드는 표지+본문 2장, 셋뿐이었다.
 * 매거진형·노트형의 마무리 장은 승인된 마무리 문장을 본문으로 담으므로 이 문제가 없다.
 *
 * 고른 장수만큼은 전부 내용 카드가 되고, 팔로우 카드는 **덤으로 맨 뒤에** 붙는다.
 *
 * ⚠️ **`deckFromBlog()` 뒤에서 더한다.** 앞에서 더하면 카드 문구(`cardCopy`)와 길이가 어긋나
 *    `copy.length === cards.length` 가 깨지고, 파생이 만든 문구가 통째로 버려진다.
 * ⚠️ 팔로우 카드는 **이미지를 쓰지 않는다**(`usesImage`). 그래서 장을 더해도 만들 이미지는 안 는다.
 * ⚠️ 기존 마무리 장은 이제 `roleOf()` 에서 **본문 역할**이 된다 — 승인된 마무리 문장과 CTA가
 *    비로소 카드형에서도 읽힌다. 8-25 에서 노트형에 해 둔 것과 같은 취지다.
 */
function withFollowCard(cards, conceptId, product) {
  if (conceptId !== 'card' || !cards.length) return cards;
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

function deckFromBlog(cards, s) {
  /**
   * ⚠️ **파생 1회가 만든 카드 문구가 있으면 그것이 우선이다** (2026-08-20).
   *    `blogCardSource()` 는 블로그 소제목을 **앞에서부터** 집어 오므로, 장수가 적으면
   *    글 뒤쪽이 통째로 빠진다(요청자 지적: "카드만 쓸 때 내용이 자연스럽지 않다").
   *    `cardCopy` 는 글 전체를 보고 만든 것이라 **카드만 넘겨도 말이 된다.**
   *    ⚠️ 마무리 카드는 여기서도 건드리지 않는다 — 승인된 CTA·마무리 문장 자리다.
   */
  const copy = s.cardCopy?.key === draftKeyOf(s) ? s.cardCopy.cards : null;
  if (copy?.length === cards.length) {
    return cards.map((card, i) => (card.kind === 'outro' ? card : {
      ...card,
      title: copy[i].title || card.title,
      body: copy[i].body || card.body,
    }));
  }
  const src = blogCardSource(s);
  if (!Object.keys(src).length) return cards;
  return cards.map((card, i) => {
    const slot = src[i];
    if (!slot) return card;
    /**
     * ⚠️ **표지는 뼈대의 후킹(`card.title`)이 먼저다** (2026-08-21, 요청자 지시).
     *    예전에는 블로그 첫 캡션을 먼저 썼다. 캡션은 「그 대목의 핵심 한 줄」이라 **설명문**이고,
     *    표지에 얹히면 「수상기사는 숨겨두지 말고 …하세요」처럼 나온다.
     *    후킹은 `HOOK_RULE`(lib/outline.js)이 압축해서 만든 값이라 표지에는 그쪽이 맞다.
     */
    if (card.kind === 'cover') return { ...card, title: card.title || slot.caption };
    if (card.kind === 'outro') return card;
    return {
      ...card,
      title: slot.head || card.title,
      body: slot.para || slot.caption || card.body,
    };
  });
}

/**
 * 지금 카드가 **어느 블로그에서 나왔는지** 나타내는 지문.
 *
 * ⚠️ `draftKeyOf()` 는 상품·주제·톤·장수만 본다. AI 를 다시 생성해도 그 넷은 그대로라
 *    카드가 **옛 글의 문구를 계속 들고 있었다** — 요청자 지적("본문과 다른 내용")의 나머지 절반이다.
 */
function blogFingerprint(s) {
  const t = String(s.drafts?.blog || '');
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return `${t.length}:${h}`;
}

const promptFor = (i) => {
  const s = getState();
  return buildPrompt(deck[i], s.concept, {
    index: i,   // 카드마다 프레이밍을 다르게 돌린다 (lib/imageprompt.js 의 FRAMING)
    title: s.card?.texts?.[i]?.title || deck[i].title,
    subject: imageCaptionFor(s, i),
  });
};


/**
 * ⚠️ 드래그 중인 카드(`active`)만 `draftBox` 로 미리보기를 덮어쓴다.
 *    확정 저장 전까지는 `state.card.layout` 을 건드리지 않는다 — 손을 떼기 전에 취소하거나
 *    (짧게 눌렀다 뗀 경우) 값이 남지 않아야 하기 때문이다.
 */
function opts(s, i) {
  const saved = s.card.layout?.[i] || {};
  const layout = (dragging && draftBox && i === active) ? { ...saved, [dragging.obj]: draftBox } : saved;
  return {
    conceptId: s.concept, kind: deck[i].kind, image: bitmaps[i] || null,
    accent: s.accent, cardTheme: s.cardTheme, mark: s.mark,
    noteSymbol: s.noteSymbol, notePaper: s.notePaper, noteGrain: s.noteGrain, noteInk: s.noteInk,
    layout, extraTexts: s.card.extraTexts?.[i] || [],
  };
}

function paint(root) {
  const canvas = root.querySelector('#tpl-canvas');
  if (!canvas) return;
  const s = getState();
  const texts = s.card.texts[active];
  renderCard(canvas, texts, opts(s, active));
  canvas.setAttribute('aria-label', cardAlt(texts, active));
  // ⚠️ 잘림 기록·오브젝트 상자는 **그린 직후에만** 유효하다 (renderCard 가 매번 비운다)
  refreshOverflow(root, lastClipped());
  syncOverlay(root);
}

/** rAF 로 한 프레임에 한 번만 그린다 — 드래그는 pointermove 가 아주 잦아서 디바운스(schedulePaint)로는
 *  손을 뗄 때까지 캔버스가 멈춰 보인다. */
function requestPaint(root) {
  if (paintScheduled) return;
  paintScheduled = true;
  requestAnimationFrame(() => { paintScheduled = false; paint(root); });
}

/**
 * 글이 카드 밖으로 밀려 잘렸는지 알린다.
 *
 * 예전에는 렌더러가 조용히 `…` 로 잘라서 **글이 사라진 걸 아무도 몰랐다.**
 * 막지는 않는다(직접 길게 쓰는 건 자유다) — 대신 어느 칸이 잘렸는지 정확히 짚어 준다.
 */
function refreshOverflow(root, clippedSlots) {
  const slots = slotsFor(getState().concept, deck[active].kind);
  const labelOf = (id) => slots.find((x) => x.id === id)?.label || id;

  root.querySelectorAll('[data-f]').forEach((el) => {
    el.classList.toggle('is-clipped', clippedSlots.includes(el.dataset.f));
  });

  const box = root.querySelector('#tpl-overflow');
  if (!box) return;
  if (!clippedSlots.length) { box.innerHTML = ''; return; }

  const names = [...new Set(clippedSlots)].map(labelOf);
  box.innerHTML = `
    <div class="notice notice--warn" role="alert">
      <span class="notice__icon" aria-hidden="true">${icon('alert', 'icon--sm')}</span>
      <div>
        <strong>글이 카드에 다 들어가지 않아 잘렸습니다</strong>
        <p>${esc(names.join(' · '))} 를 줄여 주세요. 지금은 뒷부분이 카드에 나오지 않습니다.</p>
      </div>
    </div>`;
}

/** 글자 한 자마다 큰 캔버스를 다시 그리지 않도록 살짝 모아서 그린다 */
function schedulePaint(root) {
  clearTimeout(repaintTimer);
  repaintTimer = setTimeout(() => paint(root), 120);
}

function refreshSource(root) {
  const el = root.querySelector('#tpl-src');
  if (!el) return;
  const s = getState();
  const concept = getConcept(s.concept);
  if (concept.id === 'card' && roleOf('card', deck[active].kind) === 'outro') {
    el.textContent = '마무리 카드 — 파랑 단색 배경 고정입니다.';
    return;
  }
  const kindWord = concept.id === 'note' ? '아이콘' : '배경';
  const src = s.images[active]?.source;
  el.textContent = bitmaps[active]
    ? `${kindWord} 이미지 ${src === 'upload' ? '업로드본' : '생성본'}을 넣었습니다.`
    : `${kindWord} 이미지 없음 — 템플릿 기본 배경으로 그립니다.`;
}

/* ---------------- 오브젝트 자유 배치 ---------------- */

function editableObjects(s = getState(), i = active) {
  const builtIn = objectsFor(s.concept, deck[i].kind)
    .filter((item) => item.id !== 'image' || !s.images[i]?.locked)
    // 배경은 언제나 가장 먼저 그려 다른 선택 상자보다 아래에 둔다.
    .sort((a, b) => (a.id === 'image' ? -1 : b.id === 'image' ? 1 : 0));
  const extras = (s.card.extraTexts?.[i] || []).map((item, n) => ({
    id: `extra-${item.id}`, type: 'text', label: `추가 텍스트 ${n + 1}`,
  }));
  return [...builtIn, ...extras];
}

/**
 * 손잡이를 캔버스 위에 겹쳐 그린다. `lastBoxes()`(렌더러가 실제로 그린 자리)를 그대로 옮기므로
 * 자동 배치든 오버라이드든 손잡이는 늘 진짜 결과와 일치한다.
 */
function syncOverlay(root) {
  const overlay = root.querySelector('#tpl-overlay');
  if (!overlay) return;
  const s = getState();
  const objs = editableObjects(s);
  const boxes = lastBoxes();
  const known = new Set(objs.map((o) => o.id));
  if (selectedObj && !known.has(selectedObj)) selectedObj = null;

  overlay.innerHTML = objs.filter((o) => boxes[o.id]).map((o) => handleHTML(o, boxes[o.id])).join('');
  // 편집 영역 밖을 만진 뒤에는 점선을 숨긴다. 클릭은 그대로 받으므로 미리보기를 누르면 다시 켜진다.
  overlay.classList.toggle('is-idle', overlayIdle);
  refreshLayoutPanel(root);
}

const GRIPS = ['nw', 'ne', 'sw', 'se'];

function handleHTML(o, box) {
  const style = `left:${(box.x / W) * 100}%;top:${(box.y / H) * 100}%;`
    + `width:${(box.w / W) * 100}%;height:${(box.h / H) * 100}%`;
  const on = o.id === selectedObj;
  const flashing = o.id === flashObj;
  return `
    <div class="tpl-handle${on ? ' is-selected' : ''}" data-obj="${o.id}" style="${style}"
         tabindex="0" role="button" aria-pressed="${on}"
         aria-label="${esc(o.label)} 위치·크기 — 드래그하거나 방향키로 옮기고, 아래 숫자 입력으로도 조정할 수 있습니다">
      <span class="tpl-handle__label${flashing ? ' is-flash' : ''}">${esc(o.label)}</span>
      ${on ? GRIPS.map((gr) => `<span class="tpl-handle__grip tpl-handle__grip--${gr}" data-grip="${gr}"></span>`).join('') : ''}
    </div>`;
}

/**
 * 오브젝트를 선택 상태로 만들고 손잡이·숫자 패널을 다시 그린다.
 * 이름표는 평소엔 숨어 있다가 이 시점에만 잠깐 떴다 사라진다 — 미리보기가 이름표로
 * 뒤덮이지 않도록 클릭한 상자만 알려 준다(요청자 지시 2026-08-11).
 */
function selectObj(root, objId) {
  selectedObj = objId;
  flashObj = objId;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { flashObj = null; }, 1400);
  syncOverlay(root);
}

/** 확정 저장 — 드래그가 끝났을 때도, 숫자 입력으로 고쳤을 때도 여기 하나를 거친다 */
function commitLayout(root, objId, box) {
  const s = getState();
  const layout = fitLayout(s.card.layout);
  const obj = editableObjects(s).find((o) => o.id === objId);
  const previous = layout[active][objId] || {};
  let nextBox = { ...previous, ...box };

  /**
   * ⚠️ 위치·크기가 하나도 없는 오버라이드를 만들면 안 된다 (요청자 지적 2026-08-14 — "튕김").
   *
   * 드래그 없이 글자를 한 번 누르고 곧바로 「텍스트 크기」를 바꾸면 `applyLayoutInputs()` 가
   * `{ fontSize }` 만 들고 온다. 그대로 저장하면 `layout[id]` 는 있는데 x·y 가 없는 상자가 되고,
   * 렌더러의 `denorm()` 이 undefined 를 계산해 **NaN 좌표**가 나온다 — 글자가 엉뚱한 자리로 튄다.
   * 지금 그려져 있는 자리(`lastBoxes()`)를 바닥값으로 깔아 둔다. 방향키 경로가 이미 하는 일과 같다.
   */
  const drawn = lastBoxes()[objId];
  if (drawn && nextBox.x === undefined) {
    nextBox = { x: drawn.x / W, y: drawn.y / H, w: drawn.w / W, h: drawn.h / H, ...nextBox };
  }

  // 자동 배치 텍스트를 처음 옮기는 순간에도 현재 보이던 서체를 그대로 이어받는다.
  // 이 값이 없으면 위치 저장 직후 상자 맞춤 로직이 다시 돌아 글자가 갑자기 작아진다.
  if (obj?.type === 'text' && !nextBox.fontSize) {
    const defaultSizes = { brand: 36, eyebrow: 30, title: 82, footer: 30 };
    const defaultWeights = { brand: 900, eyebrow: 700, title: 900, footer: 500 };
    nextBox.fontSize = lastSizes()[objId]?.size || defaultSizes[objId] || (objId.startsWith('extra-') ? 40 : 30);
    nextBox.fontWeight = Number(nextBox.fontWeight) || defaultWeights[objId] || (objId.startsWith('extra-') ? 400 : 500);
  }

  layout[active] = { ...layout[active], [objId]: nextBox };
  setState({ card: { ...s.card, layout } });
  paint(root);
  refreshNotices(root);
  markDirty(root);
}

function startDrag(root, e, objId, grip) {
  e.preventDefault();
  const wrap = root.querySelector('#tpl-canvas-wrap');
  const cur = lastBoxes()[objId];
  if (!wrap || !cur) return;
  selectObj(root, objId);
  const rect = wrap.getBoundingClientRect();
  dragging = {
    obj: objId, grip: grip || null,
    startClientX: e.clientX, startClientY: e.clientY,
    startBox: { x: cur.x / W, y: cur.y / H, w: cur.w / W, h: cur.h / H },
    rectW: rect.width, rectH: rect.height,
  };
  draftBox = { ...dragging.startBox };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd, { once: true });
}

function onDragMove(e) {
  if (!dragging || !currentRoot) return;
  const dx = (e.clientX - dragging.startClientX) / dragging.rectW;
  const dy = (e.clientY - dragging.startClientY) / dragging.rectH;
  const { startBox, grip } = dragging;
  const box = { ...startBox };
  if (!grip) {
    box.x = startBox.x + dx;
    box.y = startBox.y + dy;
  } else {
    if (grip.includes('w')) { box.x = startBox.x + dx; box.w = startBox.w - dx; }
    if (grip.includes('e')) { box.w = startBox.w + dx; }
    if (grip.includes('n')) { box.y = startBox.y + dy; box.h = startBox.h - dy; }
    if (grip.includes('s')) { box.h = startBox.h + dy; }
  }
  // 완전히 뒤집히거나 0에 가까워지지 않게만 막는다 — 그 밖의 자유는 요청자 지시대로 막지 않는다
  box.w = Math.max(0.03, box.w);
  box.h = Math.max(0.02, box.h);
  draftBox = box;
  requestPaint(currentRoot);
}

function onDragEnd(e) {
  window.removeEventListener('pointermove', onDragMove);
  if (!dragging) return;
  const { obj, startClientX, startClientY } = dragging;
  const movedPx = Math.hypot((e.clientX ?? startClientX) - startClientX, (e.clientY ?? startClientY) - startClientY);
  const root = currentRoot;
  const finalBox = draftBox ? { ...draftBox } : null;

  // 최종 렌더링보다 먼저 임시 드래그 상태를 비운다. 이 순서가 뒤집히면 단순 클릭에서도
  // opts()가 임시 상자를 사용자 배치로 해석해 자동 축소한 화면을 마지막 프레임으로 남긴다.
  dragging = null;
  draftBox = null;

  // 클릭할 때 생기는 미세한 손떨림은 이동으로 보지 않는다. 선택만으로 배치 오버라이드가
  // 생기면 상자 맞춤 렌더링 경로로 바뀌어 보이는 결과도 달라질 수 있다.
  if (movedPx >= 8 && finalBox && root) commitLayout(root, obj, finalBox);
  else if (root) paint(root);
}

function extraTextsHTML(items) {
  if (!items.length) return '';
  return `
    <h3 class="tpl-form__legend">추가 텍스트 상자</h3>
    <div class="tpl-extra-list">
      ${items.map((item) => `
        <div class="field tpl-extra">
          <div class="tpl-field__head">
            <label class="field__label" for="extra-${esc(item.id)}">텍스트</label>
            <button type="button" class="btn btn--ghost btn--sm" data-delete-extra="${esc(item.id)}"
                    aria-label="이 텍스트 상자 삭제">${icon('trash', 'icon--sm')} 삭제</button>
          </div>
          <textarea class="textarea tpl-ta" id="extra-${esc(item.id)}" data-extra-text="${esc(item.id)}"
                    rows="2" spellcheck="false">${esc(item.text || '')}</textarea>
          <div class="tpl-inserts tpl-align-tools" role="group" aria-label="추가 텍스트 서식과 정렬">
            <button type="button" class="tpl-insert tpl-format-icon" data-insert="0" data-insert-target="extra-${esc(item.id)}"
                    aria-label="강조" title="강조"><strong aria-hidden="true">B</strong></button>
            <button type="button" class="tpl-insert" data-insert="1" data-insert-target="extra-${esc(item.id)}"
                    aria-label="하이라이트 바" title="하이라이트 바">하이라이트 바</button>
            <button type="button" class="tpl-insert" data-insert="2" data-insert-target="extra-${esc(item.id)}"
                    aria-label="번호 목록" title="번호 목록">번호 목록</button>
            ${[['left', 'alignLeft', '왼쪽 정렬'], ['center', 'alignCenter', '가운데 정렬'], ['right', 'alignRight', '오른쪽 정렬']].map(([value, iconName, label]) => `
              <button type="button" class="tpl-insert tpl-align-button${(item.textAlign || 'left') === value ? ' is-active' : ''}"
                      data-extra-align="${value}" data-extra-id="${esc(item.id)}"
                      aria-label="${label}" title="${label}" aria-pressed="${(item.textAlign || 'left') === value}">
                ${icon(iconName, 'icon--sm')}
              </button>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

function bindOverlay(root) {
  const overlay = root.querySelector('#tpl-overlay');
  if (!overlay) return;

  overlay.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.tpl-handle');
    if (!handle) return;
    const grip = e.target.closest('.tpl-handle__grip');
    startDrag(root, e, handle.dataset.obj, grip?.dataset.grip || null);
  });

  /**
   * 다른 곳을 누르면 선택을 푼다 (요청자 지적 2026-08-14 — "파란색 표시가 계속 떠서 불편함").
   * 예전에는 Esc 말고는 푸는 방법이 없어서, 한 번 고르면 파란 상자가 계속 남았다.
   *
   * ⚠️ 두 곳은 예외다. 여기서 풀면 기능이 죽는다.
   *    - `.tpl-handle` — 손잡이·그립을 누른 것이니 선택을 유지해야 드래그가 된다.
   *    - `#tpl-layout-slot` — 크기·굵기 입력칸이다. 누르는 순간 풀리면 값을 못 바꾼다.
   */
  outsideTap?.();
  const onDocDown = (e) => {
    /**
     * 편집 영역 = 미리보기(손잡이·캔버스)와 크기·굵기 패널.
     * ⚠️ 캔버스까지 포함해야 한다. 상자를 감춘 뒤 다시 켜는 유일한 방법이 미리보기를 누르는 것이다.
     * ⚠️ 크기 패널을 빼면 안 된다 — 값을 누르는 순간 선택이 풀려 입력 자체가 죽는다.
     */
    const inEditor = Boolean(
      e.target.closest?.('.tpl-handle')
      || e.target.closest?.('#tpl-canvas-wrap')
      || e.target.closest?.('#tpl-layout-slot'),
    );

    if (inEditor) {
      if (overlayIdle) { overlayIdle = false; syncOverlay(root); }
      return;
    }
    if (!selectedObj && overlayIdle) return;   // 이미 정리된 상태면 다시 그리지 않는다
    selectedObj = null;
    overlayIdle = true;
    syncOverlay(root);
  };
  document.addEventListener('pointerdown', onDocDown);
  outsideTap = () => document.removeEventListener('pointerdown', onDocDown);

  // 마우스 없이도 옮길 수 있어야 한다 — 화살표로 미세 이동, Shift 로 크게, Esc 로 선택 해제
  overlay.addEventListener('keydown', (e) => {
    const handle = e.target.closest('.tpl-handle');
    if (!handle) return;
    if (e.key === 'Escape') { selectedObj = null; syncOverlay(root); return; }
    const step = e.shiftKey ? 0.02 : 0.005;
    const deltas = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!(e.key in deltas)) return;
    e.preventDefault();
    const objId = handle.dataset.obj;
    selectObj(root, objId);
    const cur = lastBoxes()[objId];
    if (!cur) return;
    const s = getState();
    const norm = s.card.layout?.[active]?.[objId] || { x: cur.x / W, y: cur.y / H, w: cur.w / W, h: cur.h / H };
    const [dx, dy] = deltas[e.key];
    commitLayout(root, objId, { ...norm, x: norm.x + dx, y: norm.y + dy });
  });
}

/** 선택된 텍스트 오브젝트의 크기와 굵기 설정을 보여준다. */
function layoutPanelHTML() {
  if (!selectedObj) return '';
  const s = getState();
  const obj = editableObjects(s).find((o) => o.id === selectedObj);
  const cur = lastBoxes()[selectedObj];
  if (!obj || !cur || obj.type !== 'text') return '';
  const saved = s.card.layout?.[active]?.[selectedObj] || {};
  const defaultWeights = { brand: 900, eyebrow: 700, title: 900, footer: 500 };
  const defaultSizes = { brand: 36, eyebrow: 30, title: 82, footer: 30 };
  const isExtra = selectedObj.startsWith('extra-');
  const shownWeight = Number(saved.fontWeight) || defaultWeights[selectedObj] || (isExtra ? 400 : 500);
  const measuredSize = lastSizes()[selectedObj]?.size || null;
  const legacySize = saved.fontScale ? Math.round((defaultSizes[selectedObj] || 30) * saved.fontScale) : null;
  const shownSize = Math.round(Number(saved.fontSize) || measuredSize || legacySize || defaultSizes[selectedObj] || (isExtra ? 40 : 30));

  return `
    <div class="tpl-layout">
      <div class="tpl-form__head">
        <h3 class="tpl-form__legend" style="border:0;padding:0">${esc(obj.label)} 텍스트 설정</h3>
      </div>
      <div class="tpl-layout__grid">
        <label class="field"><span class="field__label">텍스트 크기 (px)</span>
          <input class="input" type="number" id="lo-font-size" value="${shownSize}" min="12" max="180" step="1" /></label>
        <label class="field"><span class="field__label">텍스트 굵기</span>
          <select class="input" id="lo-font-weight">
            ${[[400, '보통'], [500, '중간'], [700, '굵게'], [900, '아주 굵게']].map(([v, label]) => `<option value="${v}" ${shownWeight === v ? 'selected' : ''}>${label}</option>`).join('')}
          </select></label>
      </div>
    </div>`;
}

/** `#tpl-layout-slot` 만 다시 그린다 — 폼 전체를 다시 그리면 다른 입력칸의 캐럿이 튄다 */
function refreshLayoutPanel(root) {
  const slot = root.querySelector('#tpl-layout-slot');
  if (!slot) return;
  slot.innerHTML = layoutPanelHTML();
  bindLayoutPanel(root);
}

function bindLayoutPanel(root) {
  root.querySelector('#lo-font-size')?.addEventListener('change', () => applyLayoutInputs(root, 'fontSize'));
  root.querySelector('#lo-font-weight')?.addEventListener('change', () => applyLayoutInputs(root, 'fontWeight'));
}

function applyLayoutInputs(root, changed) {
  if (!selectedObj) return;
  const cur = lastBoxes()[selectedObj];
  if (!cur) return;
  const prev = getState().card.layout?.[active]?.[selectedObj] || {};
  const next = { ...prev };
  if (changed === 'fontSize') {
    const defaults = { brand: 36, eyebrow: 30, title: 82, footer: 30 };
    const oldSize = Number(prev.fontSize) || lastSizes()[selectedObj]?.size || defaults[selectedObj] || 30;
    next.fontSize = Math.min(180, Math.max(12, Number(root.querySelector('#lo-font-size')?.value) || oldSize));
    // 키울 때만 기존 상자가 글자를 자르지 않도록 함께 확장한다.
    // 줄일 때는 배치 영역까지 작아지지 않도록 사용자가 잡아 둔 상자 크기를 그대로 둔다.
    const ratio = next.fontSize / oldSize;
    if (ratio > 1) {
      next.w = (cur.w * ratio) / W;
      next.h = (cur.h * ratio) / H;
    }
    delete next.fontScale;
  }
  if (changed === 'fontWeight') {
    next.fontWeight = Number(root.querySelector('#lo-font-weight')?.value) || prev.fontWeight;
  }
  commitLayout(root, selectedObj, next);
}

/* ---------------- 되돌리기 · 저장 ---------------- */

function resetAll(root) {
  const s = getState();
  if (hasEdits(s.card) && !confirm('편집한 문구를 모두 추천 문구로 되돌릴까요?')) return;
  const base = baseOf(s.concept, getProduct(s.productId));
  // ⚠️ 배치(layout)는 문구와 다른 축이다 — 문구를 되돌렸다고 공들여 옮긴 배치까지 지우지 않는다.
  setState({ card: { key: draftKeyOf(s), concept: s.concept, texts: cloneTexts(base), base, layout: fitLayout(s.card.layout), extraTexts: fitExtraTexts(s.card.extraTexts) } });
  refreshForm(root);
  refreshNotices(root);
  paint(root);
  markDirty(root);
  toast('모든 카드를 추천 문구로 되돌렸습니다.');
}

const fileName = (s, i) => `${s.productId}-${s.concept}-${String(i + 1).padStart(2, '0')}.png`;

async function saveOne(root) {
  const canvas = root.querySelector('#tpl-canvas');
  if (!canvas) return;
  await downloadCanvas(canvas, fileName(getState(), active));
  toast(`${active + 1}번 카드를 저장했습니다.`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function saveAll(root) {
  const btn = root.querySelector('#save-all');
  if (btn) btn.disabled = true;
  const s = getState();
  const off = document.createElement('canvas');

  try {
    for (let i = 0; i < deck.length; i++) {
      renderCard(off, s.card.texts[i], opts(s, i));
      await downloadCanvas(off, fileName(s, i));
      // 브라우저가 연속 다운로드를 차단하지 않도록 간격을 둔다
      if (i < deck.length - 1) await sleep(350);
    }
    toast(`${deck.length}장을 모두 저장했습니다.`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---------------- 보관함 ---------------- */

/** 목록에 쓸 작은 미리보기. 4:5 비율을 유지한다 — 1080x1350 을 그대로 두면 용량이 감당이 안 된다. */
const THUMB_W = 216;
const THUMB_H = 270;

/**
 * 첫 카드를 줄여서 썸네일 Blob 으로 만든다.
 * 실패해도 보관 자체는 막지 않는다 — 목록에 글자만 나올 뿐이다.
 */
async function makeThumb(s) {
  try {
    const full = document.createElement('canvas');
    renderCard(full, s.card.texts[0], opts(s, 0));
    const small = document.createElement('canvas');
    small.width = THUMB_W;
    small.height = THUMB_H;
    small.getContext('2d').drawImage(full, 0, 0, THUMB_W, THUMB_H);
    return await new Promise((resolve) => small.toBlob(resolve, 'image/jpeg', 0.72));
  } catch {
    return null;
  }
}

/** 현재 편집본을 저장한다. 자동 저장은 변경이 있을 때만 1분마다 실행된다. */
async function saveToArchive(root, { automatic = false } = {}) {
  if (archiveSaving || !hasLibraryChanges()) { refreshArchiveButton(root); return; }
  const btn = root.querySelector('#save-library');
  const s = getState();
  archiveSaving = true;
  if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  try {
    const thumb = await makeThumb(s);
    const result = await saveToLibrary(getState(), thumb);
    if (!result.ok) { toast(result.error, 6000); return; }
    toast(automatic ? '자동 저장했습니다.' : '저장했습니다.');
  } finally {
    archiveSaving = false;
    if (btn) btn.removeAttribute('aria-busy');
    refreshArchiveButton(root);
  }
}

/* ---------------- 직관형(D) — 이미지 프롬프트 ---------------- */

/**
 * 프롬프트를 들고 갈 곳. `components/imagepanel.js` 의 TOOLS 와 같은 목적이다.
 * ⚠️ **한글을 그릴 수 있는 도구여야 한다.** 직관형은 글자가 그림의 절반이다.
 */
const AD_TOOLS = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
];

/**
 * 직관형 화면.
 *
 * 캔버스 편집기가 없다. 대신 **컨셉과 장수를 고르고 프롬프트 묶음을 받는다.**
 * 템플릿 선택 줄은 그대로 둔다 — 여기서 A·B·C 로 되돌아갈 수 있어야 한다.
 */
/**
 * 직관형 컨셉 — **1단계 톤앤매너가 정한다** (2026-08-21, 요청자 지시).
 *
 * 톤을 고를 때 이미 「신뢰형이냐 후킹형이냐」를 정했는데 여기서 또 고르게 하면 같은 결정을
 * 두 번 하는 것이고, 두 값이 어긋나면 톤과 그림이 따로 논다.
 * (장수를 1단계로 넘긴 8-31 ② 와 같은 판단이다.)
 *
 * ⚠️ **직접 고른 것은 그 톤인 동안만 유지한다.** `adConceptTone` 이 지금 톤과 같을 때만
 *    `adConcept` 를 믿는다. 톤을 바꾸면 새 톤에 맞는 컨셉으로 되돌아간다.
 * ⚠️ **여기서 `setState()` 를 부르지 말 것.** 그리는 중에 상태를 바꾸면 다시 그리기가 겹친다.
 *    고른 값은 화면에서 누를 때만 저장한다.
 */
function effectiveAdConcept(s) {
  return s.adConceptTone === s.tone ? s.adConcept : adConceptForTone(s.tone);
}

function renderAdPage(root, product, s) {
  // 장수는 1단계 「카드뉴스 장수」가 정한다 — 덱 길이가 곧 장수다
  const concept = getAdConcept(effectiveAdConcept(s));
  adPrompts = buildAdPrompts({ product, topic: s.topic.trim(), deck, conceptId: concept.id });
  const count = adPrompts.length;
  currentRoot = root;

  root.innerHTML = `
    <div class="container">
      ${stepperHTML('/template')}

      <section class="section">
        <div class="section__head">
          <h1>직관형 — 이미지 프롬프트를 만듭니다</h1>
          <p class="section__desc">
            직관형은 카드를 그리지 않습니다. <strong>글자까지 이미지 안에 들어가는 광고 배너</strong>라
            나중에 문구를 얹을 자리가 없기 때문입니다. 대신 원하는 장수만큼 프롬프트를 만들어 드리니,
            복사해서 이미지 생성 도구에서 뽑으면 됩니다.
          </p>
        </div>

        <div class="ctxbar card">
          <dl class="ctxbar__list">
            <div><dt>상품</dt><dd>${esc(product.name)}</dd></div>
            <div><dt>주제</dt><dd>${esc(s.topic)}</dd></div>
            <div><dt>톤</dt><dd>${esc(TONE_LABEL[s.tone] || s.tone)}</dd></div>
          </dl>
          <div class="ctxbar__actions">
            <a class="btn btn--ghost btn--sm" href="#/copy" aria-label="글귀 단계로 돌아가기">
              ${icon('arrowLeft', 'icon--sm')} 글귀 수정
            </a>
          </div>
        </div>

        <h2 class="sub-head">템플릿 선택</h2>
        <fieldset class="concept-grid" id="tpl-concepts">
          <legend class="sr-only">카드뉴스 템플릿을 선택하세요</legend>
          ${CONCEPTS.map((c) => conceptCardHTML(c, c.id === s.concept)).join('')}
        </fieldset>

        <div class="card adbar">
          <!--
            ⚠️ **컨셉은 주제 하나에 하나다** (2026-08-20, 요청자 지시:
               "하나의 컨셉으로 만들면 그 주제에서 생성되는 카드뉴스의 컨셉은 통일 시켜줘").
               장마다 돌리지 말 것 — 처음에 그렇게 만들었다가 6장이 6개의 다른 광고가 됐다.
          -->
          <fieldset class="field">
            <legend class="field__label">컨셉</legend>
            <div class="pickrow" role="radiogroup" aria-label="이미지 컨셉 선택">
              ${AD_CONCEPTS.map((c) => `
                <input class="sr-only pick__input" type="radio" name="adconcept" id="ac-${c.id}" value="${c.id}"
                       autocomplete="off" aria-label="${esc(c.name)} — ${esc(c.who)}. ${esc(c.when)}"
                       ${concept.id === c.id ? 'checked' : ''} />
                <label class="pick" for="ac-${c.id}">
                  <span class="pick__dots" aria-hidden="true">
                    ${c.swatch.map((hex) => `<i style="background:${hex}"></i>`).join('')}
                  </span>${esc(c.name)}</label>`).join('')}
            </div>
            <!--
              ⚠️ 고른 것 **하나만** 풀어 쓴다 (2026-08-20). 다섯 개를 다 펼치면 화면이 다시 난잡해진다 —
                 강조 색상·우상단 마크와 같은 방식이다.
            -->
            <p class="field__hint">
              ${esc(concept.who)} · ${esc(concept.when)}<br />
              <strong>${count}장</strong>을 같은 사람·색·그림체로 만듭니다.
              ${s.adConceptTone === s.tone
    ? '직접 고른 컨셉입니다.'
    : `톤 「${esc(TONE_LABEL[s.tone] || s.tone)}」에 맞춰 골라 뒀습니다.`}
              장수와 톤은 1단계에서 정합니다. <a href="#/">바꾸기</a>
            </p>
          </fieldset>

          <div class="adbar__actions">
            <button type="button" class="btn btn--ghost btn--sm" id="ad-copy-all"
                    aria-label="프롬프트 ${count}장 모두 복사하기">
              ${icon('copy', 'icon--sm')} ${count}장 모두 복사
            </button>
            ${AD_TOOLS.map((t) => `
              <a class="btn btn--text btn--sm" href="${t.url}" target="_blank" rel="noopener noreferrer"
                 aria-label="${esc(t.name)} 를 새 탭에서 열기">
                ${icon('external', 'icon--sm')} ${esc(t.name)}
              </a>`).join('')}
          </div>

          <!--
            ⚠️ 안내를 다시 박스(notice)로 만들지 말 것 (8-10 ② · 2026-08-20 요청자 지적 "UI 가 난잡하다").
               세 줄짜리 경고 박스가 따로 서 있었는데, 이 화면은 이미 카드가 여럿이라 박스를 더하면 그것만 눈에 띈다.
          -->
          <p class="adbar__note">
            글자까지 그림 안에 들어갑니다 — <strong>한글을 그리는 모델</strong>에서 쓰세요.
            뽑은 이미지는 이 화면에 담기지 않습니다.
          </p>
        </div>

        <div class="adlist">${adPrompts.map(adCardHTML).join('')}</div>

        <div class="flow-actions">
          <button type="button" class="btn btn--ghost" id="go-copy"
                  aria-label="아이디어 문서화 단계로 돌아가기">
            ${icon('arrowLeft', 'icon--sm')} 글귀 단계로
          </button>
          <button type="button" class="btn" id="save-library" aria-label="지금 게시물 저장하기">
            ${icon('archive', 'icon--sm')} 저장
          </button>
        </div>
      </section>
    </div>`;

  bindStepper(root);
  bindConcepts(root);
  bindAdPage(root);
  bindArchiveAutosave(root);
}

/** 프롬프트 한 장 — 무엇이 찍히는지 먼저 보이고, 전문은 접어 둔다 */
function adCardHTML(item) {
  const c = item.copy;
  const row = (label, value) => (value
    ? `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
    : '');
  const headline = [c.line1, c.line2].filter(Boolean).join(' ');
  return `
    <article class="card adcard">
      <div class="adcard__head">
        <span class="badge">${item.n}번 · ${esc(roleLabel(item.role))}</span>
        <button type="button" class="btn btn--ghost btn--sm" data-ad-copy="${item.n}"
                aria-label="${item.n}번 프롬프트 복사하기">
          ${icon('copy', 'icon--sm')} 복사
        </button>
      </div>
      <p class="adcard__line">${esc(headline)}</p>
      <details class="adcard__raw">
        <summary>자세히</summary>
        <dl class="adcard__copy">
          ${row('말풍선', c.hook)}
          ${row('보조 문구', c.sub)}
          ${row('숫자 강조', c.number)}
          ${row('체크 리스트', c.bullets.join(' · '))}
          ${row('하단 CTA', c.cta)}
        </dl>
        <pre class="adcard__pre">${esc(item.prompt)}</pre>
      </details>
    </article>`;
}

function bindAdPage(root) {
  // 컨셉을 바꾸면 전 장을 다시 만든다 — 한 벌이 통째로 갈리는 값이라 부분 갱신이 없다
  root.querySelectorAll('input[name="adconcept"]').forEach((el) => {
    el.addEventListener('change', () => {
      // 톤과 함께 남긴다 — 톤이 바뀌면 이 선택은 버리고 새 톤의 컨셉으로 돌아간다
      setState({ adConcept: el.value, adConceptTone: getState().tone });
      render(root);
      toast(`${getAdConcept(el.value).name} 컨셉으로 전 장을 다시 만들었습니다.`);
    });
  });

  root.querySelectorAll('[data-ad-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = adPrompts.find((x) => x.n === Number(btn.dataset.adCopy));
      if (item) copyText(item.prompt, `${item.n}번 프롬프트를 복사했습니다.`);
    });
  });

  root.querySelector('#ad-copy-all')?.addEventListener('click', () => {
    // 붙여 놓으면 어느 장인지 못 가리므로 번호와 역할을 함께 붙인다
    const all = adPrompts
      .map((x) => `[${x.n}번 · ${roleLabel(x.role)}]\n${x.prompt}`)
      .join('\n\n────────\n\n');
    copyText(all, `${adPrompts.length}장을 모두 복사했습니다.`);
  });

  root.querySelector('#go-copy')?.addEventListener('click', () => navigate('/copy'));
  root.querySelector('#save-library')?.addEventListener('click', () => saveToArchive(root));
}

/* ---------------- 유틸 ---------------- */

/** 클립보드 복사 — 권한이 막힌 환경을 위해 execCommand 폴백을 둔다 */
async function copyText(text, okMessage) {
  if (!String(text).trim()) { toast('복사할 내용이 없습니다.'); return; }
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    const tmp = document.createElement('textarea');
    tmp.value = text;
    tmp.setAttribute('readonly', '');
    tmp.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(tmp);
    tmp.select();
    const ok = document.execCommand('copy');
    tmp.remove();
    toast(ok ? okMessage : '복사에 실패했습니다. 직접 선택해 복사해 주세요.');
  }
}

const esc = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
