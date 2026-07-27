/**
 * 2단계 — 아이디어 문서화
 * 선택한 상품·주제·톤으로 채널별 추천 글귀를 만들고, 그 자리에서 편집·복사한다.
 */
import { icon } from '../assets/icons.js';
import { CHANNELS, BANNED_PHRASES, getProduct } from '../data/products.js';
import { stepperHTML, bindStepper } from '../components/stepper.js';
import { getState, setState, navigate, draftKeyOf } from '../store.js';
import { generate, findBanned, TONE_LABEL } from '../lib/copywriter.js';
import { toast } from '../components/toast.js';

export const title = '아이디어 문서화';

/** 상품·주제가 없으면 1단계로 되돌린다 */
export function guard() {
  const s = getState();
  return s.productId && s.topic.trim() ? null : '/';
}

/** 현재 열린 탭 — 페이지를 벗어나면 초기화되는 화면 상태라 스토어에 넣지 않는다 */
let activeTab = null;

export function render(root) {
  const s = getState();
  const p = getProduct(s.productId);
  const channels = CHANNELS.filter((c) => s.channels.includes(c.id));

  // 편집한 적이 없으면 최신 입력값으로 조용히 다시 생성한다
  if (draftKeyOf(s) !== s.draftKey && !hasEdits()) regenerateAll();

  if (!activeTab || !channels.some((c) => c.id === activeTab)) activeTab = channels[0].id;
  channels.forEach((c) => { if (!getState().drafts[c.id]) regenerateOne(c.id); });

  root.innerHTML = `
    <div class="container">
      ${stepperHTML('/copy')}

      <section class="section">
        <div class="section__head">
          <h1>추천 글귀가 준비됐습니다</h1>
          <p class="section__desc">그대로 써도 되고, 바로 고쳐 써도 됩니다. 복사 버튼을 누르면 클립보드에 담깁니다.</p>
        </div>

        <!-- 어떤 조건으로 만든 글인지 항상 보이게 -->
        <div class="ctxbar card">
          <dl class="ctxbar__list">
            <div><dt>상품</dt><dd>${esc(p.name)}</dd></div>
            <div><dt>주제</dt><dd>${esc(s.topic)}</dd></div>
            <div><dt>톤</dt><dd>${esc(toneLabel(s.tone))}</dd></div>
          </dl>
          <div class="ctxbar__actions">
            <a class="btn btn--ghost btn--sm" href="#/" aria-label="상품과 주제를 다시 선택하기">
              ${icon('arrowLeft', 'icon--sm')} 조건 수정
            </a>
            <button type="button" class="btn btn--soft btn--sm" id="regen-all"
                    aria-label="모든 채널 글귀를 새로 생성하기">
              ${icon('refresh', 'icon--sm')} 전체 재생성
            </button>
          </div>
        </div>

        <div id="stale-slot">${staleNoticeHTML()}</div>

        <!-- 채널 탭 -->
        <div class="tabs" role="tablist" aria-label="채널별 글귀">
          ${channels.map((c) => `
            <button type="button" class="tabs__tab" role="tab"
                    id="tab-${c.id}" data-tab="${c.id}"
                    aria-controls="panel-${c.id}"
                    aria-selected="${c.id === activeTab}"
                    tabindex="${c.id === activeTab ? '0' : '-1'}">
              ${icon(c.icon, 'icon--sm')} ${c.name}
            </button>`).join('')}
        </div>

        <div id="panel-slot">${panelHTML()}</div>

        <div class="flow-actions">
          <button type="button" class="btn btn--ghost" id="copy-all"
                  aria-label="모든 채널 글귀를 한 번에 복사하기">
            ${icon('copy', 'icon--sm')} 전체 복사
          </button>
          <button type="button" class="btn btn--lg" id="go-image"
                  aria-label="이미지 제작 단계로 이동">
            이미지 제작으로 ${icon('arrowRight', 'icon--sm')}
          </button>
        </div>
      </section>
    </div>`;

  bindStepper(root);
  bindTabs(root);
  bindPanel(root);

  root.querySelector('#regen-all')?.addEventListener('click', () => {
    if (hasEdits() && !confirm('편집한 내용이 있습니다. 모두 새 글귀로 덮어쓸까요?')) return;
    regenerateAll();
    refreshPanel(root);
    refreshStale(root);
    toast('모든 채널 글귀를 새로 만들었습니다.');
  });

  root.querySelector('#copy-all')?.addEventListener('click', () => {
    const s2 = getState();
    const text = channels
      .map((c) => `[${c.name}]\n${s2.drafts[c.id] || ''}`)
      .join('\n\n──────────\n\n');
    copyText(text, `${channels.length}개 채널 글귀를 복사했습니다.`);
  });

  root.querySelector('#go-image')?.addEventListener('click', () => navigate('/image'));
}

/* ---------------- 패널 ---------------- */

function panelHTML() {
  const s = getState();
  const c = CHANNELS.find((x) => x.id === activeTab);
  const text = s.drafts[activeTab] || '';
  const banned = findBanned(text, BANNED_PHRASES);
  const over = text.length > c.limit;
  const edited = s.drafts[activeTab] !== s.generated[activeTab];

  return `
    <div class="panel card" role="tabpanel" id="panel-${c.id}" aria-labelledby="tab-${c.id}" tabindex="0">
      <div class="panel__bar">
        <div class="panel__meta">
          <span class="badge">${c.name}</span>
          <span class="panel__hint">${c.hint}</span>
          ${edited ? '<span class="badge badge--neutral">편집됨</span>' : ''}
        </div>
        <div class="panel__tools">
          <output class="counter${over ? ' counter--over' : ''}" id="counter"
                  for="draft-${c.id}" aria-live="polite">
            ${text.length.toLocaleString()} / ${c.limit.toLocaleString()}자
          </output>
          <button type="button" class="btn btn--ghost btn--sm" data-regen="${c.id}"
                  aria-label="${c.name} 글귀만 새로 생성하기">
            ${icon('refresh', 'icon--sm')} 재생성
          </button>
          <button type="button" class="btn btn--sm" data-copy="${c.id}"
                  aria-label="${c.name} 글귀 복사하기">
            ${icon('copy', 'icon--sm')} 복사
          </button>
        </div>
      </div>

      <label class="sr-only" for="draft-${c.id}">${c.name} 글귀 편집</label>
      <textarea class="textarea draft" id="draft-${c.id}" data-draft="${c.id}"
                spellcheck="false" autocomplete="off"
                aria-describedby="limit-${c.id}">${esc(text)}</textarea>
      <p class="field__hint" id="limit-${c.id}">${c.limitLabel} · 내용은 자동 저장됩니다.</p>

      <div id="warn-slot">${warnHTML(banned, over, c)}</div>
    </div>`;
}

/** 금지 표현·길이 초과 경고 */
function warnHTML(banned, over, c) {
  if (!banned.length && !over) return '';
  return `
    <div class="notice notice--warn" role="alert">
      <span class="notice__icon" aria-hidden="true">${icon('alert', 'icon--sm')}</span>
      <div>
        <strong>게시 전 확인이 필요합니다</strong>
        <ul>
          ${banned.map((b) => `<li>금지 표현 포함: "${esc(b)}"</li>`).join('')}
          ${over ? `<li>${c.name} 권장 길이 ${c.limit.toLocaleString()}자를 넘었습니다.</li>` : ''}
        </ul>
      </div>
    </div>`;
}

/** 상품·주제가 바뀌었는데 편집본이 남아 있을 때만 뜨는 안내 */
function staleNoticeHTML() {
  const s = getState();
  if (draftKeyOf(s) === s.draftKey) return '';
  return `
    <div class="notice notice--info" role="status">
      <span class="notice__icon" aria-hidden="true">${icon('alert', 'icon--sm')}</span>
      <div>
        <strong>조건이 바뀌었습니다</strong>
        <p>지금 글귀는 이전 상품·주제로 만든 것입니다. 편집한 내용을 지키려면 그대로 두세요.</p>
      </div>
      <button type="button" class="btn btn--sm" id="stale-regen"
              aria-label="바뀐 조건으로 글귀 새로 생성하기">새 조건으로 생성</button>
    </div>`;
}

/* ---------------- 바인딩 ---------------- */

function bindTabs(root) {
  const tabs = [...root.querySelectorAll('[data-tab]')];

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => selectTab(root, tab.dataset.tab));

    // 좌우 화살표 / Home / End 로 탭 이동 (WAI-ARIA 탭 패턴)
    tab.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(tab);
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const next = tabs[(map[e.key] + tabs.length) % tabs.length];
      selectTab(root, next.dataset.tab);
      root.querySelector(`#tab-${next.dataset.tab}`)?.focus();
    });
  });
}

function selectTab(root, id) {
  activeTab = id;
  root.querySelectorAll('[data-tab]').forEach((t) => {
    const on = t.dataset.tab === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  refreshPanel(root);
}

function refreshPanel(root) {
  const slot = root.querySelector('#panel-slot');
  if (!slot) return;
  slot.innerHTML = panelHTML();
  bindPanel(root);
}

function refreshStale(root) {
  const slot = root.querySelector('#stale-slot');
  if (slot) {
    slot.innerHTML = staleNoticeHTML();
    bindStale(root);
  }
}

function bindStale(root) {
  root.querySelector('#stale-regen')?.addEventListener('click', () => {
    regenerateAll();
    refreshPanel(root);
    refreshStale(root);
    toast('새 조건으로 글귀를 다시 만들었습니다.');
  });
}

/** 창 크기가 바뀌면 줄바꿈이 달라지므로 높이를 다시 잰다 */
let onResize = null;

function bindPanel(root) {
  const ta = root.querySelector('[data-draft]');
  if (!ta) return;

  autoGrow(ta);

  // 렌더할 때마다 쌓이지 않도록 이전 리스너를 먼저 걷어낸다
  if (onResize) window.removeEventListener('resize', onResize);
  onResize = () => {
    const el = document.querySelector('[data-draft]');
    if (el) autoGrow(el);
  };
  window.addEventListener('resize', onResize);

  ta.addEventListener('input', () => {
    setState({ drafts: { ...getState().drafts, [ta.dataset.draft]: ta.value } });
    autoGrow(ta);
    updateCounter(root, ta);
  });

  root.querySelector('[data-copy]')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.copy;
    copyText(getState().drafts[id] || '', `${CHANNELS.find((c) => c.id === id).name} 글귀를 복사했습니다.`);
  });

  root.querySelector('[data-regen]')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.regen;
    const s = getState();
    if (s.drafts[id] !== s.generated[id] && !confirm('편집한 내용을 새 글귀로 덮어쓸까요?')) return;
    regenerateOne(id);
    refreshPanel(root);
    refreshStale(root);
    toast('글귀를 새로 만들었습니다.');
  });

  bindStale(root);
}

/** 카운터와 경고 문구만 갱신 — 입력 중 캐럿이 튀지 않도록 textarea 는 건드리지 않는다 */
function updateCounter(root, ta) {
  const c = CHANNELS.find((x) => x.id === ta.dataset.draft);
  const over = ta.value.length > c.limit;
  const counter = root.querySelector('#counter');
  if (counter) {
    counter.textContent = `${ta.value.length.toLocaleString()} / ${c.limit.toLocaleString()}자`;
    counter.classList.toggle('counter--over', over);
  }
  const warn = root.querySelector('#warn-slot');
  if (warn) warn.innerHTML = warnHTML(findBanned(ta.value, BANNED_PHRASES), over, c);
}

/** 내용에 맞춰 높이를 늘린다 (스크롤 안에 스크롤이 생기지 않게) */
function autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${Math.max(ta.scrollHeight, 260)}px`;
}

/* ---------------- 생성 · 복사 ---------------- */

function ctx(variant) {
  const s = getState();
  return { product: getProduct(s.productId), topic: s.topic.trim(), tone: s.tone, variant };
}

/** 재생성할 때마다 variant 가 올라가 다른 후킹·근거 조합이 나온다 */
function regenerateOne(id, { advance = true } = {}) {
  const s = getState();
  const variant = (s.variants[id] ?? -1) + (advance ? 1 : 0);
  const text = generate(id, ctx(Math.max(variant, 0)));
  setState({
    drafts: { ...s.drafts, [id]: text },
    generated: { ...s.generated, [id]: text },
    variants: { ...s.variants, [id]: Math.max(variant, 0) },
    draftKey: draftKeyOf(s),
  });
}

function regenerateAll() {
  const s = getState();
  const drafts = {};
  const variants = { ...s.variants };
  s.channels.forEach((id) => {
    variants[id] = (s.variants[id] ?? -1) + 1;
    drafts[id] = generate(id, ctx(variants[id]));
  });
  setState({ drafts, generated: { ...drafts }, variants, draftKey: draftKeyOf(s) });
}

function hasEdits() {
  const s = getState();
  return Object.keys(s.drafts).some((k) => s.drafts[k] !== s.generated[k]);
}

/** 클립보드 복사 — 권한이 막힌 환경을 위해 execCommand 폴백을 둔다 */
async function copyText(text, okMessage) {
  if (!text.trim()) { toast('복사할 내용이 없습니다.'); return; }
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

/* ---------------- 유틸 ---------------- */

const toneLabel = (id) => TONE_LABEL[id] || id;

const esc = (str = '') =>
  str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
