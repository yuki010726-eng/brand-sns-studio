/**
 * 2단계 — 아이디어 문서화
 * 선택한 상품·주제·톤으로 채널별 추천 글귀를 만들고, 그 자리에서 편집·복사한다.
 */
import { icon } from '../assets/icons.js';
import { CHANNELS, BANNED_PHRASES, getProduct } from '../data/products.js';
import { stepperHTML, bindStepper } from '../components/stepper.js';
import { getState, setState, navigate, draftKeyOf } from '../store.js';
import { findBanned, TONE_LABEL, IMAGE_PLAN, HEAD_MARK } from '../lib/copywriter.js';
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

/**
 * 읽기 모드 — 편집칸 대신 **게시될 모양 그대로** 보여 준다.
 *
 * 요청자 지적: "단락이 다 나뉘어 있어서 무슨 말인지 모르겠다. 물어보는 과정을 줄이려고 만든 건데
 * 일만 늘었다." 편집 상자에 날글자로 깔리면 글의 구조가 안 보인다. 기본값을 읽기 모드로 두고,
 * 고칠 때만 편집으로 넘어가게 한다.
 *
 * ⚠️ 화면 상태라 스토어에 넣지 않는다. 넣으면 기기 간 동기화까지 따라간다(보관함 필터와 같은 이유).
 */
let readMode = true;

export function render(root) {
  let s = getState();

  // 2단계에서 조건을 바꿨다면 이전 조건으로 만든 글을 3단계에 가져오지 않는다.
  // 같은 조건으로 다시 들어올 때만 작성·편집 중인 내용을 그대로 이어 간다.
  const currentDraftKey = draftKeyOf(s);
  const hasPreviousContent = Object.keys(s.drafts).length > 0
    || Object.keys(s.generated).length > 0;
  if (hasPreviousContent && s.draftKey !== currentDraftKey) {
    setState({
      drafts: {},
      generated: {},
      variants: {},
      sources: {},
      draftKey: currentDraftKey,
      activeAiRun: null,
    });
    s = getState();
  }

  const p = getProduct(s.productId);
  const channels = CHANNELS.filter((c) => s.channels.includes(c.id));
  const hasAnyDraft = channels.some((c) => s.drafts[c.id]);

  if (!activeTab || !channels.some((c) => c.id === activeTab)) activeTab = channels[0].id;

  root.innerHTML = `
    <div class="container">
      ${stepperHTML('/copy')}

      <section class="section">
        <div class="section__head">
          <h1>${hasAnyDraft ? '추천 글귀가 준비됐습니다' : '아래 조건으로 글귀를 만들어 보세요'}</h1>
          <p class="section__desc">${hasAnyDraft
            ? '그대로 써도 되고, 바로 고쳐 써도 됩니다. 복사 버튼을 누르면 클립보드에 담깁니다.'
            : '「AI 생성」은 한 주제당 2번까지 AI 1 · AI 2 로 만들어 오가며 볼 수 있습니다.'}</p>
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
            <button type="button" class="btn btn--sm" id="ai-all"
                    aria-label="${aiAllLabel(s)}"
                    ${aiAllDisabled(s) ? 'disabled' : ''}>
              ${icon('sparkles', 'icon--sm')} AI 생성
            </button>
          </div>
        </div>

        <!--
          「AI 생성」을 누를 때마다 결과가 AI 1 · AI 2 로 쌓인다 (요청자 지시 2026-08-11).
          예전엔 누를 때마다 이전 AI 글을 덮어썼는데, 처음 뽑은 글과 비교해 보고 싶다는
          요구가 있어 두 벌까지 남기고 오가며 볼 수 있게 했다. 한 주제당 2번으로 막는다 —
          더 늘리면 다시 예전처럼 "그래서 뭘 눌러야 하나" 가 된다.
        -->
        <div id="ai-runs-slot">${aiRunsHTML()}</div>
        <div id="angle-slot">${angleHTML()}</div>

        <!--
          ⚠️ 키가 내장돼 있으면 AI 설정 바를 **통째로 안 그린다** (요청자 지시 2026-08-11).
             쓰는 사람이 만질 것이 하나도 없기 때문이다 — 모델은 고정돼 있고
             키는 파일에서 오므로 화면에서 바꿀 수 없다. 열어 두면 건드렸다가 헷갈리기만 한다.

             ⚠️ 「AI가 쓰고 있습니다」 안내는 여기가 아니라 toast() 와 setAiBusy() 가 낸다.
                이 바를 지워도 그대로 보인다. 지우면서 그쪽까지 건드리지 말 것.
        -->
        ${isBuiltInKey() ? '' : `<div class="aibar card" id="aibar">${aibarHTML()}</div>`}
        <div id="ai-status"></div>

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
   * 3단계에 들어와도 아무것도 자동으로 만들지 않는다 (요청자 지시 2026-08-11).
   * 대신 ctxbar 에 2단계에서 고른 상품·주제·톤을 미리보기로 보여주고,
   * 「AI 생성」을 직접 눌러야 그때 글이 채워진다.
   */

  root.querySelector('#ai-all')?.addEventListener('click', () => {
    if (!hasKey()) { toast('OpenAI 키가 없습니다. 설정에서 먼저 입력해 주세요.'); return; }
    if (aiAllDisabled(getState())) { toast('이 주제로는 AI 글을 이미 2번 만들었습니다.'); return; }
    if (hasEdits() && !confirm('편집한 내용이 있습니다. 계속하면 지금 보이는 화면이 새 AI 글로 바뀝니다.')) return;
    aiAll(root);
  });

  bindAiRuns(root);

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
  const aiAllBtn = root.querySelector('#ai-all');
  if (aiAllBtn) {
    aiAllBtn.disabled = aiAllDisabled(getState());
    aiAllBtn.setAttribute('aria-label', aiAllLabel(getState()));
  }
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
          ${s.sources[activeTab] === 'ai' ? `<span class="badge">${s.activeAiRun !== null ? `AI ${s.activeAiRun + 1}${josa(s.activeAiRun + 1)} 씀` : 'AI가 씀'}</span>` : ''}
          ${edited ? '<span class="badge badge--neutral">편집됨</span>' : ''}
        </div>
        <div class="panel__tools">
          <output class="counter${over ? ' counter--over' : ''}" id="counter"
                  for="draft-${c.id}" aria-live="polite">
            ${text.length.toLocaleString()} / ${c.limit.toLocaleString()}자
          </output>
          <button type="button" class="btn btn--ghost btn--sm" id="view-toggle"
                  aria-pressed="${readMode}"
                  aria-label="${readMode ? '글을 직접 고치기' : '게시될 모양으로 보기'}">
            ${icon(readMode ? 'edit' : 'eye', 'icon--sm')} ${readMode ? '고치기' : '읽기 모드'}
          </button>
          <button type="button" class="btn btn--sm" data-copy="${c.id}"
                  aria-label="${c.name} 글귀 복사하기">
            ${icon('copy', 'icon--sm')} 복사
          </button>
        </div>
      </div>

      ${readMode ? `
      <div class="preview" id="preview-${c.id}" tabindex="0" role="article"
           aria-label="${c.name} 글귀 미리보기">${previewHTML(text)}</div>
      <p class="field__hint" id="limit-${c.id}">${c.limitLabel} · 고치려면 「고치기」를 누르세요.</p>
      ` : `
      <label class="sr-only" for="draft-${c.id}">${c.name} 글귀 편집</label>
      <textarea class="textarea draft" id="draft-${c.id}" data-draft="${c.id}"
                spellcheck="false" autocomplete="off"
                placeholder="위 「AI 생성」을 눌러 글귀를 만들어 주세요."
                aria-describedby="limit-${c.id}">${esc(text)}</textarea>
      <p class="field__hint" id="limit-${c.id}">${c.limitLabel} · 내용은 자동 저장됩니다.</p>
      `}
      <p class="field__hint">🖼 ${esc(IMAGE_PLAN[c.id] || '')} 카드는 3단계에서 한 벌만 만들어 세 채널에 나눠 씁니다.</p>

      <div id="warn-slot">${warnHTML(banned, over, c)}</div>
    </div>`;
}

/* ---------------- 읽기 모드 렌더 ---------------- */

/**
 * 글귀를 **게시될 모양**으로 그린다.
 *
 * 글 자체는 순수 텍스트다(마크다운을 쓰지 않는다 — `lib/copywriter.js` 의 `HEAD_MARK` 참고).
 * 여기서는 그 텍스트를 화면에서만 읽기 좋게 입힌다. **원문은 절대 바꾸지 않는다** —
 * 복사되는 것은 언제나 `drafts` 에 든 원문이다.
 *
 * ⚠️ 여기에 서식 문법을 새로 만들지 말 것. 화면에서만 보이는 규칙을 늘리면
 *    붙여넣은 결과와 미리보기가 어긋난다. 이미 글에 들어 있는 표시만 해석한다.
 */
const SLOT_LINE = /^\s*📷\s*\[(이미지[^\]]*)\]\s*(.*)$/;

function previewHTML(text) {
  const raw = String(text || '').trim();
  if (!raw) return '<p class="preview__empty">위 「AI 생성」을 눌러 글귀를 만들어 주세요.</p>';

  const lines = raw.split('\n');
  const out = [];
  let para = [];      // 이어지는 본문 줄
  let quote = [];     // '> ' 인용 줄
  let facts = [];     // '🔔 ' 개요표 줄

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p>${para.map(esc).join('<br>')}</p>`);
    para = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    out.push(`<blockquote class="preview__quote">${quote.map(esc).join('<br>')}</blockquote>`);
    quote = [];
  };
  const flushFacts = () => {
    if (!facts.length) return;
    out.push(`<div class="preview__facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</div>`);
    facts = [];
  };
  const flushAll = () => { flushPara(); flushQuote(); flushFacts(); };

  lines.forEach((line, i) => {
    const s = line.trim();
    if (!s) { flushAll(); return; }

    // 구분선
    if (/^─{2,}$/.test(s)) { flushAll(); out.push('<hr class="preview__rule">'); return; }

    // 소제목
    if (s.startsWith(`${HEAD_MARK} `)) {
      flushAll();
      out.push(`<h3 class="preview__head">${esc(s.slice(HEAD_MARK.length).trim())}</h3>`);
      return;
    }

    // 카드뉴스 이미지 자리 + 바로 아래 캡션(⤷)을 한 덩어리로 묶는다
    const slot = s.match(SLOT_LINE);
    if (slot) {
      flushAll();
      const next = (lines[i + 1] || '').trim();
      const caption = next.startsWith('⤷') ? next.replace(/^⤷\s*/, '') : '';
      out.push(`<div class="preview__slot"><span class="badge">${esc(slot[1])}</span>${
        caption ? `<span class="preview__caption">${esc(caption)}</span>` : ''}</div>`);
      return;
    }
    if (s.startsWith('⤷')) return;   // 위에서 이미 묶었다

    // 개요표
    if (s.startsWith('🔔')) { flushPara(); flushQuote(); facts.push(s.replace(/^🔔\s*/, '')); return; }

    // 요약 인용
    if (s.startsWith('> ')) { flushPara(); flushFacts(); quote.push(s.slice(2)); return; }

    // 해시태그 줄 (샵으로만 이뤄진 줄)
    if (/^#[^\s#]/.test(s) && !/[.!?]$/.test(s)) {
      flushAll();
      out.push(`<p class="preview__tags">${s.split(/\s+/).filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join('')}</p>`);
      return;
    }

    // 인스타 캡션의 '.' 세 줄 — 해시태그를 밀어내는 여백이라 화면에서는 접는다
    if (s === '.') { flushAll(); return; }

    flushQuote();
    flushFacts();
    para.push(s);
  });

  flushAll();
  return out.join('');
}

/**
 * AI 가 주제를 어떻게 읽었는지 보여 준다.
 *
 * ⚠️ **해석을 감추면 안 된다.** 주제를 글자 그대로 따르지 않게 바꿨으므로(요청자 요구),
 *    왜 이런 글이 나왔는지 알 수 있어야 한다. 해석이 빗나갔으면 주제를 고쳐 다시 돌리면 된다.
 */
function angleHTML() {
  const s = getState();
  const core = s.outline?.key === outlineKeyOf(s) ? s.outline.core : null;
  if (!core?.angle) return '';
  return `
    <div class="notice notice--info angle" role="status">
      <span class="notice__icon" aria-hidden="true">${icon('sparkles', 'icon--sm')}</span>
      <div>
        <strong>주제를 이렇게 읽었습니다</strong>
        <p class="angle__line">${esc(core.angle)}</p>
        ${core.intent ? `<p class="field__hint">알고 싶은 것 · ${esc(core.intent)}</p>` : ''}
      </div>
    </div>`;
}

function refreshAngle(root) {
  const slot = root.querySelector('#angle-slot');
  if (slot) slot.innerHTML = angleHTML();
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

/* ---------------- AI 결과 버전 (AI 1 · AI 2) ---------------- */

/** 지금 상품·주제·톤 조합에서 몇 벌까지 만들었는지 — 주제가 바뀌면 다시 0부터 센다 */
function aiRunsFor(s) {
  const key = outlineKeyOf(s);
  return s.aiRuns?.key === key ? s.aiRuns.list : [];
}

const AI_RUN_LIMIT = 2;

function aiAllDisabled(s) {
  return !hasKey() || aiRunsFor(s).length >= AI_RUN_LIMIT;
}

function aiAllLabel(s) {
  if (!hasKey()) return 'OpenAI 키가 없어 AI 생성을 쓸 수 없습니다';
  if (aiRunsFor(s).length >= AI_RUN_LIMIT) return '이 주제로는 AI 글을 이미 2번 만들었습니다';
  return '2단계에서 고른 상품·주제·톤으로 AI가 세 채널 글을 쓰게 하기';
}

/** AI 1 · AI 2 를 오가는 버튼 — 만든 적이 없으면(0벌) 아무것도 그리지 않는다 */
function aiRunsHTML() {
  const s = getState();
  const runs = aiRunsFor(s);
  if (!runs.length) return '';
  return `
    <div class="ai-runs" role="group" aria-label="AI가 만든 글 버전 선택">
      ${runs.map((_, i) => `
        <button type="button" class="chip" data-ai-run="${i}" aria-pressed="${s.activeAiRun === i}"
                aria-label="AI가 ${i + 1}번째로 쓴 글 보기">
          AI ${i + 1}
        </button>`).join('')}
      ${runs.length >= AI_RUN_LIMIT ? '' : ''}
    </div>`;
}

function refreshAiRuns(root) {
  const slot = root.querySelector('#ai-runs-slot');
  if (!slot) return;
  slot.innerHTML = aiRunsHTML();
  bindAiRuns(root);
}

function bindAiRuns(root) {
  root.querySelectorAll('[data-ai-run]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (aiBusy) return;
      switchAiRun(root, Number(btn.dataset.aiRun));
    });
  });
}

/** AI 1 ↔ AI 2 화면 전환 — 각 벌의 편집 상태는 그대로 보존된다 (input 리스너가 벌마다 따로 저장한다) */
function switchAiRun(root, index) {
  const s = getState();
  const run = aiRunsFor(s)[index];
  if (!run) return;
  const sources = {};
  Object.keys(run.drafts).forEach((id) => { sources[id] = 'ai'; });
  setState({
    drafts: { ...run.drafts },
    generated: { ...run.generated },
    sources: { ...s.sources, ...sources },
    activeAiRun: index,
  });
  refreshPanel(root);
  refreshAiRuns(root);
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

/** 창 크기가 바뀌면 줄바꿈이 달라지므로 높이를 다시 잰다 */
let onResize = null;

function bindPanel(root) {
  /**
   * ⚠️ 편집칸이 없어도(읽기 모드) **아래 버튼들은 반드시 묶어야 한다.**
   *    예전 구조는 여기서 바로 return 했다 — 그대로 뒀으면 읽기 모드에서 복사가 죽는다.
   */
  const ta = root.querySelector('[data-draft]');

  if (ta) {
    autoGrow(ta);

    // 렌더할 때마다 쌓이지 않도록 이전 리스너를 먼저 걷어낸다
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = () => {
      const el = document.querySelector('[data-draft]');
      if (el) autoGrow(el);
    };
    window.addEventListener('resize', onResize);

    ta.addEventListener('input', () => {
      const s = getState();
      const id = ta.dataset.draft;
      const patch = { drafts: { ...s.drafts, [id]: ta.value } };
      // 지금 보고 있는 게 AI 1·AI 2 중 하나면, 그 벌에도 편집을 같이 남긴다.
      // 안 남기면 다른 벌로 갔다 돌아왔을 때 방금 고친 내용이 사라진다.
      const runs = aiRunsFor(s);
      if (s.activeAiRun !== null && runs[s.activeAiRun]) {
        const list = runs.map((r, i) => (i === s.activeAiRun ? { ...r, drafts: { ...r.drafts, [id]: ta.value } } : r));
        patch.aiRuns = { ...s.aiRuns, list };
      }
      setState(patch);
      autoGrow(ta);
      updateCounter(root, ta);
    });
  }

  root.querySelector('#view-toggle')?.addEventListener('click', () => {
    readMode = !readMode;
    refreshPanel(root);
    // 고치기로 넘어왔으면 바로 쓸 수 있게 커서를 넣어 준다
    if (!readMode) root.querySelector('[data-draft]')?.focus();
  });

  root.querySelector('[data-copy]')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.copy;
    copyText(getState().drafts[id] || '', `${CHANNELS.find((c) => c.id === id).name} 글귀를 복사했습니다.`);
  });
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

function setAiBusy(root, on) {
  aiBusy = on;
  const aiAllBtn = root.querySelector('#ai-all');
  if (aiAllBtn) {
    aiAllBtn.disabled = on || aiAllDisabled(getState());
    if (!on) aiAllBtn.setAttribute('aria-label', aiAllLabel(getState()));
  }
  root.querySelectorAll('[data-ai-run]').forEach((b) => { b.disabled = on; });
}

/**
 * 세 채널을 **동시에** 부른다.
 * 한 채널에 20~40초 걸려서 순서대로 돌리면 2분 가까이 기다려야 했다.
 *
 * ⚠️ 결과는 기존 벌을 덮어쓰지 않고 `aiRuns.list` 뒤에 **새 벌**로 쌓는다(AI 1 → AI 2).
 *    처음 뽑은 글과 비교해 보고 싶다는 요구라 한 주제당 `AI_RUN_LIMIT`(2)까지만 쌓는다.
 *    실패한 채널은 지금 화면에 보이는 값을 그대로 새 벌에 담는다 — 나쁜 글로 덮어쓰지 않는다.
 */
async function aiAll(root) {
  if (aiBusy) return;
  const s0 = getState();
  if (aiAllDisabled(s0)) return;
  const picked = s0.channels;
  const channels = CHANNELS.filter((c) => picked.includes(c.id));
  if (!channels.length) return;
  const session = makeAiSession();
  aiSession = session;
  setAiBusy(root, true);

  /**
   * 이번이 몇 번째 벌인지 — AI 1 이면 0, AI 2 면 1.
   *
   * ⚠️ **이 값이 뼈대까지 내려가야 AI 2 가 AI 1 과 달라진다.** 예전에는 라운드 개념이 없어서
   *    `ensureOutline()` 이 캐시된 뼈대를 그대로 돌려줬고, 핵심 3가지·후킹·마무리가 통째로
   *    같은 채로 다시 써서 "두 번 돌려도 비슷한 글"이 나왔다(요청자 지적 2026-08-12).
   */
  const round = aiRunsFor(s0).length;

  try {
    // 뼈대를 먼저 짠다. 세 채널이 같은 뼈대 위에서 써야 내용이 통일된다.
    const outlineError = await ensureOutline(root, { round, session });
    if (outlineError) {
      toast(`AI 주제 구성을 만들지 못했습니다 — ${outlineError}`, 5000);
      return;
    }

    const runningMessage = `AI가 ${channels.length}개 채널 글을 쓰고 있습니다… 30초쯤 걸립니다.`;
    showAiStatus(root, runningMessage, session);
    const results = await Promise.allSettled(channels.map((c) =>
      generateWithAI(c.id, aiCtx(0, round), { signal: session.signal, waitIfPaused: session.waitIfPaused })));

    // 새 벌은 지금 화면 값에서 시작해, 성공한 채널만 AI 글로 바꾼다.
    const base = getState();
    const runDrafts = { ...base.drafts };
    const runSources = { ...base.sources };
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
      runDrafts[c.id] = r.value;
      runSources[c.id] = 'ai';
      ok++;
    });

    let runNo = 0;
    if (ok) {
      const key = outlineKeyOf(base);
      const prevList = base.aiRuns?.key === key ? base.aiRuns.list : [];
      const list = [...prevList, { drafts: { ...runDrafts }, generated: { ...runDrafts } }];
      runNo = list.length;

      // 성공한 채널만 방금 이 지문으로 썼다고 남긴다 — 안 남기면 다음에 들어올 때 또 부른다.
      const marked = { ...base.aiKey };
      channels.forEach((c) => { if (runSources[c.id] === 'ai') marked[c.id] = promptKeyOf(c.id, base); });

      setState({
        drafts: runDrafts,
        generated: { ...runDrafts },
        sources: runSources,
        draftKey: draftKeyOf(base),
        aiKey: marked,
        aiRuns: { key, list },
        activeAiRun: list.length - 1,
      });
    }

    refreshPanel(root);
    refreshAiRuns(root);
    refreshAngle(root);

    if (ok) toast(`AI ${runNo} — ${ok}개 채널 글을 새로 썼습니다.`);
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
 * AI로 만든 뼈대가 있을 때만 채널 글을 생성한다.
 */
function aiCtx(variant, round = 0) {
  const s = getState();
  const core = s.outline?.key === outlineKeyOf(s) ? s.outline.core : null;
  // round 는 채널 프롬프트의 '진입 방식'을 바꾼다 (lib/copyai.js 의 ROUND_OPENING)
  return { ...ctx(variant), core, round };
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
 * @returns {Promise<string|null>} 실패 사유 (성공하면 null)
 */
async function ensureOutline(root, { force = false, round = 0, session } = {}) {
  const s = getState();
  const key = outlineKeyOf(s);
  /**
   * ⚠️ **지문만 보면 안 되고 라운드도 함께 봐야 한다.** AI 2 는 AI 1 과 상품·주제·톤이 같아
   *    지문이 똑같다. 지문만 비교하면 캐시된 뼈대를 그대로 돌려주고, 그러면 AI 2 가
   *    AI 1 과 같은 내용을 말한다 — 요청자가 지적한 바로 그 증상이다.
   */
  if (!force && s.outline?.key === key && (s.outline.round || 0) === round) return null;

  // 직전 라운드의 소제목을 넘겨 **같은 구성을 다시 짜지 못하게** 한다.
  const avoid = (s.outline?.core?.points || []).map((x) => x.q).filter(Boolean);

  showAiStatus(root, '주제를 어떻게 풀지 뼈대를 짜는 중입니다…', session);
  const { core, error } = await coreWithOutline(
    { ...ctx(0), round, avoid },
    { signal: session?.signal, waitIfPaused: session?.waitIfPaused },
  );
  if (!error) setState({ outline: { key, round, core } });
  return error;
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

/** "AI 1이" · "AI 2가" — 숫자를 읽을 때 받침 유무에 따라 이/가가 갈린다. AI_RUN_LIMIT 범위(1~10)만 다룬다 */
const NO_BATCHIM = new Set([2, 4, 5, 9]); // 이·사·오·구 — 받침 없이 끝난다
const josa = (n) => (NO_BATCHIM.has(n) ? '가' : '이');

const esc = (str = '') =>
  str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
