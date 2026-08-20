/**
 * 1단계 — 상품·주제 선택
 * 상품을 고르면 기준 정보 브리프가 열리고, 주제를 입력하면 2단계로 넘어간다.
 */
import { icon } from '../assets/icons.js';
import { PRODUCTS, getProduct } from '../lib/products.js';
import { CHANNELS } from '../data/channels.js';
import { productCardHTML } from '../components/product-card.js';
import { stepperHTML, bindStepper } from '../components/stepper.js';
import { getState, setState, navigate } from '../store.js';
import { toast } from '../components/toast.js';
import { choiceModal, confirmModal } from '../components/modal.js';
import { clearLibraryEdit, getLibrary, getLibraryEditId, loadFromLibrary, postKeyOf } from '../lib/librarystore.js';

export const title = '상품·주제 선택';

/** 톤앤매너 프리셋 — 2단계 카피 생성의 입력값 */
const TONES = [
  { id: 'trust', label: '신뢰·정보형', desc: '사실 중심으로 차분하게' },
  { id: 'hook', label: '후킹·공감형', desc: '첫 줄에서 시선을 잡고' },
  { id: 'plain', label: '담백·실무형', desc: '군더더기 없이 핵심만' },
  { id: 'celebrate', label: '축하·발표형', desc: '수상·소식 알림 톤' },
];

export function render(root) {
  const s = getState();

  root.innerHTML = `
    <div class="container">
      ${stepperHTML('/')}

      <section class="hero">
        <h1>어떤 상품을 알리고 싶으세요?</h1>
        
      </section>

      <section class="section" aria-labelledby="sec-product">
        <div class="section__head">
          <h2 id="sec-product">1. 상품 선택</h2>
          <p class="section__desc">기준 정보는 사내 브랜드 자료(2026-07-23 기준)를 따릅니다.</p>
        </div>
        <fieldset class="product-grid" id="product-grid">
          <legend class="sr-only">광고할 상품을 선택하세요</legend>
          ${PRODUCTS.map((p) => productCardHTML(p, p.id === s.productId)).join('')}
        </fieldset>
      </section>

      <section class="section" aria-labelledby="sec-brief">
        <div class="section__head">
          <h2 id="sec-brief">2. 주제 정하기</h2>
          <p class="section__desc">이번 게시물에서 하고 싶은 이야기를 적어주세요.</p>
        </div>
        <div id="brief-panel">${briefHTML()}</div>
      </section>
    </div>`;

  bindStepper(root);
  bindProductGrid(root);
  bindBrief(root);
}

/* ---------------- 브리프 패널 ---------------- */

function briefHTML() {
  const s = getState();
  const p = getProduct(s.productId);

  if (!p) {
    return `
      <div class="card empty">
        ${icon('award', 'icon--lg')}
        <p>먼저 위에서 상품을 선택하면 기준 정보와 주제 추천이 열립니다.</p>
      </div>`;
  }

  return `
    <div class="brief">
      <!-- 왼쪽: 선택한 상품의 기준 정보 -->
      <aside class="card brief__facts" aria-labelledby="brief-title">
        <span class="badge">${p.short}</span>
        <h3 id="brief-title">${p.name}</h3>
        <p class="brief__summary">${p.summary}</p>

        <h4 class="brief__label">기본 정보</h4>
        <ul class="brief__list">
          ${p.facts.map((f) => `<li>${icon('check', 'icon--sm')}<span>${f}</span></li>`).join('')}
        </ul>

        ${p.events.length ? `
        <h4 class="brief__label">행사 일정</h4>
        <ul class="brief__list brief__list--events">
          ${p.events.map((e) => `
            <li>
              <span class="badge ${e.status === 'open' ? '' : 'badge--neutral'}">${e.status === 'open' ? '진행 예정' : '종료'}</span>
              <span><strong>${e.name}</strong><br /><span class="brief__muted">${e.date} · ${e.desc}</span></span>
            </li>`).join('')}
        </ul>` : ''}

        ${p.criteria.length ? `
        <h4 class="brief__label">심사 기준</h4>
        <ul class="brief__bars">
          ${p.criteria.map((c) => `
            <li>
              <span class="brief__bar-label">${c.label}<b>${c.weight}%</b></span>
              <span class="brief__bar" aria-hidden="true"><span style="width:${c.weight * 2}%"></span></span>
            </li>`).join('')}
        </ul>` : ''}

        <h4 class="brief__label">기본 특전</h4>
        <ul class="brief__tags">${p.benefits.map((b) => `<li>${b}</li>`).join('')}</ul>

        ${p.packages.length ? `
        <h4 class="brief__label">추가 패키지</h4>
        <ul class="brief__list">
          ${p.packages.map((k) => `<li>${icon('plus', 'icon--sm')}<span><strong>${k.name}</strong> · ${k.desc}</span></li>`).join('')}
        </ul>` : ''}

        <div class="notice notice--warn" role="note">
          <span class="notice__icon" aria-hidden="true">${icon('alert', 'icon--sm')}</span>
          <div>
            <strong>표현 주의</strong>
            <ul>${p.cautions.map((c) => `<li>${c}</li>`).join('')}</ul>
          </div>
        </div>
      </aside>

      <!-- 오른쪽: 주제·톤·채널 입력 -->
      <div class="card brief__form">
        <div class="field">
          <label class="field__label" for="topic-input">이번 게시물 주제</label>
          <textarea class="textarea" id="topic-input" rows="4" autocomplete="off"
                    placeholder="예) 2026 시상식 일정을 알리고, 기본 특전 6종을 정리해서 보여주고 싶어요."
                    aria-describedby="topic-hint">${escapeHTML(getState().topic)}</textarea>
          <p class="field__hint" id="topic-hint">구체적일수록 글귀가 정확해집니다. 아래 추천 주제를 눌러 채울 수도 있어요.</p>
        </div>

        <div class="field">
          <span class="field__label" id="preset-label">추천 주제</span>
          <ul class="chip-row" aria-labelledby="preset-label">
            ${p.topicPresets.map((t) => `
              <li><button type="button" class="chip" data-preset="${escapeAttr(t)}"
                          aria-label="추천 주제 적용: ${escapeAttr(t)}">${t}</button></li>`).join('')}
          </ul>
        </div>

        <div class="field">
          <label class="field__label" for="tone-select">톤앤매너</label>
          <select class="select" id="tone-select" aria-describedby="tone-hint">
            ${TONES.map((t) => `<option value="${t.id}" ${t.id === getState().tone ? 'selected' : ''}>${t.label} — ${t.desc}</option>`).join('')}
          </select>
          <p class="field__hint" id="tone-hint">선택한 톤에 맞춰 3개 채널 글귀가 함께 만들어집니다.</p>
        </div>

        <fieldset class="field">
          <legend class="field__label">카드뉴스 장수</legend>
          <div class="pickrow" role="radiogroup" aria-label="카드뉴스 장수 선택">
            ${[1, 2, 3, 4, 5, 6].map((n) => `
              <input class="sr-only pick__input" type="radio" name="cardcount" id="cc-${n}" value="${n}"
                     autocomplete="off" aria-label="카드 ${n}장"
                     ${(getState().cardCount || 6) === n ? 'checked' : ''} />
              <label class="pick" for="cc-${n}">${n}장</label>`).join('')}
          </div>
          <p class="field__hint" id="cc-hint">${cardCountHint(getState().cardCount || 6)}</p>
        </fieldset>

        <fieldset class="field">
          <legend class="field__label">내보낼 채널</legend>
          <ul class="channel-row">
            ${CHANNELS.map((c) => `
              <li>
                <input class="sr-only channel__input" type="checkbox" id="ch-${c.id}" value="${c.id}"
                       aria-label="${c.name} — ${c.hint}" autocomplete="off"
                       ${getState().channels.includes(c.id) ? 'checked' : ''} />
                <label class="channel" for="ch-${c.id}">
                  ${icon(c.icon, 'icon--sm')}
                  <span>
                    <strong>${c.name}</strong>
                    <em>${c.hint}</em>
                  </span>
                </label>
              </li>`).join('')}
          </ul>
        </fieldset>

        <div class="brief__actions">
          <!--
            ⚠️ **여기서 「블로그 스타일」로 보내지 말 것** (2026-08-20, 요청자 지시).
               8-20 에 스타일 수집을 단계에서 뺐는데(store.js STEPS 주석) 이 버튼만 그대로
               /research 로 가고 있었다 — 상품·주제를 고르면 매번 수집 화면이 열렸다.
               스타일은 설정이고, 다음 단계는 2단계 「아이디어 문서화」다. 거기서 골라 쓴다.
          -->
          <button type="button" class="btn btn--lg" id="go-copy"
                  aria-label="아이디어 문서화 단계로 이동">
            아이디어 문서화로 계속 ${icon('arrowRight', 'icon--sm')}
          </button>
          <button type="button" class="btn btn--text" id="clear-topic" aria-label="입력한 주제 지우기">
            초기화
          </button>
        </div>
      </div>
    </div>`;
}

/* ---------------- 이벤트 바인딩 ---------------- */

function bindProductGrid(root) {
  root.querySelector('#product-grid')?.addEventListener('change', (e) => {
    const input = e.target;
    if (input.name !== 'product') return;
    setState({ productId: input.value, libraryTitle: '' });
    refreshBrief(root);
    // 상품을 바꾸면 곧바로 주제 입력으로 초점을 옮겨 흐름이 끊기지 않게 한다
    root.querySelector('#topic-input')?.focus({ preventScroll: true });
  });
}

function refreshBrief(root) {
  const panel = root.querySelector('#brief-panel');
  if (!panel) return;
  panel.innerHTML = briefHTML();
  bindBrief(root);
}

function bindBrief(root) {
  const topicEl = root.querySelector('#topic-input');

  topicEl?.addEventListener('input', () => {
    setState({ topic: topicEl.value, libraryTitle: '' });
    syncCta(root);
  });

  root.querySelectorAll('input[name="cardcount"]').forEach((el) => {
    el.addEventListener('change', () => {
      const n = Number(el.value);
      setState({ cardCount: n });
      const hint = root.querySelector('#cc-hint');
      if (hint) hint.textContent = cardCountHint(n);
    });
  });

  root.querySelector('#tone-select')?.addEventListener('change', (e) => {
    setState({ tone: e.target.value });
  });

  root.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.preset;
      setState({ topic: value, libraryTitle: '' });
      if (topicEl) {
        topicEl.value = value;
        topicEl.focus();
      }
      syncCta(root);
    });
  });

  root.querySelectorAll('.channel__input').forEach((box) => {
    box.addEventListener('change', () => {
      const checked = [...root.querySelectorAll('.channel__input')]
        .filter((b) => b.checked).map((b) => b.value);
      if (!checked.length) {
        box.checked = true;   // 최소 1개 채널은 유지
        toast('채널은 최소 1개를 선택해야 합니다.');
        return;
      }
      setState({ channels: checked });
    });
  });

  root.querySelector('#clear-topic')?.addEventListener('click', () => {
    setState({ topic: '', libraryTitle: '' });
    if (topicEl) { topicEl.value = ''; topicEl.focus(); }
    syncCta(root);
    toast('주제를 비웠습니다.');
  });

  root.querySelector('#go-copy')?.addEventListener('click', async () => {
    if (!isReady()) {
      toast('상품과 주제를 먼저 입력해 주세요.');
      topicEl?.focus();
      return;
    }
    const s = getState();
    const editingId = getLibraryEditId();
    const editingItem = editingId ? getLibrary().find((item) => item.id === editingId) : null;
    if (editingItem && editingItem.postKey !== postKeyOf(s)) {
      const makeNew = await confirmModal(
        '새 게시물을 만들까요?',
        { title: '다른 주제를 선택했습니다', okLabel: '만들기', cancelLabel: '취소' },
      );
      if (!makeNew) return;

      // 불러온 게시물의 결과물이 새 주제에 섞이지 않도록 입력 조건만 남기고 제작물을 비운다.
      clearLibraryEdit();
      setState({
        drafts: {}, generated: {}, variants: {}, sources: {},
        draftKey: '', aiKey: {}, outline: null, researchStyle: null,
        aiRuns: { key: '', list: [] }, activeAiRun: null,
        image: null, images: {}, card: null,
      });
    }

    const nextState = getState();
    const existing = getLibrary().find((item) => item.postKey === postKeyOf(nextState));
    const isEditingExisting = existing?.id === getLibraryEditId();
    if (existing && !isEditingExisting) {
      const choice = await choiceModal(
        '보관함에 저장되어있는 주제입니다.',
        {
          title: '보관함에 저장된 주제',
          choices: [
            { value: 'load', label: '불러오기', primary: true },
          ],
        },
      );
      if (choice !== 'load') return;

      const result = await loadFromLibrary(existing.id);
      if (!result.ok) {
        toast(result.error);
        return;
      }
      navigate('/copy');
      return;
    }

    // 홈에서 시작하는 작업은 같은 상품·주제를 다시 골랐더라도 새 작업이다.
    // localStorage에 남은 이전 AI 결과를 그대로 보여 주면 사용자는 생성 버튼을
    // 누르기 전인데도 이미 글이 만들어진 것으로 보인다. 보관함에서 명시적으로
    // 불러와 편집 중인 게시물만 기존 결과를 유지한다.
    if (!isEditingExisting) {
      clearLibraryEdit();
      const current = getState();
      const runsKey = `${current.productId}|${String(current.topic || '').trim()}`;
      const sameTopicRuns = current.aiRuns?.key === runsKey
        || TONES.some(({ id }) => current.aiRuns?.key === `${runsKey}|${id}`);
      setState({
        drafts: {}, generated: {}, variants: {}, sources: {},
        draftKey: '', aiKey: {}, outline: null, researchStyle: null,
        aiRuns: sameTopicRuns ? current.aiRuns : { key: '', list: [] }, activeAiRun: null,
        image: null, images: {}, card: null,
      });
    }
    navigate('/copy');
  });

  syncCta(root);
}


/**
 * 장수를 줄여도 글은 기승전결을 그대로 쓴다. 줄어드는 것은 이미지뿐이다.
 * 그래서 안내도 '무엇이 빠지는지'가 아니라 '카드가 무엇을 담는지'로 적는다.
 */
function cardCountHint(n) {
  const plan = {
    1: '표지 한 장에 후킹과 마무리를 함께 얹습니다.',
    2: '표지 · 마무리',
    3: '표지 · 본문 1 · 마무리',
    4: '표지 · 본문 2 · 마무리',
    5: '표지 · 본문 2 · 반론 · 마무리',
    6: '표지 · 본문 3 · 반론 · 마무리',
  }[n] || '';
  return `${plan} 장수를 줄여도 블로그·인스타 글은 기승전결을 그대로 씁니다. 이미지만 줄어듭니다.`;
}

function isReady() {
  const s = getState();
  return Boolean(s.productId) && s.topic.trim().length >= 2;
}

function syncCta(root) {
  const btn = root.querySelector('#go-copy');
  if (btn) btn.disabled = !isReady();
}

/* ---------------- 유틸 ---------------- */

const escapeHTML = (str = '') =>
  str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const escapeAttr = (str = '') => escapeHTML(str);
