/**
 * 2단계 — 아이디어 문서화
 * 선택한 상품·주제·톤으로 채널별 추천 글귀를 만들고, 그 자리에서 편집·복사한다.
 */
import { icon } from '../assets/icons.js';
import { getProduct } from '../lib/products.js';
import { CHANNELS } from '../data/channels.js';
import { BANNED_PHRASES } from '../data/banned-phrases.js';
import { stepperHTML, bindStepper } from '../components/stepper.js';
import { getState, setState, navigate, draftKeyOf } from '../store.js';
import { findBanned, TONE_LABEL, HEAD_MARK, bodyLength } from '../lib/copywriter.js';
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
          <p>AI 생성은 주제 및 채널 별 2개씩 생성할 수 있습니다. </p>
        </div>

        <!--
          어떤 조건으로 만든 글인지 항상 보이게.
          ⚠️ 「주제를 이렇게 읽었습니다」를 **별도 안내 박스로 띄우지 말 것.** 한 번 그렇게 했다가
             화면에 박스가 네 개(조건 바 · AI 벌 · 해석 · 진행 상황)로 쌓여 번잡하다는 지적을 받았다.
             해석은 주제 바로 아래 한 줄로 붙는 게 읽기도 쉽다 — 무엇을 어떻게 읽었는지가 붙어 있다.
        -->
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
            <button type="button" class="btn btn--ghost btn--sm" id="ai-channel"
                    ${channelAiDisabled(s, activeTab) ? 'disabled' : ''}
                    aria-label="${CHANNELS.find((c) => c.id === activeTab).name} 채널만 AI로 생성하기">
              ${icon('sparkles', 'icon--sm')} ${busyChannels.has(activeTab) ? '생성 중…' : '현재 채널만 AI 생성'}
            </button>
            <button type="button" class="btn btn--sm" id="ai-all"
                    aria-label="${aiAllLabel(s)}"
                    ${aiAllDisabled(s) ? 'disabled' : ''}>
              ${icon('sparkles', 'icon--sm')} 전체 채널 AI 생성
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

        <!--
          ⚠️ 키가 내장돼 있으면 AI 설정 바를 **통째로 안 그린다** (요청자 지시 2026-08-11).
             쓰는 사람이 만질 것이 하나도 없기 때문이다 — 모델은 고정돼 있고
             키는 파일에서 오므로 화면에서 바꿀 수 없다. 열어 두면 건드렸다가 헷갈리기만 한다.

             ⚠️ 「AI가 쓰고 있습니다」 안내는 여기가 아니라 toast() 와 setAiBusy() 가 낸다.
                이 바를 지워도 그대로 보인다. 지우면서 그쪽까지 건드리지 말 것.
        -->
        ${isBuiltInKey() ? '' : `<div class="aibar card" id="aibar">${aibarHTML()}</div>`}
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
    if (aiAllDisabled(getState())) { toast('지금 생성할 수 있는 채널이 없습니다.'); return; }
    if (hasEdits() && !confirm('편집한 내용이 있습니다. 계속하면 지금 보이는 화면이 새 AI 글로 바뀝니다.')) return;
    aiGenerate(root, getState().channels);
  });

  bindChannelAi(root);

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

/**
 * 글자 수 표시 — **블로그는 「본문」과 「전체」를 나눠 보여준다** (2026-08-14, 요청자 지시).
 *
 * 실측: 1,138자짜리 글에서 실제 읽을 본문은 570자(50%)였다. 나머지는 📷 이미지 자리,
 * ⤷ 캡션, 🔔 개요표, 해시태그 — **붙여넣고 나면 이미지로 바뀌거나 지워지는 줄**이다.
 * 한 숫자만 보여주면 글이 충분한지 얇은지 판단할 수가 없다.
 *
 * ⚠️ 상한(`c.limit`) 판정은 **전체 기준 그대로** 둔다. 그건 붙여넣기 전 글 전체의 안전망이다.
 * ⚠️ **블로그에서만 나눈다.** 사라지는 줄(📷·⤷)이 있는 채널이 블로그뿐이다.
 *    인스타의 해시태그는 붙여넣으면 그대로 남는 글이라 빼면 오히려 헷갈린다.
 */
function counterText(text, c) {
  const total = text.length;
  if (c.id !== 'blog') return `${total.toLocaleString()} / ${c.limit.toLocaleString()}자`;
  const body = bodyLength(text);
  return body === total
    ? `${total.toLocaleString()} / ${c.limit.toLocaleString()}자`
    : `본문 ${body.toLocaleString()}자 · 전체 ${total.toLocaleString()} / ${c.limit.toLocaleString()}자`;
}

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
          <span class="panel__hint">${c.hint}</span>
          ${s.sources[activeTab] === 'ai' ? `<span class="badge">${activeAiRunFor(s) !== null ? `AI ${activeAiRunFor(s) + 1}${josa(activeAiRunFor(s) + 1)} 씀` : 'AI가 씀'}</span>` : ''}
          ${edited ? '<span class="badge badge--neutral">편집됨</span>' : ''}
        </div>
        <div class="panel__tools">
          <output class="counter${over ? ' counter--over' : ''}" id="counter"
                  for="draft-${c.id}" aria-live="polite">
            ${counterText(text, c)}
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

      <div id="ai-status">${aiStatusHTML(c.id)}</div>

      ${readMode ? `
      <div class="preview" id="preview-${c.id}" tabindex="0" role="article"
           aria-label="${c.name} 글귀 미리보기">${previewHTML(text)}</div>
      ` : (c.id === 'blog' ? blogEditorHTML(text) : `
      <label class="sr-only" for="draft-${c.id}">${c.name} 글귀 편집</label>
      <textarea class="textarea draft" id="draft-${c.id}" data-draft="${c.id}"
                spellcheck="false" autocomplete="off"
                placeholder="위 「AI 생성」을 눌러 글귀를 만들어 주세요."
                aria-describedby="limit-${c.id}">${esc(text)}</textarea>
      `)}
      <!-- ⚠️ 안내는 **한 줄**로만. 예전엔 글자 수·저장·이미지 배포 안내가 세 줄로 쌓여
           정작 봐야 할 글보다 안내가 더 눈에 들어왔다(요청자 지적 2026-08-12). -->
      <p class="field__hint" id="limit-${c.id}">
        ${c.limitLabel} · ${readMode ? '고치려면 「고치기」' : '자동 저장됨'}
      </p>

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

function blogEditorHTML(text) {
  // 예전 초안의 네모 표시는 편집기에 들어오는 순간 올바른 마크다운 제목으로 보여 준다.
  const editableText = String(text || '').replace(/^\s*■\s+/gm, `${HEAD_MARK} `);
  return `
    <section class="blog-editor" aria-label="블로그 글 편집기">
      <div class="blog-editor__toolbar" role="toolbar" aria-label="본문 서식">
        <button type="button" data-blog-insert="heading">소제목</button>
        <button type="button" data-blog-insert="quote">인용</button>
        <button type="button" data-blog-insert="image">이미지</button>
        <button type="button" data-blog-insert="rule">구분선</button>
        <button type="button" data-blog-insert="tags">태그</button>
      </div>
      <label class="sr-only" for="draft-blog">블로그 본문 편집</label>
      <textarea class="blog-editor__body" id="draft-blog" data-draft="blog" spellcheck="true"
                placeholder="이야기를 시작해 보세요…" aria-describedby="limit-blog">${esc(editableText)}</textarea>
    </section>`;
}

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

    // 소제목. 예전에 저장한 `■ 소제목`도 계속 같은 모양으로 보여 준다.
    const headingMark = s.startsWith(`${HEAD_MARK} `) ? HEAD_MARK : (s.startsWith('■ ') ? '■' : '');
    if (headingMark) {
      flushAll();
      out.push(`<h3 class="preview__head">${esc(s.slice(headingMark.length).trim())}</h3>`);
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
  // 주제 바로 아래 한 줄. 박스를 만들지 않는다 (위 ctxbar 주석 참고)
  return `<span class="angle" title="${esc(core.intent || '')}">→ ${esc(core.angle)}</span>`;
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

/**
 * AI 생성 횟수의 지문. 생성 제한은 톤과 무관하게 상품·주제·채널별로 센다.
 * 글의 내용/아웃라인 캐시는 계속 `outlineKeyOf()`로 톤까지 구분한다.
 */
const aiRunsKeyOf = (s) => `${s.productId}|${String(s.topic || '').trim()}`;

/** 이전 버전의 `상품|주제|톤` 지문도 읽어 기존 생성 횟수가 사라지지 않게 한다. */
function matchesAiRunsKey(storedKey, s) {
  const key = aiRunsKeyOf(s);
  return storedKey === key
    || Object.keys(TONE_LABEL).some((tone) => storedKey === `${key}|${tone}`);
}

/** 지금 상품·주제 조합에서 채널별로 몇 벌까지 만들었는지 — 톤을 바꿔도 유지한다 */
function aiRunEntries(s, channelId = activeTab) {
  if (!matchesAiRunsKey(s.aiRuns?.key, s) || !Array.isArray(s.aiRuns.list)) return [];
  return s.aiRuns.list
    .map((run, index) => ({ run, index }))
    .filter(({ run }) => Object.prototype.hasOwnProperty.call(run?.drafts || {}, channelId));
}

function aiRunsFor(s, channelId = activeTab) {
  return aiRunEntries(s, channelId).map(({ run }) => run);
}

function activeAiRunFor(s, channelId = activeTab) {
  return s.activeAiRun && typeof s.activeAiRun === 'object'
    ? (s.activeAiRun[channelId] ?? null)
    : s.activeAiRun;
}

const AI_RUN_LIMIT = 2;

function aiAllDisabled(s) {
  return !hasKey()
    || busyChannels.size > 0
    || s.channels.some((id) => aiRunsFor(s, id).length >= AI_RUN_LIMIT);
}

function channelAiDisabled(s, channelId) {
  return !hasKey() || busyChannels.has(channelId) || aiRunsFor(s, channelId).length >= AI_RUN_LIMIT;
}

function aiAllLabel(s) {
  if (!hasKey()) return 'OpenAI 키가 없어 AI 생성을 쓸 수 없습니다';
  if (busyChannels.size) return '채널별 AI 생성이 진행 중이라 전체 채널 생성을 시작할 수 없습니다';
  if (s.channels.some((id) => aiRunsFor(s, id).length >= AI_RUN_LIMIT)) return 'AI 2까지 생성한 채널이 있어 전체 채널 생성을 시작할 수 없습니다';
  return '선택한 채널 중 아직 생성 가능한 모든 채널의 글을 한 번에 만들기';
}

/** AI 1 · AI 2 를 오가는 버튼 — 만든 적이 없으면(0벌) 아무것도 그리지 않는다 */
function aiRunsHTML() {
  const s = getState();
  const runs = aiRunsFor(s);
  if (!runs.length) return '';
  return `
    <div class="ai-runs" role="group" aria-label="AI가 만든 글 버전 선택">
      ${runs.map((_, i) => `
        <button type="button" class="chip" data-ai-run="${i}" aria-pressed="${activeAiRunFor(s) === i}"
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
      if (busyChannels.has(activeTab)) return;
      switchAiRun(root, Number(btn.dataset.aiRun));
    });
  });
}

/** AI 1 ↔ AI 2 화면 전환 — 각 벌의 편집 상태는 그대로 보존된다 (input 리스너가 벌마다 따로 저장한다) */
function switchAiRun(root, index) {
  const s = getState();
  const run = aiRunsFor(s)[index];
  if (!run) return;
  const id = activeTab;
  setState({
    drafts: { ...s.drafts, [id]: run.drafts[id] },
    generated: { ...s.generated, [id]: run.generated[id] },
    sources: { ...s.sources, [id]: 'ai' },
    activeAiRun: { ...(typeof s.activeAiRun === 'object' && s.activeAiRun ? s.activeAiRun : {}), [id]: index },
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
  refreshAiRuns(root);
  refreshAiControls(root);
}

function refreshAiControls(root) {
  const s = getState();
  const c = CHANNELS.find((channel) => channel.id === activeTab);
  const channelBtn = root.querySelector('#ai-channel');
  if (channelBtn && c) {
    channelBtn.disabled = channelAiDisabled(s, c.id);
    channelBtn.setAttribute('aria-label', `${c.name} 채널만 AI로 생성하기`);
    channelBtn.innerHTML = `${icon('sparkles', 'icon--sm')} ${busyChannels.has(c.id) ? '생성 중…' : '현재 채널만 AI 생성'}`;
  }
  const allBtn = root.querySelector('#ai-all');
  if (allBtn) {
    allBtn.disabled = aiAllDisabled(s);
    allBtn.setAttribute('aria-label', aiAllLabel(s));
  }
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
  bindAiStatus(root);

  if (ta) {
    autoGrow(ta);

    // 렌더할 때마다 쌓이지 않도록 이전 리스너를 먼저 걷어낸다
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = () => {
      const el = document.querySelector('[data-draft]');
      if (el) autoGrow(el);
    };
    window.addEventListener('resize', onResize);

    const draftValue = () => ta.value;

    const saveDraft = () => {
      const s = getState();
      const id = ta.dataset.draft;
      const value = draftValue();
      const patch = { drafts: { ...s.drafts, [id]: value } };
      // 지금 보고 있는 게 AI 1·AI 2 중 하나면, 그 벌에도 편집을 같이 남긴다.
      // 안 남기면 다른 벌로 갔다 돌아왔을 때 방금 고친 내용이 사라진다.
      const activeRun = activeAiRunFor(s, id);
      const entry = aiRunEntries(s, id)[activeRun];
      if (activeRun !== null && entry) {
        const list = s.aiRuns.list.map((r, i) => (i === entry.index ? { ...r, drafts: { ...r.drafts, [id]: value } } : r));
        patch.aiRuns = { ...s.aiRuns, list };
      }
      setState(patch);
      autoGrow(ta);
      updateCounter(root, { value, dataset: ta.dataset });
    };
    ta.addEventListener('input', saveDraft);

    root.querySelectorAll('[data-blog-insert]').forEach((button) => {
      button.addEventListener('click', () => {
        const snippets = {
          heading: `${HEAD_MARK} 소제목`, quote: '> 인용할 문장',
          image: '📷 [이미지] 이미지 설명\n📝 캡션을 입력하세요',
          rule: '────────', tags: '#키워드 #브랜드',
        };
        const snippet = snippets[button.dataset.blogInsert];
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = ta.value.slice(0, start);
        const after = ta.value.slice(end);
        const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
        const suffix = after && !after.startsWith('\n') ? '\n\n' : '';
        ta.value = `${before}${prefix}${snippet}${suffix}${after}`;
        const caret = before.length + prefix.length + snippet.length;
        ta.setSelectionRange(caret, caret);
        saveDraft();
        ta.focus();
      });
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

function bindChannelAi(root) {
  root.querySelector('#ai-channel')?.addEventListener('click', () => {
    const id = activeTab;
    const s = getState();
    if (!hasKey()) { toast('OpenAI 키가 없습니다. 설정에서 먼저 입력해 주세요.'); return; }
    if (channelAiDisabled(s, id)) return;
    if (s.drafts[id] !== s.generated[id]
      && !confirm('이 채널에 편집한 내용이 있습니다. 계속하면 새 AI 글로 화면이 바뀝니다.')) return;
    aiGenerate(root, [id]);
  });
}

/* ---------------- AI 생성 ---------------- */

/** 채널별 생성 상태와 세션. 서로 다른 탭의 요청이 동시에 돌아도 취소·결과가 섞이지 않는다. */
const busyChannels = new Set();
const aiSessions = new Map();

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

function setAiBusy(root, channelIds, on, session = null) {
  channelIds.forEach((id) => {
    if (on) {
      busyChannels.add(id);
      aiSessions.set(id, session);
    } else if (!session || aiSessions.get(id) === session) {
      busyChannels.delete(id);
      aiSessions.delete(id);
    }
  });
  refreshAiControls(root);
  root.querySelectorAll('[data-ai-run]').forEach((b) => { b.disabled = busyChannels.has(activeTab); });
  refreshPanel(root);
}

/**
 * 세 채널을 **동시에** 부른다.
 * 한 채널에 20~40초 걸려서 순서대로 돌리면 2분 가까이 기다려야 했다.
 *
 * ⚠️ 결과는 기존 벌을 덮어쓰지 않고 `aiRuns.list` 뒤에 **새 벌**로 쌓는다(AI 1 → AI 2).
 *    처음 뽑은 글과 비교해 보고 싶다는 요구라 한 주제당 `AI_RUN_LIMIT`(2)까지만 쌓는다.
 *    실패한 채널은 지금 화면에 보이는 값을 그대로 새 벌에 담는다 — 나쁜 글로 덮어쓰지 않는다.
 */
async function aiGenerate(root, requestedIds) {
  const s0 = getState();
  const channels = CHANNELS.filter((c) => requestedIds.includes(c.id)
    && s0.channels.includes(c.id)
    && !busyChannels.has(c.id)
    && aiRunsFor(s0, c.id).length < AI_RUN_LIMIT);
  if (!channels.length) return;
  const session = makeAiSession();
  const channelIds = channels.map((c) => c.id);
  setAiBusy(root, channelIds, true, session);

  /**
   * 이번이 몇 번째 벌인지 — AI 1 이면 0, AI 2 면 1.
   *
   * ⚠️ **이 값이 뼈대까지 내려가야 AI 2 가 AI 1 과 달라진다.** 예전에는 라운드 개념이 없어서
   *    `ensureOutline()` 이 캐시된 뼈대를 그대로 돌려줬고, 핵심 3가지·후킹·마무리가 통째로
   *    같은 채로 다시 써서 "두 번 돌려도 비슷한 글"이 나왔다(요청자 지적 2026-08-12).
   */
  const rounds = Object.fromEntries(channels.map((c) => [c.id, aiRunsFor(s0, c.id).length]));
  const round = Math.max(0, ...Object.values(rounds));

  try {
    // 뼈대를 먼저 짠다. 세 채널이 같은 뼈대 위에서 써야 내용이 통일된다.
    const { core, error: outlineError } = await ensureOutline(root, { round, session, channelIds });
    if (outlineError) {
      toast(`AI 주제 구성을 만들지 못했습니다 — ${outlineError}`, 5000);
      return;
    }
    if (session.signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const runningMessage = `AI가 ${channels.length}개 채널 글을 쓰고 있습니다… 30초쯤 걸립니다.`;
    showAiStatus(root, channelIds, runningMessage, session);
    const results = await Promise.allSettled(channels.map((c) =>
      generateWithAI(c.id, aiCtx(0, rounds[c.id], core), { signal: session.signal, waitIfPaused: session.waitIfPaused })));

    // 새 벌은 지금 화면 값에서 시작해, 성공한 채널만 AI 글로 바꾼다.
    const base = getState();
    const runDrafts = {};
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

    let runSummary = '';
    if (ok) {
      const key = aiRunsKeyOf(base);
      const prevList = matchesAiRunsKey(base.aiRuns?.key, base) ? base.aiRuns.list : [];
      const list = [...prevList, { drafts: { ...runDrafts }, generated: { ...runDrafts } }];
      runSummary = channels
        .filter((c) => runDrafts[c.id] !== undefined)
        .map((c) => `${c.name} AI ${rounds[c.id] + 1}`)
        .join(' · ');

      // 성공한 채널만 방금 이 지문으로 썼다고 남긴다 — 안 남기면 다음에 들어올 때 또 부른다.
      const marked = { ...base.aiKey };
      channels.forEach((c) => {
        if (Object.prototype.hasOwnProperty.call(runDrafts, c.id)) marked[c.id] = promptKeyOf(c.id, base);
      });

      setState({
        drafts: { ...base.drafts, ...runDrafts },
        generated: { ...base.generated, ...runDrafts },
        sources: runSources,
        draftKey: draftKeyOf(base),
        aiKey: marked,
        aiRuns: { key, list },
        activeAiRun: {
          ...(typeof base.activeAiRun === 'object' && base.activeAiRun ? base.activeAiRun : {}),
          ...Object.fromEntries(channels.filter((c) => runDrafts[c.id] !== undefined).map((c) => [c.id, rounds[c.id]])),
        },
      });
    }

    refreshPanel(root);
    refreshAiRuns(root);
    refreshAngle(root);

    if (ok) toast(`${runSummary} 글을 새로 썼습니다.`);
    if (cancelled) toast(`${cancelled}개 채널 생성을 취소했습니다.`);
  } catch (e) {
    // 아웃라인 단계에서 취소하면 채널 호출까지 가지 않고 여기로 곧장 떨어진다
    if (e.name === 'AbortError') toast('AI 생성을 취소했습니다.');
    else toast(`AI 생성 실패 · ${e.message}`, 5000);
  } finally {
    setAiBusy(root, channelIds, false, session);
    showAiStatus(root, channelIds, '');
  }
}

/**
 * 진행 상황 한 줄 — 30초 넘게 걸려서 아무 표시가 없으면 멈춘 줄 안다.
 * `session` 을 넘기면 일시정지·취소 버튼을 같이 그린다.
 */
const aiStatuses = new Map();

function aiStatusHTML(channelId) {
  const status = aiStatuses.get(channelId);
  if (!status) return '';
  const { message, session } = status;
  const paused = !!session?.paused;
  return `
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
}

function bindAiStatus(root) {
  const status = aiStatuses.get(activeTab);
  if (!status) return;
  const { message, session, channelIds } = status;
  root.querySelector('#ai-pause')?.addEventListener('click', () => {
    if (session.paused) session.resume(); else session.pause();
    showAiStatus(root, channelIds, message, session);
  });
  root.querySelector('#ai-cancel')?.addEventListener('click', () => session.cancel());
}

function showAiStatus(root, channelIds, message, session = null) {
  channelIds.forEach((id) => {
    if (message) aiStatuses.set(id, { message, session, channelIds });
    else if (!session || aiStatuses.get(id)?.session === session) aiStatuses.delete(id);
  });
  if (channelIds.includes(activeTab)) refreshPanel(root);
}

/** 카운터와 경고 문구만 갱신 — 입력 중 캐럿이 튀지 않도록 textarea 는 건드리지 않는다 */
function updateCounter(root, ta) {
  const c = CHANNELS.find((x) => x.id === ta.dataset.draft);
  const over = ta.value.length > c.limit;
  const counter = root.querySelector('#counter');
  if (counter) {
    counter.textContent = counterText(ta.value, c);
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
function aiCtx(variant, round = 0, coreOverride = null) {
  const s = getState();
  const core = coreOverride || (s.outline?.key === outlineKeyOf(s) ? s.outline.core : null);
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
 * @returns {Promise<{core:object|null,error:string|null}>}
 */
const outlineJobs = new Map();

async function ensureOutline(root, { force = false, round = 0, session, channelIds = [] } = {}) {
  const s = getState();
  const key = outlineKeyOf(s);
  /**
   * ⚠️ **지문만 보면 안 되고 라운드도 함께 봐야 한다.** AI 2 는 AI 1 과 상품·주제·톤이 같아
   *    지문이 똑같다. 지문만 비교하면 캐시된 뼈대를 그대로 돌려주고, 그러면 AI 2 가
   *    AI 1 과 같은 내용을 말한다 — 요청자가 지적한 바로 그 증상이다.
   */
  if (!force && s.outline?.key === key && (s.outline.round || 0) === round) {
    return { core: s.outline.core, error: null };
  }

  const jobKey = `${key}|r${round}`;
  if (!force && outlineJobs.has(jobKey)) return outlineJobs.get(jobKey);

  // 직전 라운드의 소제목을 넘겨 **같은 구성을 다시 짜지 못하게** 한다.
  const avoid = (s.outline?.core?.points || []).map((x) => x.q).filter(Boolean);

  showAiStatus(root, channelIds, '주제를 어떻게 풀지 뼈대를 짜는 중입니다…', session);
  const job = coreWithOutline({ ...ctx(0), round, avoid })
    .then(({ core, error }) => {
      const latest = getState();
      if (!error && (latest.outline?.key !== key || (latest.outline.round || 0) <= round)) {
        setState({ outline: { key, round, core } });
      }
      return { core: error ? null : core, error };
    })
    .finally(() => outlineJobs.delete(jobKey));
  outlineJobs.set(jobKey, job);
  return job;
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
