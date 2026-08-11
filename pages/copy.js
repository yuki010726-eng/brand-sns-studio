/**
 * 2단계 — 아이디어 문서화
 * 선택한 상품·주제·톤으로 채널별 추천 글귀를 만들고, 그 자리에서 편집·복사한다.
 */
import { icon } from '../assets/icons.js';
import { CHANNELS, BANNED_PHRASES, getProduct } from '../data/products.js';
import { stepperHTML, bindStepper } from '../components/stepper.js';
import { getState, setState, navigate, draftKeyOf } from '../store.js';
import { generate, findBanned, TONE_LABEL, IMAGE_PLAN } from '../lib/copywriter.js';
import { generateWithAI, promptKeyOf } from '../lib/copyai.js';
import { coreWithOutline, outlineKeyOf } from '../lib/outline.js';
import {
  MODELS, getModel, setModel, hasKey, maskedKey, setKey,
  isBuiltInKey, isModelPinned,
} from '../lib/llm.js';
import { keyFieldHTML } from '../components/keyfield.js';
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
            <!-- 「전체 재생성」은 항상 규칙 기반, 「AI 생성」은 항상 내장 OpenAI 키로 쓴다.
                 예전엔 하나로 합쳐 키 유무에 따라 라벨이 바뀌었는데(2026-08-10),
                 요청자가 둘을 다시 나눠 달라고 해서 되돌렸다(2026-08-11). -->
            <button type="button" class="btn btn--sm" id="regen-all"
                    aria-label="모든 채널 글귀를 규칙 기반으로 새로 생성하기">
              ${icon('refresh', 'icon--sm')} 전체 재생성
            </button>
            <button type="button" class="btn btn--sm" id="ai-all"
                    aria-label="2단계에서 고른 상품·주제·톤으로 AI가 세 채널 글을 쓰게 하기"
                    ${hasKey() ? '' : 'disabled'}>
              ${icon('sparkles', 'icon--sm')} AI 생성
            </button>
          </div>
        </div>

        <!--
          ⚠️ 키가 내장돼 있으면 AI 설정 바를 **통째로 안 그린다** (요청자 지시 2026-08-11).
             쓰는 사람이 만질 것이 하나도 없기 때문이다 — 모델은 고정돼 있고
             키는 파일에서 오므로 화면에서 바꿀 수 없다. 열어 두면 건드렸다가 헷갈리기만 한다.

             ⚠️ 「AI가 쓰고 있습니다」 안내는 여기가 아니라 toast() 와 setAiBusy() 가 낸다.
                이 바를 지워도 그대로 보인다. 지우면서 그쪽까지 건드리지 말 것.
        -->
        ${isBuiltInKey() ? '' : `<div class="aibar card" id="aibar">${aibarHTML()}</div>`}
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
   * 3단계에 들어와도 AI 를 자동으로 부르지 않는다 (요청자 지시 2026-08-11).
   * 대신 ctxbar 에 2단계에서 고른 상품·주제·톤을 미리보기로 보여주고,
   * 확인 후 "AI 시작" 버튼을 직접 눌러야 그때 AI 가 호출된다.
   * 그동안 탭에는 규칙 기반 글(위의 regenerateOne)이 미리 채워져 있어 화면이 비어 보이지 않는다.
   */

  root.querySelector('#regen-all')?.addEventListener('click', () => {
    if (hasEdits() && !confirm('편집한 내용이 있습니다. 모두 새 글귀로 덮어쓸까요?')) return;
    regenerateAll();
    refreshPanel(root);
    refreshStale(root);
    toast('모든 채널 글귀를 새로 만들었습니다.');
  });

  root.querySelector('#ai-all')?.addEventListener('click', () => {
    if (!hasKey()) { toast('OpenAI 키가 없습니다. 설정에서 먼저 입력해 주세요.'); return; }
    if (hasEdits() && !confirm('편집한 내용이 있습니다. 모두 AI 글로 덮어쓸까요?')) return;
    aiAll(root);
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
 *
 * ⚠️ **키가 내장돼 있으면 이 함수는 아예 불리지 않는다.** 호출하는 쪽(render)이
 *    `isBuiltInKey()` 로 막는다. 그래서 여기에 내장 키 분기를 두지 말 것 — 닿지 않는다.
 *
 * 모델 고정(`config.local.js` 의 textModel)은 **키 내장과 별개**다.
 * 키 없이 고정만 걸 수도 있어서 그 잠금은 여기 남는다.
 */
function aibarHTML() {
  const on = hasKey();
  const modelLocked = isModelPinned();
  return `
    <button type="button" class="btn btn--text btn--sm" id="ai-toggle"
            aria-expanded="false" aria-controls="ai-form" aria-label="AI 설정 열기 — 키·모델 바꾸기">
      ${icon('sparkles', 'icon--sm')} AI 설정${on ? ` · ${esc(maskedKey())}` : ' · 키 필요'}
    </button>

    <div class="aibar__form" id="ai-form" hidden>
      <!-- 키는 각자 발급받아 각자 넣는다. 이미지 프롬프트 화면과 같은 키를 쓴다. -->
      ${keyFieldHTML({ providerId: 'openai', inputId: 'ai-key', hasKey: on, masked: maskedKey() })}

      <div class="field">
        <label class="field__label" for="ai-model">모델</label>
        <select class="select" id="ai-model" ${modelLocked ? 'disabled' : ''}>
          ${MODELS().map((m) => `<option value="${m.id}" ${m.id === getModel() ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}
        </select>
        <p class="field__hint">${modelLocked
          ? 'config.local.js 에서 고정했습니다.'
          : esc(MODELS().find((m) => m.id === getModel())?.note || '')}</p>
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
/** 지금 도는 AI 세션 — 일시정지 · 취소 버튼이 이걸 조작한다. 없으면(=null) 아무것도 안 도는 것 */
let aiSession = null;

/**
 * AI 요청 하나(또는 한 묶음)의 진행을 조작하는 손잡이.
 *
 * ⚠️ **취소는 fetch 를 즉시 끊지만, 일시정지는 이미 나간 요청을 멈추지 못한다.**
 * 네트워크 요청은 중간에 세웠다 이어받을 수 없다 — 스트리밍이 아니라 응답을 통째로 기다리는
 * 방식이라 그렇다(요청자 확인 2026-08-11). 그래서 일시정지는 "**다음** 재시도·다음 호출을
 * 막는" 대기열 정지로 구현한다. `generateWithAI` 가 시도 직전마다 `waitIfPaused()` 를 부른다.
 *
 * 일시정지 중에 취소하면 갇혀 있던 대기도 함께 풀어 준다 — 안 풀면 영원히 멈춘 채로 남는다.
 */
function makeAiSession() {
  const controller = new AbortController();
  let paused = false;
  let release = null;
  let waitPromise = null;

  controller.signal.addEventListener('abort', () => {
    paused = false;
    release?.();
  });

  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
    get paused() { return paused; },
    pause() {
      if (paused || controller.signal.aborted) return;
      paused = true;
      waitPromise = new Promise((resolve) => { release = resolve; });
    },
    resume() {
      if (!paused) return;
      paused = false;
      release?.();
    },
    waitIfPaused: () => waitPromise || Promise.resolve(),
  };
}

function setAiBusy(root, on, label) {
  aiBusy = on;
  root.querySelectorAll('[data-ai]').forEach((b) => { b.disabled = on || !hasKey(); });
  const regen = root.querySelector('#regen-all');
  if (regen) regen.disabled = on;
  const aiAllBtn = root.querySelector('#ai-all');
  if (aiAllBtn) aiAllBtn.disabled = on || !hasKey();
  const btn = root.querySelector('[data-ai]');
  if (btn && label) btn.innerHTML = on ? `<span class="spinner" aria-hidden="true"></span> ${label}` : btn.innerHTML;
}

async function aiOne(root, id) {
  if (aiBusy) { toast('이미 쓰는 중입니다.'); return; }
  const c = CHANNELS.find((x) => x.id === id);
  const session = makeAiSession();
  aiSession = session;
  setAiBusy(root, true, '쓰는 중…');
  toast(`${c.name} 글을 AI가 쓰고 있습니다…`, 3000);
  try {
    await ensureOutline(root, { session });
    const runningMessage = `${c.name} 글을 AI가 쓰고 있습니다…`;
    showAiStatus(root, runningMessage, session);
    const text = await generateWithAI(id, aiCtx(0), { signal: session.signal, waitIfPaused: session.waitIfPaused });
    const s = getState();
    setState({
      drafts: { ...s.drafts, [id]: text },
      generated: { ...s.generated, [id]: text },
      sources: { ...s.sources, [id]: 'ai' },
      draftKey: draftKeyOf(s),
      // 방금 이 채널을 AI 로 썼다고 남긴다. 안 남기면 다음에 이 화면에 들어올 때
      // 자동 실행이 같은 채널을 또 불러 방금 만든 글을 덮어쓴다 — 돈을 두 번 쓰는 셈이다.
      aiKey: { ...s.aiKey, [id]: promptKeyOf(id, s) },
    });
    refreshPanel(root);
    refreshStale(root);
    toast(`${c.name} 글을 새로 썼습니다.`);
  } catch (e) {
    // 검수를 통과 못 했거나 호출이 실패하면 기존 글을 그대로 둔다 — 나쁜 글로 덮어쓰지 않는다
    if (e.name === 'AbortError') toast(`${c.name} 생성을 취소했습니다.`);
    else toast(`${c.name} 실패 · ${e.message}`, 5000);
    refreshPanel(root);
  } finally {
    setAiBusy(root, false);
    showAiStatus(root, '');
    aiSession = null;
  }
}

/**
 * 세 채널을 **동시에** 부른다.
 * 한 채널에 20~40초 걸려서 순서대로 돌리면 2분 가까이 기다려야 했다.
 */
async function aiAll(root) {
  if (aiBusy) return;
  const picked = getState().channels;
  const channels = CHANNELS.filter((c) => picked.includes(c.id));
  if (!channels.length) return;
  const session = makeAiSession();
  aiSession = session;
  setAiBusy(root, true);

  try {
    // 뼈대를 먼저 짠다. 세 채널이 같은 뼈대 위에서 써야 내용이 통일된다.
    const outlineError = await ensureOutline(root, { session });
    if (outlineError) toast(`주제 뼈대를 못 만들어 기본 구성으로 씁니다 — ${outlineError}`, 5000);

    const runningMessage = `AI가 ${channels.length}개 채널 글을 쓰고 있습니다… 30초쯤 걸립니다.`;
    showAiStatus(root, runningMessage, session);
    const results = await Promise.allSettled(channels.map((c) =>
      generateWithAI(c.id, aiCtx(0), { signal: session.signal, waitIfPaused: session.waitIfPaused })));

    let ok = 0;
    let cancelled = 0;
    results.forEach((r, i) => {
      const c = channels[i];
      if (r.status !== 'fulfilled') {
        // 취소는 실패가 아니다 — 실패 토스트를 따로 띄우지 않는다
        if (r.reason?.name === 'AbortError') { cancelled++; return; }
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

    /**
     * 성공하든 실패하든 **부른 채널만** 기록한다.
     * 안 그러면 실패할 때마다 자동 실행이 무한 반복된다.
     * 부르지 않은 채널까지 최신으로 찍어 두면 그 채널은 낡은 글을 든 채 영영 다시 안 쓴다.
     */
    const now = getState();
    const marked = { ...now.aiKey };
    channels.forEach((c) => { marked[c.id] = promptKeyOf(c.id, now); });
    setState({ aiKey: marked });

    refreshPanel(root);
    refreshStale(root);

    if (ok) toast(`${ok}개 채널을 AI로 새로 썼습니다.`);
    if (cancelled) toast(`${cancelled}개 채널 생성을 취소했습니다.`);
  } catch (e) {
    // 아웃라인 단계에서 취소하면 채널 호출까지 가지 않고 여기로 곧장 떨어진다
    if (e.name === 'AbortError') toast('AI 생성을 취소했습니다.');
    else toast(`AI 생성 실패 · ${e.message}`, 5000);
  } finally {
    setAiBusy(root, false);
    showAiStatus(root, '');
    aiSession = null;
  }
}

/**
 * 진행 상황 한 줄 — 30초 넘게 걸려서 아무 표시가 없으면 멈춘 줄 안다.
 * `session` 을 넘기면 일시정지·취소 버튼을 같이 그린다.
 */
function showAiStatus(root, message, session) {
  const slot = root.querySelector('#ai-status');
  if (!slot) return;
  if (!message) { slot.innerHTML = ''; return; }

  const paused = !!session?.paused;
  slot.innerHTML = `
    <div class="notice notice--info" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <div>
        <strong>${esc(paused ? '일시정지했습니다' : message)}</strong>
        ${paused ? '<p>이미 나간 요청은 그대로 진행되고, 다음 재시도만 멈춥니다.</p>' : ''}
      </div>
      ${session ? `
        <button type="button" class="btn btn--sm" id="ai-pause"
                aria-label="${paused ? 'AI 생성 이어하기' : 'AI 생성 일시정지 — 이미 나간 요청은 그대로 두고 다음 재시도만 막습니다'}">
          ${paused ? '이어하기' : '일시정지'}
        </button>
        <button type="button" class="btn btn--ghost btn--sm" id="ai-cancel"
                aria-label="AI 생성 취소하기 — 진행 중인 요청을 즉시 중단합니다">
          취소
        </button>` : ''}
    </div>`;

  root.querySelector('#ai-pause')?.addEventListener('click', () => {
    if (session.paused) session.resume(); else session.pause();
    showAiStatus(root, message, session);
  });
  root.querySelector('#ai-cancel')?.addEventListener('click', () => session.cancel());
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
  return { product: getProduct(s.productId), topic: s.topic.trim(), tone: s.tone, variant, cardCount: s.cardCount };
}

/**
 * AI 로 쓸 때 쓰는 ctx — **주제 뼈대를 함께 넘긴다.**
 * 뼈대가 없으면 `coreBlock()` 이 규칙 기반으로 떨어진다(키가 없거나 뼈대 생성 실패).
 */
function aiCtx(variant) {
  const s = getState();
  const core = s.outline?.key === outlineKeyOf(s) ? s.outline.core : null;
  return { ...ctx(variant), core };
}

/**
 * 글의 뼈대를 먼저 만든다. 세 채널과 카드뉴스 덱이 **함께** 이것을 본다.
 *
 * ⚠️ 채널마다 알아서 주제를 쪼개게 두면 셋이 다른 이야기를 한다(요청자 요구: 세 채널 통일).
 *    그래서 한 번 만들어 셋에 나눠 준다. 호출이 하나 늘지만 출력이 짧아 비용은 얼마 안 는다.
 *
 * 조건(상품·주제·톤)이 그대로면 다시 만들지 않는다 — 있는 뼈대를 또 사면 돈만 쓴다.
 *
 * `session` 을 넘기면 이 단계에서도 일시정지·취소 버튼을 보여주고, 취소 시 AbortError 를
 * 그대로 던진다(`coreWithOutline` 이 이미 그렇게 한다) — 호출한 쪽이 잡아서 처리한다.
 * @returns {Promise<string|null>} 실패 사유 (성공하면 null — 규칙 기반으로 이어서 쓴다)
 */
async function ensureOutline(root, { force = false, session } = {}) {
  const s = getState();
  const key = outlineKeyOf(s);
  if (!force && s.outline?.key === key) return null;

  showAiStatus(root, '주제를 어떻게 풀지 뼈대를 짜는 중입니다…', session);
  const { core, error } = await coreWithOutline(ctx(0), { signal: session?.signal, waitIfPaused: session?.waitIfPaused });
  // 실패해도 코어는 돌아온다(규칙 기반). 그래도 다음에 다시 시도하도록 실패는 저장하지 않는다.
  if (!error) setState({ outline: { key, core } });
  return error;
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
