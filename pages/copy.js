/**
 * 2단계 — 아이디어 문서화
 * 선택한 상품·주제·톤으로 채널별 추천 글귀를 만들고, 그 자리에서 편집·복사한다.
 */
import { icon } from '../assets/icons.js';
import { CHANNELS, BANNED_PHRASES, getProduct } from '../data/products.js';
import { stepperHTML, bindStepper } from '../components/stepper.js';
import { getState, setState, navigate, draftKeyOf } from '../store.js';
import { generate, findBanned, TONE_LABEL, IMAGE_PLAN } from '../lib/copywriter.js';
import { generateWithAI } from '../lib/copyai.js';
import {
  PROVIDERS, getProvider, setProvider, currentProvider,
  MODELS, getModel, setModel, hasKey, maskedKey, setKey,
} from '../lib/llm.js';
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
            <!-- 버튼은 하나다. 키가 있으면 AI 로, 없으면 규칙 기반으로 다시 쓴다.
                 예전엔 「전체 재생성」(규칙 기반)과 「전체 AI로 쓰기」가 나란히 있어 헷갈렸다. -->
            <button type="button" class="btn btn--sm" id="regen-all"
                    aria-label="${hasKey() ? 'AI로 모든 채널 글귀를 새로 쓰기' : '모든 채널 글귀를 새로 생성하기'}">
              ${icon(hasKey() ? 'sparkles' : 'refresh', 'icon--sm')}
              ${hasKey() ? '전체 다시 쓰기 (AI)' : '전체 재생성'}
            </button>
          </div>
        </div>

        <div class="aibar card" id="aibar">${aibarHTML()}</div>
        <div id="ai-status"></div>

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
          <button type="button" class="btn btn--lg" id="go-template"
                  aria-label="카드뉴스 템플릿 단계로 이동">
            카드뉴스 만들기 ${icon('arrowRight', 'icon--sm')}
          </button>
        </div>
      </section>
    </div>`;

  bindStepper(root);
  bindTabs(root);
  bindPanel(root);
  bindAibar(root);

  /**
   * 키가 있으면 **항상 AI 로 쓴다** (요청자 지시 2026-08-03).
   * 규칙 기반은 키가 없거나 AI 가 검수를 통과 못 했을 때만 남는 최후 수단이다.
   *
   * 같은 조건(상품·주제·톤)으로 다시 들어오면 부르지 않는다. 이미 AI 글이 있는데
   * 또 부르면 할당량만 쓰고 결과는 그대로다.
   */
  const st = getState();
  if (hasKey() && st.aiKey !== draftKeyOf(st) && !hasEdits()) {
    queueMicrotask(() => aiAll(root, { auto: true }));
  }

  root.querySelector('#regen-all')?.addEventListener('click', () => {
    const useAI = hasKey();
    if (hasEdits() && !confirm(`편집한 내용이 있습니다. 모두 ${useAI ? 'AI 글' : '새 글귀'}로 덮어쓸까요?`)) return;
    if (useAI) { aiAll(root); return; }
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

  root.querySelector('#go-template')?.addEventListener('click', () => navigate('/template'));
}

/* ---------------- AI 설정 ---------------- */

/**
 * 규칙 기반 생성은 키 없이 늘 동작한다. AI 는 '더 좋게 다시 쓰는' 선택지다.
 * 그래서 이 바는 접어 두고, 켜고 싶을 때만 열게 한다.
 */
function aibarHTML() {
  const on = hasKey();
  const p = currentProvider();
  return `
    <div class="aibar__row">
      <span class="keybar__state ${on ? 'is-on' : ''}">
        ${icon(on ? 'check' : 'sparkles', 'icon--sm')}
        ${on ? `${esc(p.name)} 연결됨 · ${esc(maskedKey())}` : 'AI로 글을 다시 쓰려면 API 키가 필요합니다'}
      </span>
      <button type="button" class="btn btn--ghost btn--sm" id="ai-toggle"
              aria-expanded="false" aria-controls="ai-form" aria-label="AI 글쓰기 설정 열기">
        ${on ? '설정 변경' : 'AI 켜기'}
      </button>
    </div>

    <div class="aibar__form" id="ai-form" hidden>
      <div class="notice notice--info" role="note">
        <span class="notice__icon" aria-hidden="true">${icon('alert', 'icon--sm')}</span>
        <div>
          <strong>Gemini 텍스트 모델은 무료 한도가 있습니다</strong>
          <p>이미지와 달리 결제 설정 없이 키만 있으면 글을 쓸 수 있습니다.
             키는 이 브라우저에만 저장되고 코드·저장소에는 남지 않습니다.</p>
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="ai-provider">어디로 쓸까요</label>
        <select class="select" id="ai-provider">
          ${PROVIDERS.map((x) => `<option value="${x.id}" ${x.id === getProvider() ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
        </select>
        <p class="field__hint">${esc(p.note)}</p>
      </div>

      <div class="field">
        <label class="field__label" for="ai-key">${esc(p.name)} API 키</label>
        <input class="input" type="password" id="ai-key" autocomplete="off" spellcheck="false" />
        <p class="field__hint">이미지 생성과 같은 키를 씁니다. 이미 넣으셨다면 다시 넣지 않아도 됩니다.</p>
      </div>

      <div class="field">
        <label class="field__label" for="ai-model">모델</label>
        <select class="select" id="ai-model">
          ${MODELS().map((m) => `<option value="${m.id}" ${m.id === getModel() ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}
        </select>
        <p class="field__hint">${esc(MODELS().find((m) => m.id === getModel())?.note || '')}</p>
      </div>

      <div class="notice notice--info" role="note">
        <span class="notice__icon" aria-hidden="true">${icon('sparkles', 'icon--sm')}</span>
        <div>
          <strong>키가 있으면 항상 AI가 씁니다</strong>
          <p>이 화면에 들어오면 세 채널을 자동으로 다시 씁니다.
             같은 상품·주제·톤으로 다시 들어올 때는 부르지 않습니다.</p>
        </div>
      </div>

      <div class="keybar__actions">
        <button type="button" class="btn btn--sm" id="ai-save" aria-label="AI 설정 저장하기">저장</button>
        ${on ? '<button type="button" class="btn btn--text btn--sm" id="ai-clear" aria-label="저장된 API 키 삭제하기">키 삭제</button>' : ''}
      </div>
    </div>`;
}

function refreshAibar(root) {
  const bar = root.querySelector('#aibar');
  if (!bar) return;
  bar.innerHTML = aibarHTML();
  bindAibar(root);
  root.querySelectorAll('[data-ai]').forEach((b) => { b.disabled = !hasKey(); });
}

function bindAibar(root) {
  const form = root.querySelector('#ai-form');
  const toggle = root.querySelector('#ai-toggle');

  toggle?.addEventListener('click', () => {
    const open = form.hidden;
    form.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) root.querySelector('#ai-key')?.focus();
  });

  root.querySelector('#ai-provider')?.addEventListener('change', (e) => {
    setProvider(e.target.value);
    refreshAibar(root);
    root.querySelector('#ai-form').hidden = false;
    root.querySelector('#ai-toggle')?.setAttribute('aria-expanded', 'true');
  });

  root.querySelector('#ai-model')?.addEventListener('change', (e) => setModel(e.target.value));

  root.querySelector('#ai-save')?.addEventListener('click', () => {
    const input = root.querySelector('#ai-key');
    const value = input.value.trim();
    if (value) setKey(value);
    setModel(root.querySelector('#ai-model').value);
    input.value = '';                       // 화면에 남기지 않는다
    refreshAibar(root);
    toast(hasKey() ? 'AI 글쓰기를 켰습니다.' : '키를 입력해 주세요.');
  });

  root.querySelector('#ai-clear')?.addEventListener('click', () => {
    setKey('');
    refreshAibar(root);
    toast('저장된 키를 삭제했습니다.');
  });
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
          ${s.sources[activeTab] === 'ai' ? '<span class="badge">AI가 씀</span>' : ''}
          ${edited ? '<span class="badge badge--neutral">편집됨</span>' : ''}
        </div>
        <div class="panel__tools">
          <output class="counter${over ? ' counter--over' : ''}" id="counter"
                  for="draft-${c.id}" aria-live="polite">
            ${text.length.toLocaleString()} / ${c.limit.toLocaleString()}자
          </output>
          <button type="button" class="btn btn--ghost btn--sm" data-regen="${c.id}"
                  aria-label="${c.name} 글귀를 규칙 기반으로 새로 생성하기">
            ${icon('refresh', 'icon--sm')} 재생성
          </button>
          <button type="button" class="btn btn--soft btn--sm" data-ai="${c.id}"
                  aria-label="${c.name} 글귀를 AI로 다시 쓰기" ${hasKey() ? '' : 'disabled'}>
            ${icon('sparkles', 'icon--sm')} AI로 쓰기
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
      <p class="field__hint">🖼 ${esc(IMAGE_PLAN[c.id] || '')} 카드는 3단계에서 한 벌만 만들어 세 채널에 나눠 씁니다.</p>

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

  root.querySelector('[data-ai]')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.ai;
    const s = getState();
    if (s.drafts[id] !== s.generated[id] && !confirm('편집한 내용을 AI 글로 덮어쓸까요?')) return;
    aiOne(root, id);
  });

  bindStale(root);
}

/* ---------------- AI 생성 ---------------- */

let aiBusy = false;

function setAiBusy(root, on, label) {
  aiBusy = on;
  root.querySelectorAll('[data-ai]').forEach((b) => { b.disabled = on || !hasKey(); });
  const regen = root.querySelector('#regen-all');
  if (regen) regen.disabled = on;
  const btn = root.querySelector('[data-ai]');
  if (btn && label) btn.innerHTML = on ? `<span class="spinner" aria-hidden="true"></span> ${label}` : btn.innerHTML;
}

async function aiOne(root, id) {
  if (aiBusy) { toast('이미 쓰는 중입니다.'); return; }
  const c = CHANNELS.find((x) => x.id === id);
  setAiBusy(root, true, '쓰는 중…');
  toast(`${c.name} 글을 AI가 쓰고 있습니다…`, 3000);
  try {
    const text = await generateWithAI(id, ctx(0));
    const s = getState();
    setState({
      drafts: { ...s.drafts, [id]: text },
      generated: { ...s.generated, [id]: text },
      sources: { ...s.sources, [id]: 'ai' },
      draftKey: draftKeyOf(s),
    });
    refreshPanel(root);
    refreshStale(root);
    toast(`${c.name} 글을 새로 썼습니다.`);
  } catch (e) {
    // 검수를 통과 못 했거나 호출이 실패하면 기존 글을 그대로 둔다 — 나쁜 글로 덮어쓰지 않는다
    toast(`${c.name} 실패 · ${e.message}`, 5000);
    refreshPanel(root);
  } finally {
    setAiBusy(root, false);
  }
}

/**
 * 세 채널을 **동시에** 부른다.
 * 한 채널에 20~40초 걸려서 순서대로 돌리면 2분 가까이 기다려야 했다.
 */
async function aiAll(root, { auto = false } = {}) {
  if (aiBusy) return;
  const channels = CHANNELS.filter((c) => getState().channels.includes(c.id));
  setAiBusy(root, true);
  showAiStatus(root, `AI가 ${channels.length}개 채널 글을 쓰고 있습니다… 30초쯤 걸립니다.`);

  const results = await Promise.allSettled(channels.map((c) => generateWithAI(c.id, ctx(0))));

  let ok = 0;
  results.forEach((r, i) => {
    const c = channels[i];
    if (r.status !== 'fulfilled') {
      // 실패하면 기존 글을 그대로 둔다 — 나쁜 글로 덮어쓰지 않는다
      toast(`${c.name} 실패 · ${r.reason?.message || r.reason}`, 5000);
      return;
    }
    const s = getState();
    setState({
      drafts: { ...s.drafts, [c.id]: r.value },
      generated: { ...s.generated, [c.id]: r.value },
      sources: { ...s.sources, [c.id]: 'ai' },
      draftKey: draftKeyOf(s),
    });
    ok++;
  });

  // 성공하든 실패하든 기록해 둔다. 안 그러면 실패할 때마다 자동 실행이 무한 반복된다.
  setState({ aiKey: draftKeyOf(getState()) });

  setAiBusy(root, false);
  showAiStatus(root, '');
  refreshPanel(root);
  refreshStale(root);

  if (ok) toast(auto ? `AI가 글 ${ok}개를 새로 썼습니다.` : `${ok}개 채널을 AI로 새로 썼습니다.`);
  else if (auto) toast('AI 생성에 실패해 기본 글을 그대로 뒀습니다.', 5000);
}

/** 진행 상황 한 줄 — 30초 넘게 걸려서 아무 표시가 없으면 멈춘 줄 안다 */
function showAiStatus(root, message) {
  const slot = root.querySelector('#ai-status');
  if (!slot) return;
  slot.innerHTML = message
    ? `<div class="notice notice--info" role="status">
         <span class="spinner" aria-hidden="true"></span>
         <div><strong>${esc(message)}</strong></div>
       </div>`
    : '';
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

/**
 * ⚠️ 한 채널만 다시 뽑지 않는다. **세 채널을 항상 함께 뽑는다.**
 *
 * 세 채널은 같은 내용을 말해야 한다(요청자 요구). 내용을 정하는 것은 variant 하나이므로,
 * 한 채널만 variant 를 올리면 그 채널만 다른 사실을 다루게 되어 통일이 깨진다.
 * 그래서 채널별 「다시 쓰기」도 전체 재생성으로 넘긴다.
 */
function regenerateOne(id, { advance = true } = {}) {
  regenerateAll({ advance });
}

/** 재생성할 때마다 variant 가 올라가 다른 후킹·근거 조합이 나온다 (세 채널 동시에) */
function regenerateAll({ advance = true } = {}) {
  const s = getState();
  // 채널마다 따로 두지 않고 하나의 값을 공유한다 — 이게 내용 통일의 조건이다
  const variant = Math.max(...s.channels.map((id) => s.variants[id] ?? -1), -1) + (advance ? 1 : 0);
  const shared = Math.max(variant, 0);

  const drafts = {};
  const variants = { ...s.variants };
  const sources = { ...s.sources };
  s.channels.forEach((id) => {
    variants[id] = shared;
    drafts[id] = generate(id, ctx(shared));
    sources[id] = 'rule';
  });
  setState({ drafts, generated: { ...drafts }, variants, sources, draftKey: draftKeyOf(s) });
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
