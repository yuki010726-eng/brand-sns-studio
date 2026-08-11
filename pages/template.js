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
import { getProduct, BANNED_PHRASES } from '../data/products.js';
import { CONCEPTS, ACCENTS, MARKS, CARD_THEMES, NOTE_SYMBOLS, NOTE_PAPERS, DEFAULT_NOTE_GRAIN, getConcept } from '../lib/concepts.js';
import { slotsFor, defaultsFor, roleOf } from '../lib/templates.js';
import { stepperHTML, bindStepper } from '../components/stepper.js';
import { getState, setState, navigate, draftKeyOf } from '../store.js';
import { buildDeck, TONE_LABEL, findBanned } from '../lib/copywriter.js';
import { getImage, putImage, deleteImage, imageKey } from '../lib/imagestore.js';
import { renderCard, loadImage, cardAlt, downloadCanvas, ensureFonts, W, H } from '../lib/cardrender.js';
import { buildPrompt, buildPromptSheet } from '../lib/imageprompt.js';
import { imagePanelHTML, bindImagePanel } from '../components/imagepanel.js';
import { toast } from '../components/toast.js';

export const title = '카드뉴스 템플릿';

export function guard() {
  const s = getState();
  return s.productId && s.topic.trim() ? null : '/';
}

const KIND_LABEL = { cover: '표지', body: '본문', note: '반론', outro: '마무리' };

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

/* ---------------- 문구 상태 ---------------- */

/**
 * 문구 상태는 두 가지 이유로 낡는다. 둘을 구분해서 다뤄야 한다.
 *
 * 1. 상품·주제·톤이 바뀜 → 내용만 낡는다. 편집본을 지키고 안내만 띄운다. (card.key)
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
 * 편집본이 없을 때만 조용히 새 추천 문구로 맞춘다.
 * 편집한 내용이 있으면 그대로 두고 안내만 띄운다 — 2단계 글귀와 같은 규칙이다.
 */
function ensureTexts(product) {
  const s = getState();
  const key = draftKeyOf(s);
  const base = baseOf(s.concept, product);
  const card = s.card;

  if (!card || !Array.isArray(card.texts) || card.texts.length !== deck.length) {
    setState({ card: { key, concept: s.concept, texts: cloneTexts(base), base } });
    return;
  }

  // 템플릿 교체 — 슬롯이 달라졌으므로 반드시 새 구성으로 다시 세운다
  if (card.concept !== s.concept) {
    setState({ card: { key: card.key, concept: s.concept, texts: mergeTexts(card, base), base } });
    return;
  }

  if (card.key === key) {
    setState({ card: { ...card, base } });   // 되돌리기 기준을 최신으로
    return;
  }
  if (!hasEdits(card)) setState({ card: { key, concept: s.concept, texts: cloneTexts(base), base } });
}

/* ---------------- 렌더 ---------------- */

export function render(root) {
  const s = getState();
  const p = getProduct(s.productId);
  const concept = getConcept(s.concept);

  deck = buildDeck({ product: p, topic: s.topic.trim(), tone: s.tone, variant: s.image?.variant ?? 0, cardCount: s.cardCount });
  ensureTexts(p);
  if (active >= deck.length) active = 0;

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

        <div id="tpl-notices">${noticesHTML()}</div>

        <!-- 카드 선택 -->
        <div class="tpl-tabs" role="tablist" aria-label="편집할 카드 선택">
          ${deck.map((c, i) => tabHTML(c, i)).join('')}
        </div>

        <div class="tpl-editor">
          <div class="tpl-stage">
            <canvas class="tpl-stage__canvas" id="tpl-canvas" width="${W}" height="${H}"
                    role="img" aria-label="카드 미리보기"></canvas>
            <p class="tpl-stage__note" id="tpl-src">이미지 확인 중…</p>
            <div class="tpl-stage__actions">
              <button type="button" class="btn btn--ghost btn--sm" id="save-one"
                      aria-label="이 카드 PNG로 저장하기">
                ${icon('download', 'icon--sm')} 이 카드 저장
              </button>
              <button type="button" class="btn btn--sm" id="save-all"
                      aria-label="카드 ${deck.length}장 모두 PNG로 저장하기">
                ${icon('download', 'icon--sm')} ${deck.length}장 모두 저장
              </button>
            </div>

            <!-- 문구 입력칸 반대쪽. 이미지는 필수가 아니라 원할 때만 쓰는 자리다. -->
            <div id="tpl-image">${imagePanelSlot()}</div>
          </div>

          <div class="tpl-form card" id="tpl-form">${formHTML()}</div>
        </div>

        <div class="flow-actions">
          <button type="button" class="btn btn--ghost" id="go-copy"
                  aria-label="아이디어 문서화 단계로 돌아가기">
            ${icon('arrowLeft', 'icon--sm')} 글귀 단계로
          </button>
        </div>
      </section>
    </div>`;

  bindStepper(root);
  bindConcepts(root);
  bindTabs(root);
  bindForm(root);
  bindNotices(root);
  bindImagePanelHere(root);

  root.querySelector('#reset-all')?.addEventListener('click', () => resetAll(root));
  root.querySelector('#save-one')?.addEventListener('click', () => saveOne(root));
  root.querySelector('#save-all')?.addEventListener('click', () => saveAll(root));
  root.querySelector('#go-copy')?.addEventListener('click', () => navigate('/copy'));

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
        <span class="concept__ref">참고 · ${c.ref}</span>
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
    </div>

    <h3 class="tpl-form__legend">문구</h3>
    ${slots.map((f) => fieldHTML(f, t[f.id] ?? '', concept.id)).join('')}

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

function fieldHTML(f, value, conceptId) {
  const control = f.tag === 'textarea'
    ? `<textarea class="textarea tpl-ta" id="f-${f.id}" data-f="${f.id}" rows="${f.rows || 3}"
                 spellcheck="false" autocomplete="off"
                 aria-describedby="h-${f.id}">${esc(value)}</textarea>`
    : `<input class="input" type="text" id="f-${f.id}" data-f="${f.id}"
              value="${esc(value)}" spellcheck="false" autocomplete="off"
              aria-describedby="h-${f.id}" />`;

  const tools = conceptId === 'note' && f.id === 'body'
    ? `<div class="tpl-inserts">
         ${INSERTS.map((x, i) => `
           <button type="button" class="tpl-insert" data-insert="${i}"
                   aria-label="본문에 ${x.hint || x.label} 넣기"
                   title="${esc(x.hint || x.label)}">${x.label}</button>`).join('')}
       </div>`
    : '';

  return `
    <div class="field tpl-field">
      <label class="field__label" for="f-${f.id}">${f.label}</label>
      ${control}
      ${tools}
      <p class="field__hint" id="h-${f.id}">${f.hint}</p>
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
  return `
    <h3 class="tpl-form__legend">테마 색상</h3>
    <fieldset class="accent__swatches" id="theme-swatches">
      <legend class="sr-only">카드 테마 색상을 선택하세요</legend>
      ${CARD_THEMES.map((c) => `
        <div class="accent__item">
          <input class="sr-only accent__input" type="radio" name="cardtheme" id="ct-${c.id}"
                 value="${c.id}" autocomplete="off" ${c.id === (current || 'blue') ? 'checked' : ''}
                 aria-label="테마 ${c.name}" />
          <label class="accent__chip" for="ct-${c.id}">
            <span class="accent__dot" style="background:${c.hex}"></span>${c.name}
          </label>
        </div>`).join('')}
    </fieldset>
    <p class="field__hint">모든 장에 함께 적용됩니다. 흰 글씨 대비를 지키는 색만 넣어 뒀습니다.</p>`;
}

/** 카드형 우상단 마크 — 레퍼런스의 별표 말고도 고를 수 있게 */
function markHTML(current) {
  return `
    <h3 class="tpl-form__legend">우상단 마크</h3>
    <fieldset class="accent__swatches" id="mark-swatches">
      <legend class="sr-only">우상단 마크를 선택하세요</legend>
      ${MARKS.map((m) => `
        <div class="accent__item">
          <input class="sr-only accent__input" type="radio" name="mark" id="mk-${m.id}"
                 value="${m.id}" autocomplete="off" ${m.id === current ? 'checked' : ''}
                 aria-label="마크 ${m.name}" />
          <label class="accent__chip" for="mk-${m.id}">${m.name}</label>
        </div>`).join('')}
    </fieldset>
    <p class="field__hint">모든 장의 오른쪽 위에 함께 적용됩니다.</p>`;
}

/** 매거진형 강조 색상 — 형광 초록 말고도 고를 수 있게 한다 */
function accentHTML(current) {
  return `
    <h3 class="tpl-form__legend">강조 색상</h3>
    <div class="accent">
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
      </fieldset>
      <div class="accent__custom">
        <label class="field__hint" for="accent-hex">직접 입력</label>
        <input class="input accent__hex" type="text" id="accent-hex" value="${esc(current)}"
               spellcheck="false" autocomplete="off" placeholder="#B9F73E"
               aria-label="강조 색상 직접 입력 (예: #B9F73E)" />
      </div>
    </div>
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

function noticesHTML() {
  const s = getState();
  const out = [];

  if (s.card.key !== draftKeyOf(s)) {
    out.push(`
      <div class="notice notice--info" role="status">
        <span class="notice__icon" aria-hidden="true">${icon('alert', 'icon--sm')}</span>
        <div>
          <strong>조건이 바뀌었습니다</strong>
          <p>지금 문구는 이전 상품·주제·톤으로 만든 것입니다. 편집한 내용을 지키려면 그대로 두세요.</p>
        </div>
        <button type="button" class="btn btn--sm" id="stale-reset"
                aria-label="바뀐 조건의 추천 문구로 모두 되돌리기">새 추천 문구로</button>
      </div>`);
  }

  if (!Object.keys(s.images).length) {
    out.push(`
      <div class="notice" role="note">
        <span class="notice__icon" aria-hidden="true">${icon('image', 'icon--sm')}</span>
        <div>
          <strong>이미지 없이 만들고 있습니다</strong>
          <p>템플릿 기본 배경으로 그려집니다. 오른쪽에서 직접 올리거나, 3단계에서 만들면 여기에 자동으로 반영됩니다.</p>
        </div>
      </div>`);
  }
  return out.join('');
}

/* ---------------- 바인딩 ---------------- */

function bindConcepts(root) {
  root.querySelector('#tpl-concepts')?.addEventListener('change', (e) => {
    if (e.target.name !== 'tpl-concept') return;
    setState({ concept: e.target.value });
    active = 0;
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
  const slot = root.querySelector('#tpl-form');
  if (!slot) return;
  slot.innerHTML = formHTML();
  bindForm(root);
}

function bindForm(root) {
  root.querySelectorAll('[data-f]').forEach((el) => {
    el.addEventListener('input', () => {
      const s = getState();
      const texts = cloneTexts(s.card.texts);
      texts[active] = { ...texts[active], [el.dataset.f]: el.value };
      setState({ card: { ...s.card, texts } });

      // 입력 중에는 캔버스만 갱신한다 — 폼을 다시 그리면 캐럿이 튄다
      schedulePaint(root);
      const warn = root.querySelector('#tpl-warn');
      if (warn) warn.innerHTML = warnHTML(texts[active]);
      const reset = root.querySelector('#reset-one');
      if (reset) reset.disabled = !isEdited(getState().card, active);
    });
  });

  root.querySelector('.accent__swatches')?.addEventListener('change', (e) => {
    if (e.target.name !== 'accent') return;
    setState({ accent: e.target.value });
    const hex = root.querySelector('#accent-hex');
    if (hex) hex.value = e.target.value;
    paint(root);
  });

  root.querySelector('#accent-hex')?.addEventListener('input', (e) => {
    const v = e.target.value.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;   // 입력 중에는 조용히 무시
    setState({ accent: v });
    root.querySelectorAll('[name="accent"]').forEach((r) => { r.checked = r.value.toLowerCase() === v.toLowerCase(); });
    schedulePaint(root);
  });

  root.querySelector('#mark-swatches')?.addEventListener('change', (e) => {
    if (e.target.name !== 'mark') return;
    setState({ mark: e.target.value });
    paint(root);
  });

  // 테마 색은 모든 장에 걸린다. 상태 한 곳만 바꾸면 나머지 장은 다시 그릴 때 따라온다.
  root.querySelector('#theme-swatches')?.addEventListener('change', (e) => {
    if (e.target.name !== 'cardtheme') return;
    setState({ cardTheme: e.target.value });
    paint(root);
  });

  root.querySelector('#symbol-swatches')?.addEventListener('change', (e) => {
    if (e.target.name !== 'notesymbol') return;
    setState({ noteSymbol: e.target.value });
    paint(root);
  });

  root.querySelector('#paper-swatches')?.addEventListener('change', (e) => {
    if (e.target.name !== 'paper') return;
    setState({ notePaper: e.target.value });
    paint(root);
  });

  // 슬라이더는 끄는 동안 계속 그리면 무거워서 캔버스만 모아 그린다
  root.querySelector('#grain-range')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    setState({ noteGrain: v });
    const out = root.querySelector('#grain-value');
    if (out) out.textContent = String(v);
    schedulePaint(root);
  });

  root.querySelectorAll('[data-insert]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ta = root.querySelector('#f-body');
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
    toast(`${active + 1}번 카드를 추천 문구로 되돌렸습니다.`);
  });

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
    onCopyAll: () => copyText(buildPromptSheet(deck, getState().concept, allTitles()), '프롬프트를 모두 복사했습니다.'),
  });
}

/** 이미지가 바뀌면 미리보기·안내문·패널을 함께 맞춘다 */
async function applyImage(root, i, blob, source) {
  const s = getState();
  if (blob) {
    await putImage(imageKey(s.productId, s.concept, i), blob);
    setState({ images: { ...getState().images, [i]: { source, at: Date.now() } } });
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
  slot.innerHTML = noticesHTML();
  bindNotices(root);
}

function bindNotices(root) {
  root.querySelector('#stale-reset')?.addEventListener('click', () => resetAll(root));
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
const promptFor = (i) => {
  const s = getState();
  return buildPrompt(deck[i], s.concept, { title: s.card?.texts?.[i]?.title || deck[i].title });
};

const allTitles = () => {
  const s = getState();
  return deck.map((c, i) => s.card?.texts?.[i]?.title || c.title);
};

function opts(s, i) {
  return {
    conceptId: s.concept, kind: deck[i].kind, image: bitmaps[i] || null,
    accent: s.accent, cardTheme: s.cardTheme, mark: s.mark,
    noteSymbol: s.noteSymbol, notePaper: s.notePaper, noteGrain: s.noteGrain,
  };
}

function paint(root) {
  const canvas = root.querySelector('#tpl-canvas');
  if (!canvas) return;
  const s = getState();
  const texts = s.card.texts[active];
  renderCard(canvas, texts, opts(s, active));
  canvas.setAttribute('aria-label', cardAlt(texts, active));
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

/* ---------------- 되돌리기 · 저장 ---------------- */

function resetAll(root) {
  const s = getState();
  if (hasEdits(s.card) && !confirm('편집한 문구를 모두 추천 문구로 되돌릴까요?')) return;
  const base = baseOf(s.concept, getProduct(s.productId));
  setState({ card: { key: draftKeyOf(s), concept: s.concept, texts: cloneTexts(base), base } });
  refreshForm(root);
  refreshNotices(root);
  paint(root);
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
