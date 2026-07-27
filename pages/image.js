/**
 * 3단계 — 카드 이미지 준비
 *
 * 컨셉을 고르면 카드 6장에 맞는 영문 이미지 프롬프트가 자동으로 만들어진다.
 * OpenAI 키가 있으면 바로 생성하고, 없으면 프롬프트를 복사해 외부 도구에서 뽑아 업로드한다.
 * 어느 쪽이든 결과는 IndexedDB 에 저장돼 4단계 템플릿에서 그대로 쓰인다.
 */
import { icon } from '../assets/icons.js';
import { getProduct } from '../data/products.js';
import { CONCEPTS, getConcept } from '../lib/concepts.js';
import { stepperHTML, bindStepper } from '../components/stepper.js';
import { getState, setState, navigate } from '../store.js';
import { buildDeck, DECK_SIZE, TONE_LABEL } from '../lib/copywriter.js';
import { buildPrompt, buildPromptSheet } from '../lib/imageprompt.js';
import { generateImage, hasKey, maskedKey, setKey, getModel, setModel, MODELS } from '../lib/openai.js';
import { putImage, getImage, deleteImage, imageKey, objectUrl, revokeAll } from '../lib/imagestore.js';
import { toast } from '../components/toast.js';

export const title = '카드 이미지';

export function guard() {
  const s = getState();
  return s.productId && s.topic.trim() ? null : '/';
}

let deck = [];
let busy = false;   // 생성 중 중복 실행 방지

export function render(root) {
  revokeAll();

  const s = getState();
  const p = getProduct(s.productId);
  const concept = getConcept(s.concept);
  deck = buildDeck({ product: p, topic: s.topic.trim(), tone: s.tone, variant: s.image?.variant ?? 0 });

  root.innerHTML = `
    <div class="container">
      ${stepperHTML('/image')}

      <section class="section">
        <div class="section__head">
          <h1>카드 이미지를 준비합니다</h1>
          <p class="section__desc">
            컨셉을 고르면 카드 ${DECK_SIZE}장에 맞는 이미지 프롬프트가 만들어집니다.
            바로 생성하거나, 프롬프트를 복사해 다른 도구에서 뽑아 올려도 됩니다.
            문구는 다음 단계에서 얹습니다.
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
          </div>
        </div>

        <!-- 컨셉 선택 -->
        <h2 class="sub-head" id="concept-head">컨셉 선택</h2>
        <fieldset class="concept-grid" id="concept-grid">
          <legend class="sr-only">카드뉴스 컨셉을 선택하세요</legend>
          ${CONCEPTS.map((c) => conceptCardHTML(c, c.id === s.concept)).join('')}
        </fieldset>

        <!-- 이미지 생성 설정 -->
        <div class="keybar card" id="keybar">${keybarHTML()}</div>

        <!-- 카드 6장 -->
        <div class="shot-head">
          <h2 class="sub-head">카드 ${DECK_SIZE}장</h2>
          <div class="shot-head__actions">
            <button type="button" class="btn btn--ghost btn--sm" id="copy-sheet"
                    aria-label="프롬프트 전체를 한 번에 복사하기">
              ${icon('copy', 'icon--sm')} 프롬프트 전체 복사
            </button>
            <button type="button" class="btn btn--sm" id="gen-all"
                    aria-label="카드 이미지 전체 생성하기" ${hasKey() ? '' : 'disabled'}>
              ${icon('sparkles', 'icon--sm')} 전체 생성
            </button>
          </div>
        </div>

        <ul class="shots" id="shots">
          ${deck.map((c, i) => shotHTML(c, i, concept)).join('')}
        </ul>

        <div class="flow-actions">
          <button type="button" class="btn btn--lg" id="go-template"
                  aria-label="템플릿 단계로 이동해 문구 얹기">
            템플릿에서 문구 얹기 ${icon('arrowRight', 'icon--sm')}
          </button>
        </div>
      </section>
    </div>`;

  bindStepper(root);
  bindConcept(root);
  bindKeybar(root);
  bindShots(root);
  loadThumbs(root);

  root.querySelector('#copy-sheet')?.addEventListener('click', () => {
    copyText(buildPromptSheet(deck, getState().concept), '프롬프트 6개를 모두 복사했습니다.');
  });

  root.querySelector('#gen-all')?.addEventListener('click', () => generateAll(root));
  root.querySelector('#go-template')?.addEventListener('click', () => navigate('/template'));
}

/* ---------------- 컨셉 ---------------- */

function conceptCardHTML(c, checked) {
  return `
    <div class="concept">
      <!-- autocomplete=off: 새로고침 시 브라우저가 예전 선택을 되살리며 change 를 쏴서
           저장된 컨셉을 덮어쓰는 것을 막는다 -->
      <input class="sr-only concept__input" type="radio" name="concept" id="concept-${c.id}"
             value="${c.id}" autocomplete="off" ${checked ? 'checked' : ''}
             aria-label="컨셉 ${c.badge} ${c.name} — ${c.desc}" />
      <label class="concept__body card card--hover" for="concept-${c.id}">
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

function bindConcept(root) {
  root.querySelector('#concept-grid')?.addEventListener('change', (e) => {
    if (e.target.name !== 'concept') return;
    setState({ concept: e.target.value });
    render(root);   // 프롬프트와 저장 키가 바뀌므로 전체를 다시 그린다
    toast(`컨셉을 ${getConcept(e.target.value).name}으로 바꿨습니다.`);
  });
}

/* ---------------- API 키 ---------------- */

function keybarHTML() {
  const on = hasKey();
  return `
    <div class="keybar__row">
      <span class="keybar__state ${on ? 'is-on' : ''}">
        ${icon(on ? 'check' : 'alert', 'icon--sm')}
        ${on ? `연결됨 · ${esc(maskedKey())}` : 'API 키 없음 — 프롬프트 복사 후 직접 업로드'}
      </span>
      <button type="button" class="btn btn--ghost btn--sm" id="key-toggle"
              aria-expanded="false" aria-controls="key-form"
              aria-label="이미지 생성 설정 열기">
        ${icon('sparkles', 'icon--sm')} ${on ? '설정 변경' : '자동 생성 켜기'}
      </button>
    </div>

    <div class="keybar__form" id="key-form" hidden>
      <div class="notice notice--warn" role="note">
        <span class="notice__icon" aria-hidden="true">${icon('alert', 'icon--sm')}</span>
        <div>
          <strong>이 키는 브라우저에만 저장됩니다</strong>
          <ul>
            <li>코드나 저장소에는 남지 않고, 이 컴퓨터의 브라우저에만 보관됩니다.</li>
            <li>브라우저에서 직접 호출하는 방식이라 <b>외부에 배포하면 키가 노출됩니다.</b> 개인·내부용으로만 쓰세요.</li>
            <li>배포가 필요해지면 서버 프록시로 옮겨야 합니다.</li>
          </ul>
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="key-input">OpenAI API 키</label>
        <input class="input" type="password" id="key-input" placeholder="sk-..."
               autocomplete="off" spellcheck="false" aria-describedby="key-hint" />
        <p class="field__hint" id="key-hint">platform.openai.com 에서 발급한 키를 붙여넣으세요.</p>
      </div>

      <div class="field">
        <label class="field__label" for="model-select">모델</label>
        <select class="select" id="model-select">
          ${MODELS.map((m) => `<option value="${m.id}" ${m.id === getModel() ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
        <p class="field__hint">${esc(MODELS.find((m) => m.id === getModel())?.note || '')}</p>
      </div>

      <div class="keybar__actions">
        <button type="button" class="btn btn--sm" id="key-save" aria-label="API 키 저장하기">저장</button>
        ${hasKey() ? `<button type="button" class="btn btn--text btn--sm" id="key-clear" aria-label="저장된 API 키 삭제하기">키 삭제</button>` : ''}
      </div>
    </div>`;
}

function bindKeybar(root) {
  const form = root.querySelector('#key-form');
  const toggle = root.querySelector('#key-toggle');

  toggle?.addEventListener('click', () => {
    const open = form.hidden;
    form.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) root.querySelector('#key-input')?.focus();
  });

  root.querySelector('#key-save')?.addEventListener('click', () => {
    const input = root.querySelector('#key-input');
    const value = input.value.trim();
    if (!value) { toast('키를 입력해 주세요.'); input.focus(); return; }
    setKey(value);
    setModel(root.querySelector('#model-select').value);
    input.value = '';           // 화면에 남기지 않는다
    refreshKeybar(root);
    toast('키를 저장했습니다. 이제 생성 버튼을 쓸 수 있습니다.');
  });

  root.querySelector('#key-clear')?.addEventListener('click', () => {
    setKey('');
    refreshKeybar(root);
    toast('저장된 키를 삭제했습니다.');
  });

  root.querySelector('#model-select')?.addEventListener('change', (e) => setModel(e.target.value));
}

function refreshKeybar(root) {
  const bar = root.querySelector('#keybar');
  bar.innerHTML = keybarHTML();
  bindKeybar(root);
  // 키 유무에 따라 생성 버튼 활성 상태를 맞춘다
  root.querySelectorAll('[data-gen], #gen-all').forEach((b) => { b.disabled = !hasKey(); });
}

/* ---------------- 카드 ---------------- */

function shotHTML(card, i, concept) {
  const prompt = buildPrompt(card, concept.id);
  return `
    <li class="shot" data-shot="${i}">
      <div class="shot__frame">
        <div class="shot__ph" data-ph="${i}">
          <span class="shot__no">${String(i + 1).padStart(2, '0')}</span>
          <span class="shot__kind">${kindLabel(card.kind)}</span>
        </div>
        <img class="shot__img" data-img="${i}" alt="" hidden />
        <div class="shot__busy" data-busy="${i}" hidden>
          <span class="spinner" aria-hidden="true"></span>
          <span>생성 중…</span>
        </div>
      </div>

      <div class="shot__meta">
        <p class="shot__title">${esc(card.title)}</p>
        <details class="shot__prompt">
          <summary>이미지 프롬프트 보기</summary>
          <p class="shot__prompt-text" data-prompt="${i}">${esc(prompt)}</p>
        </details>
      </div>

      <div class="shot__actions">
        <button type="button" class="btn btn--sm" data-gen="${i}"
                aria-label="${i + 1}번 카드 이미지 생성하기" ${hasKey() ? '' : 'disabled'}>
          ${icon('sparkles', 'icon--sm')} 생성
        </button>
        <button type="button" class="btn btn--ghost btn--sm" data-copy="${i}"
                aria-label="${i + 1}번 카드 프롬프트 복사하기">
          ${icon('copy', 'icon--sm')} 복사
        </button>
        <label class="btn btn--ghost btn--sm shot__upload">
          ${icon('image', 'icon--sm')} 업로드
          <input class="sr-only" type="file" accept="image/*" data-upload="${i}"
                 aria-label="${i + 1}번 카드 이미지 파일 선택" />
        </label>
        <button type="button" class="btn btn--icon btn--sm" data-del="${i}"
                aria-label="${i + 1}번 카드 이미지 삭제하기" hidden>
          ${icon('trash', 'icon--sm')}
        </button>
      </div>
    </li>`;
}

const KIND_LABEL = { cover: '표지', body: '본문', note: '반론', outro: '마무리' };
const kindLabel = (k) => KIND_LABEL[k] || '본문';

function bindShots(root) {
  root.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.copy);
      copyText(buildPrompt(deck[i], getState().concept), `${i + 1}번 프롬프트를 복사했습니다.`);
    });
  });

  root.querySelectorAll('[data-gen]').forEach((btn) => {
    btn.addEventListener('click', () => generateOne(root, Number(btn.dataset.gen)));
  });

  root.querySelectorAll('[data-upload]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { toast('이미지 파일만 올릴 수 있습니다.'); return; }
      await saveImage(root, Number(input.dataset.upload), file, 'upload');
      input.value = '';
      toast('이미지를 올렸습니다.');
    });
  });

  root.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const i = Number(btn.dataset.del);
      const s = getState();
      await deleteImage(imageKey(s.productId, s.concept, i));
      const images = { ...s.images };
      delete images[i];
      setState({ images });
      showThumb(root, i, null);
      refreshStepper(root);
      toast(`${i + 1}번 이미지를 지웠습니다.`);
    });
  });
}

/* ---------------- 이미지 로드·저장 ---------------- */

async function loadThumbs(root) {
  const s = getState();
  for (let i = 0; i < deck.length; i++) {
    const blob = await getImage(imageKey(s.productId, s.concept, i));
    if (blob) showThumb(root, i, blob);
  }
}

function showThumb(root, i, blob) {
  const img = root.querySelector(`[data-img="${i}"]`);
  const ph = root.querySelector(`[data-ph="${i}"]`);
  const del = root.querySelector(`[data-del="${i}"]`);
  if (!img) return;

  if (blob) {
    img.src = objectUrl(blob);
    img.alt = `${i + 1}번 카드 배경 이미지: ${deck[i].shot}`;
    img.hidden = false;
    if (ph) ph.hidden = true;
    if (del) del.hidden = false;
  } else {
    img.removeAttribute('src');
    img.hidden = true;
    if (ph) ph.hidden = false;
    if (del) del.hidden = true;
  }
}

async function saveImage(root, i, blob, source) {
  const s = getState();
  await putImage(imageKey(s.productId, s.concept, i), blob);
  setState({ images: { ...getState().images, [i]: { source, at: Date.now() } } });
  showThumb(root, i, blob);
  refreshStepper(root);
}

/** 이미지가 생기면 4단계 잠금이 풀리므로 스테퍼를 다시 그린다 */
function refreshStepper(root) {
  const nav = root.querySelector('.stepper');
  if (!nav) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = stepperHTML('/image');
  nav.replaceWith(wrap.firstElementChild);
  bindStepper(root);
}

function setBusy(root, i, on) {
  const el = root.querySelector(`[data-busy="${i}"]`);
  if (el) el.hidden = !on;
  const btn = root.querySelector(`[data-gen="${i}"]`);
  if (btn) btn.disabled = on || !hasKey();
}

async function generateOne(root, i) {
  if (busy) { toast('이미 생성 중입니다.'); return; }
  busy = true;
  setBusy(root, i, true);
  try {
    const blob = await generateImage(buildPrompt(deck[i], getState().concept));
    await saveImage(root, i, blob, 'ai');
    toast(`${i + 1}번 이미지를 만들었습니다.`);
  } catch (e) {
    toast(e.message, 4200);
  } finally {
    setBusy(root, i, false);
    busy = false;
  }
}

async function generateAll(root) {
  if (busy) return;
  const btn = root.querySelector('#gen-all');
  btn.disabled = true;
  let ok = 0;

  for (let i = 0; i < deck.length; i++) {
    busy = true;
    setBusy(root, i, true);
    try {
      const blob = await generateImage(buildPrompt(deck[i], getState().concept));
      await saveImage(root, i, blob, 'ai');
      ok++;
    } catch (e) {
      toast(`${i + 1}번 실패 · ${e.message}`, 4200);
      setBusy(root, i, false);
      busy = false;
      break;   // 키·크레딧 문제면 나머지도 실패하므로 멈춘다
    }
    setBusy(root, i, false);
    busy = false;
  }

  btn.disabled = !hasKey();
  if (ok) toast(`${ok}장을 만들었습니다.`);
}

/* ---------------- 유틸 ---------------- */

async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    const tmp = document.createElement('textarea');
    tmp.value = text;
    tmp.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(tmp);
    tmp.select();
    const done = document.execCommand('copy');
    tmp.remove();
    toast(done ? okMessage : '복사에 실패했습니다. 직접 선택해 복사해 주세요.');
  }
}

const esc = (str = '') =>
  str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
