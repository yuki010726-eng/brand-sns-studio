import { generateText, hasKey } from '../lib/llm.js';
import { toast } from '../components/toast.js';
import { accessToken } from '../lib/auth.js';
import { icon } from '../assets/icons.js';
import { getState, setState, navigate } from '../store.js';
import { getProduct } from '../lib/products.js';
import { typeLabel, sectionsOf, summaryOf, NAME_MAX } from '../lib/blogstyles.js';

export const title = '블로그 스타일';
let candidates = [];
let selectedCandidateUrls = new Set();
let collected = [];
let analysis = '';
let researchContextKey = '';
/** 지금 이름을 고치고 있는 스타일 id — 화면을 벗어나면 사라져도 되는 값이라 스토어에 넣지 않는다 */
let renamingId = null;

/**
 * ⚠️ **막지 않는다** (2026-08-20). 예전에는 상품·주제가 있어야 들어올 수 있었다 —
 *    단계였기 때문이다. 이제는 프로필처럼 **언제든 들어와 모아 두는 설정**이다.
 */
export function guard() { return null; }

/**
 * 추천 키워드 (2026-08-20, 요청자 요구).
 * 매번 뭘 검색할지 고민하는 게 번거롭다는 지적에서 나왔다. 4종 상품과 결이 맞는 검색어를 둔다.
 * ⚠️ **상품명 자체를 넣지 않는다** — 우리 브랜드 글이 검색되면 우리 문체를 다시 배우는 셈이다.
 */
const SUGGESTED = [
  '브랜드 어워즈', '기업 인증 대상', '소상공인 마케팅', '브랜드 신뢰도',
  '매장 홍보 방법', '기업 홍보 전략', 'TV 광고 효과',
];

const newId = () => `st_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * 저장된 목록 — 이 화면의 본체다. 수집은 이 목록을 채우는 수단이다.
 *
 * ⚠️ **A타입 · B타입으로 부른다** (2026-08-20, 요청자 지시). 이름만으로는 목록에서 무엇이
 *    무엇인지 한눈에 안 들어온다는 지적이었다. 글자는 `lib/blogstyles.js` 가 정한다 —
 *    2단계 고르기 칩과 **같은 글자**여야 고를 때 헷갈리지 않는다.
 */
function savedStylesHTML() {
  const list = getState().styles || [];
  if (!list.length) {
    return `
      <section class="card research-saved research-saved--empty">
        <h2>저장된 블로그 스타일이 없습니다</h2>
        <p class="section__desc">아래에서 글을 검색해 수집하면 A타입 · B타입으로 쌓입니다.</p>
      </section>`;
  }
  return `
    <section class="section" aria-labelledby="saved-title">
      <div class="section__head">
        <h2 id="saved-title">저장된 블로그 스타일 ${list.length}개</h2>
        <p class="section__desc">게시물을 만들 때 2단계 「아이디어 문서화」에서 골라 씁니다.</p>
      </div>
      <div class="stylelist">
        ${list.map((st, i) => styleCardHTML(st, i)).join('')}
      </div>
    </section>`;
}

/**
 * 카드 한 장.
 *
 * ⚠️ **줄을 늘리지 말 것** (2026-08-20, 요청자 지적: "UI 가 좀 더 간단해지면 좋겠다").
 *    한때 이름표 · 이름 · 요약 · 접힌 상세 · 저장일 · 삭제까지 **여섯 줄**이었다.
 *    스타일은 훑어보고 고르는 목록이지 읽는 문서가 아니다. 지금은 **두 줄**이다 —
 *    ① 이름표 + 이름 + 동작  ② 어떤 느낌인지 한 줄.
 *    저장일·출처 개수는 「자세히」 안으로 넣었다. 고를 때 쓰는 정보가 아니다.
 */
function styleCardHTML(st, i) {
  const renaming = renamingId === st.id;
  const summary = summaryOf(st.guide);
  return `
    <article class="card stylecard">
      <div class="stylecard__head">
        <span class="badge stylecard__type">${esc(typeLabel(i))}</span>
        ${renaming ? `
          <form class="stylecard__rename" data-rename-form="${st.id}">
            <label class="sr-only" for="rename-${st.id}">${esc(typeLabel(i))} 이름</label>
            <input class="input" id="rename-${st.id}" name="name" value="${esc(st.name)}"
                   maxlength="${NAME_MAX}" autocomplete="off" required />
            <button class="btn btn--sm" type="submit">저장</button>
            <button class="btn btn--text btn--sm" type="button" data-rename-cancel>취소</button>
          </form>`
        : `
          <h3 class="stylecard__name">${esc(st.name)}</h3>
          <span class="stylecard__tools">
            <button class="btn btn--text btn--sm" type="button" data-style-rename="${st.id}"
                    aria-label="${esc(st.name)} 이름 바꾸기">이름</button>
            <button class="btn btn--text btn--sm" type="button" data-style-del="${st.id}"
                    aria-label="${esc(st.name)} 스타일 삭제">삭제</button>
          </span>`}
      </div>

      <!-- 「어떤 느낌인지」는 접지 않는다. 이 한 줄을 보고 고른다 (요청자 요구 2026-08-20). -->
      <p class="stylecard__summary">${summary ? esc(summary) : '분석 요약이 없습니다.'}</p>

      <details class="stylecard__detail">
        <summary>자세히</summary>
        ${guideHTML(st.guide)}
        <p class="stylecard__meta">
          ${new Date(st.at).toLocaleDateString('ko-KR')} 저장 · ${st.sources?.length || 0}개 글에서 분석
        </p>
      </details>
    </article>`;
}

/**
 * 분석 결과를 항목별로 편다.
 * 통째로 보여 주면 일곱 항목이 한 덩어리 글이라 「어떤 느낌인지」가 안 읽힌다.
 */
function guideHTML(guide) {
  const rows = sectionsOf(guide);
  return `
    <dl class="styleguide">
      ${rows.map((sec) => `
        <div>
          <dt>${esc(sec.label)}</dt>
          <dd>${esc(sec.body) || '—'}</dd>
        </div>`).join('')}
    </dl>`;
}

export function render(root) {
  const state = getState();
  const product = getProduct(state.productId);
  const currentContextKey = `${state.productId}|${state.topic.trim()}`;
  if (researchContextKey && researchContextKey !== currentContextKey) {
    candidates = [];
    selectedCandidateUrls.clear();
    collected = [];
    analysis = '';
  }
  researchContextKey = currentContextKey;
  root.innerHTML = `
    <div class="container page research-page">
      <section class="hero">
        <h1>블로그 스타일을 모아 둡니다</h1>
        <p class="hero__sub">
          잘 쓴 블로그의 글 스타일만 뽑아 두면, 게시물을 만들 때 <strong>골라서 쓸 수 있습니다.</strong>
        </p>
      </section>

      ${savedStylesHTML()}
      <section class="card research-search" aria-labelledby="research-search-title">
        <div><h2 id="research-search-title">1. 키워드 검색</h2><p class="section__desc">네이버 블로그와 공개 카페 검색 결과에서 최대 12개를 가져옵니다.</p></div>
        <form id="research-form" class="research-search__form">
          <label class="sr-only" for="research-keyword">검색 키워드</label>
          <input class="input" id="research-keyword" autocomplete="off" placeholder="예: 병원 브랜드 마케팅"
                 value="${esc(product?.name || '')}" required minlength="2" />
          <button class="btn btn--primary" type="submit" id="research-search-button" aria-label="네이버 블로그와 카페 검색">검색</button>
        </form>
        <div class="research-suggest">
          <span class="research-suggest__label">추천 키워드</span>
          ${SUGGESTED.map((k) => `
            <button type="button" class="chip chip--sm research-suggest__chip" data-keyword="${esc(k)}"
                    aria-label="${esc(k)} 로 검색어 채우기">${esc(k)}</button>`).join('')}
        </div>
        <div class="research-direct">
          <div>
            <h3>블로그·카페 URL 직접 입력</h3>
            <p class="section__desc">한 줄에 하나씩, 최대 5개까지 입력하세요.</p>
          </div>
          <form id="research-url-form" class="research-direct__form">
            <label class="sr-only" for="research-urls">수집할 블로그 또는 카페 URL</label>
            <textarea class="textarea" id="research-urls" rows="4" autocomplete="off"
                      placeholder="https://blog.naver.com/...&#10;https://cafe.naver.com/..."></textarea>
            <button class="btn btn--primary" type="submit" id="direct-collect-button">입력한 URL 수집</button>
          </form>
        </div>
        <p class="research-status" id="research-status" role="status" aria-live="polite"></p>
      </section>
      <section class="section" id="candidate-section" hidden aria-labelledby="candidate-title">
        <div class="section__head research-section-head"><div><h2 id="candidate-title">2. 후보 글 선택</h2><p class="section__desc">스타일이 잘 드러나는 글을 1~5개 선택하세요.</p></div><button class="btn btn--primary" id="collect-button" type="button" disabled aria-label="선택한 블로그 글 수집">선택한 글 수집</button></div>
        <div class="research-results" id="candidate-list"></div>
      </section>
      <section class="section" id="collection-section" hidden aria-labelledby="collection-title">
        <div class="section__head research-section-head"><div><h2 id="collection-title">3. 수집 결과</h2><p class="section__desc">PDF는 research-output 폴더에도 보관됩니다.</p></div><div class="research-savebar">
          <label class="sr-only" for="style-name">저장할 스타일 이름</label>
          <input class="input" id="style-name" placeholder="블로그 스타일 이름 (비우면 검색어로)" autocomplete="off" maxlength="20" />
          <button class="btn btn--primary" id="analyze-button" type="button" aria-label="수집한 글 스타일 분석 후 저장">분석해서 저장</button>
        </div></div>
        <div class="research-results" id="collection-list"></div>
      </section>
      <section class="section" id="analysis-section" hidden aria-labelledby="analysis-title">
        <div class="section__head"><h2 id="analysis-title">4. 블로그 스타일 분석</h2><p class="section__desc">고유 문장을 복제하지 않고 재사용 가능한 특징만 정리한 결과입니다.</p></div>
        <article class="card research-analysis" id="analysis-result"></article>
      </section>
      <div class="research-next">
        <button class="btn btn--lg" id="research-next" type="button" aria-label="게시물 만들기로 이동">
          게시물 만들러 가기 ${icon('arrowRight', 'icon--sm')}
        </button>
      </div>
    </div>`;
  bind(root);
  if (candidates.length) showCandidates(root);
  if (collected.length) showCollected(root);
  if (analysis) showAnalysis(root, analysis);
}

function bind(root) {
  root.querySelector('#research-next').addEventListener('click', () => navigate('/'));
  root.querySelectorAll('[data-keyword]').forEach((b) => b.addEventListener('click', () => {
    const input = root.querySelector('#research-keyword');
    input.value = b.dataset.keyword;
    input.focus();
  }));
  root.querySelectorAll('[data-style-del]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.styleDel;
    const cur = getState();
    /**
     * ⚠️ 지우면 **뒤 순서가 한 칸씩 당겨진다** — C타입이 B타입이 된다.
     *    이름표는 목록 순서에서 나오는 값이라 그렇다(`lib/blogstyles.js`). 그래서 안내에
     *    이름을 함께 적는다. 「B타입을 지웠다」고만 하면 남은 B타입과 헷갈린다.
     */
    const gone = (cur.styles || []).find((x) => x.id === id);
    setState({
      styles: (cur.styles || []).filter((x) => x.id !== id),
      styleId: cur.styleId === id ? null : cur.styleId,
    });
    if (renamingId === id) renamingId = null;
    toast(`「${gone?.name || '스타일'}」을 지웠습니다.`);
    render(root);
  }));

  /* 이름 바꾸기 — 카드 안에서 바로 고친다. 목록을 벗어나지 않아야 무엇을 고치는지 안 헷갈린다. */
  root.querySelectorAll('[data-style-rename]').forEach((b) => b.addEventListener('click', () => {
    renamingId = b.dataset.styleRename;
    render(root);
    const input = root.querySelector(`#rename-${renamingId}`);
    input?.focus();
    input?.select();
  }));
  root.querySelector('[data-rename-cancel]')?.addEventListener('click', () => {
    renamingId = null;
    render(root);
  });
  root.querySelector('[data-rename-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const id = event.currentTarget.dataset.renameForm;
    const name = String(new FormData(event.currentTarget).get('name') || '').trim().slice(0, NAME_MAX);
    if (!name) { toast('이름을 입력해 주세요.'); return; }
    const cur = getState();
    setState({ styles: (cur.styles || []).map((x) => (x.id === id ? { ...x, name } : x)) });
    renamingId = null;
    toast(`이름을 「${name}」로 바꿨습니다.`);
    render(root);
  });
  root.querySelector('#research-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const keyword = root.querySelector('#research-keyword').value.trim();
    const button = root.querySelector('#research-search-button');
    setBusy(button, true, '검색 중…'); status(root, '네이버 블로그와 공개 카페에서 후보 글을 찾고 있습니다.');
    try {
      const data = await post('/api/research/search', { keyword });
      candidates = data.results || []; selectedCandidateUrls.clear(); collected = []; analysis = '';
      showCandidates(root); root.querySelector('#collection-section').hidden = true; root.querySelector('#analysis-section').hidden = true;
      status(root, `${candidates.length}개의 후보를 찾았습니다.`);
    } catch (error) { status(root, error.message, true); }
    finally { setBusy(button, false, '검색'); }
  });
  root.querySelector('#research-url-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = root.querySelector('#research-urls');
    const urls = parseUrls(input.value);
    if (!urls.length) {
      status(root, '수집할 네이버 블로그 또는 카페 URL을 입력해 주세요.', true);
      input.focus();
      return;
    }
    if (urls.length > 5) {
      status(root, 'URL은 한 번에 최대 5개까지 수집할 수 있습니다.', true);
      input.focus();
      return;
    }
    await collectUrls(root, urls, root.querySelector('#direct-collect-button'), '입력한 URL 수집');
  });
  root.querySelector('#collect-button').addEventListener('click', () => collectSelected(root));
  root.querySelector('#analyze-button').addEventListener('click', () => analyze(root));
}

function showCandidates(root) {
  const section = root.querySelector('#candidate-section'); const list = root.querySelector('#candidate-list');
  section.hidden = false;
  list.innerHTML = candidates.map((item, index) => `<label class="card research-item"><input class="sr-only research-check" type="checkbox" autocomplete="off" value="${esc(item.url)}"${selectedCandidateUrls.has(item.url) ? ' checked' : ''} /><span class="research-item__check" aria-hidden="true">✓</span><span class="research-item__body"><strong>${esc(item.title)}</strong><span>${item.type === 'cafe' ? '카페 · ' : '블로그 · '}${esc(item.author)}${item.date ? ` · ${esc(item.date)}` : ''}</span><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" data-result-link="${index}">원문 열기</a></span></label>`).join('');
  list.querySelectorAll('[data-result-link]').forEach((link) => link.addEventListener('click', (event) => event.stopPropagation()));
  list.querySelectorAll('.research-check').forEach((box) => box.addEventListener('change', () => {
    const checked = [...list.querySelectorAll('.research-check:checked')];
    if (checked.length > 5) { box.checked = false; toast('한 번에 최대 5개까지 선택할 수 있습니다.'); }
    if (box.checked) selectedCandidateUrls.add(box.value); else selectedCandidateUrls.delete(box.value);
    root.querySelector('#collect-button').disabled = selectedCandidateUrls.size === 0;
  }));
  root.querySelector('#collect-button').disabled = selectedCandidateUrls.size === 0;
}

async function collectSelected(root) {
  const candidateUrls = new Set(candidates.map((item) => item.url));
  const urls = [...selectedCandidateUrls].filter((url) => candidateUrls.has(url));
  await collectUrls(root, urls, root.querySelector('#collect-button'), '선택한 글 수집');
}

async function collectUrls(root, urls, button, idleLabel) {
  setBusy(button, true, '수집 중…'); status(root, '본문을 읽고 PDF로 저장하고 있습니다. 글마다 잠시 시간이 걸립니다.');
  try {
    const data = await post('/api/research/collect', { urls }); collected = data.items || []; analysis = '';
    showCollected(root); root.querySelector('#analysis-section').hidden = true;
    const ok = collected.filter((item) => !item.error).length; status(root, `${ok}개의 본문을 수집했습니다.`);
    if (ok && hasKey()) await analyze(root); else if (ok) toast('본문 수집 완료. OpenAI API 키를 설정한 뒤 스타일 분석을 눌러 주세요.', 6000);
  } catch (error) { status(root, error.message, true); }
  finally { setBusy(button, false, idleLabel); }
}

function parseUrls(value) {
  return [...new Set(String(value || '').split(/[\s,]+/).map((url) => url.trim()).filter(Boolean))];
}

function showCollected(root) {
  root.querySelector('#collection-section').hidden = false;
  root.querySelector('#collection-list').innerHTML = collected.map((item) => item.error
    ? `<article class="card research-item research-item--error"><div class="research-item__body"><strong>수집 실패</strong><span>${esc(item.error)}</span><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">원문 열기</a></div></article>`
    : `<article class="card research-item research-item--collected"><div class="research-item__body"><strong>${esc(item.title)}</strong><span>${esc(item.author)} · 본문 ${item.text.length.toLocaleString()}자</span><div class="research-item__links"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">원문</a>${item.pdfUrl ? `<a href="${esc(item.pdfUrl)}" target="_blank">PDF 열기</a>` : item.canMakePdf ? `<button class="btn btn--text btn--sm research-pdf" type="button" data-pdf-url="${esc(item.url)}">PDF 다운로드</button>` : `<span>PDF 실패: ${esc(item.pdfError)}</span>`}</div></div></article>`).join('');
  root.querySelector('#analyze-button').disabled = !collected.some((item) => item.text);
  root.querySelectorAll('.research-pdf').forEach((button) => button.addEventListener('click', () => downloadPdf(button)));
}

/**
 * 분석 출력 상한 — 규칙과 예문을 함께 요구하므로 예전(1,500)보다 넉넉해야 한다.
 * ⚠️ 이 값이 모자라면 마지막 항목(「피해야 할 요소」)이 잘려 나가고, `sectionsOf()` 가
 *    항목 6개만 돌려준다. 그러면 프롬프트에서 그 항목이 조용히 빠진다.
 */
const ANALYSIS_TOKENS = 2400;

/**
 * 스타일 분석 프롬프트.
 *
 * ⚠️ **감상이 아니라 「그대로 따라 쓸 수 있는 지시」를 받아야 한다** (2026-08-21).
 *    예전에는 항목 이름만 7개 던졌다. 그러면 이런 게 돌아온다 —
 *    「짧은 문장과 긴 문장을 적절히 섞어 리듬감이 있습니다」.
 *    맞는 말이지만 **글을 쓰는 모델이 따를 수 있는 게 하나도 없다.** 그래서 스타일을
 *    프롬프트에 넣어도 결과가 안 바뀌었다. 이제 숫자와 예문을 함께 요구한다.
 *
 * ⚠️ **항목 번호와 이름을 바꾸지 말 것.** `lib/blogstyles.js` 의 `SECTION_SPEC` 이
 *    이름(키워드)과 번호로 항목을 골라 호출마다 다르게 나눠 준다. 여기를 고치면 거기도 고친다.
 */
function buildAnalysisPrompt(sourceText) {
  return [
    '아래 네이버 블로그 글들에서 **글 스타일만** 분석해, 다른 글을 쓸 때 그대로 따라 쓸 수 있는',
    '한국어 문체 가이드를 작성하세요.',
    '',
    '■ 무엇을 가져오고 무엇을 버리나',
    '- 가져온다: 문장 길이 · 줄바꿈 · 어미 · 도입 방식 · 소제목 짓는 법 · 강조 방식',
    '- 버린다: 제품 · 주제 · 산업군 · 독자 · 사실 내용 · 숫자 · 고유명사',
    '- 원문의 고유 문장·비유·표현을 복사하거나 가깝게 바꾸지 마세요.',
    '  특정 작성자를 흉내 내지 말고 여러 글의 공통점을 일반화하세요.',
    '',
    '■ ⚠️ 쓰는 방식 — 여기가 가장 중요합니다',
    '**각 항목은 「그대로 따라 쓸 수 있는 지시」로 적습니다. 감상이나 평가를 적지 마세요.**',
    '  ❌ "짧은 문장과 긴 문장을 적절히 섞어 리듬감이 살아 있습니다"  ← 따라 쓸 수가 없습니다',
    '  ⭕ "한 문장 평균 35자. 45자가 넘으면 둘로 나눔. 3~4문장마다 빈 줄 하나."',
    '**셀 수 있는 것은 직접 세어서 숫자로 적습니다** — 문장 길이 · 문단 줄 수 · 소제목 개수 ·',
    '이모지 개수 · 빈 줄 간격.',
    '**각 항목 끝에 `예)` 로 짧은 한국어 예문을 하나 붙입니다.**',
    '  ⚠️ 원문에서 베끼지 말고, **같은 형태로 새로 지은 문장**을 씁니다.',
    '     내용은 아무 이야기나 좋습니다 — 보는 것은 형태뿐입니다.',
    '',
    '■ 다음 7개 항목만, 번호를 붙여 작성하세요. 8번은 작성하지 마세요.',
    '1. 한 줄 분위기 요약 — 이 문체를 한 문장으로. (여기만 예문 없이)',
    '2. 도입 방식 — 첫 두세 줄이 무엇으로 시작하는지, 몇 줄 만에 본론으로 들어가는지',
    '3. 문장 길이와 리듬 — 평균 글자 수 · 한 문단 줄 수 · 빈 줄 간격 · 줄바꿈 기준',
    '4. 소제목과 전체 구성 — 소제목 개수 · 질문형/서술형 비율 · 소제목이 이어지는 순서',
    '5. 정보와 개인 경험의 비율 — 몇 대 몇인지 · 경험은 어느 자리에 들어가는지',
    '6. 어휘·존댓말·이모지·강조 방식 — 자주 쓰는 어미 3~5개 · 이모지 개수와 자리 · 강조하는 법',
    '7. 피해야 할 요소 — 이 문체에서 쓰지 않는 표현·형식',
    '',
    sourceText,
  ].join('\n');
}

async function analyze(root) {
  const sources = collected.filter((item) => item.text); if (!sources.length) return;
  if (!hasKey()) { toast('OpenAI API 키가 없습니다. 게시물 제작 화면의 AI 설정에서 먼저 입력해 주세요.', 6000); return; }
  const button = root.querySelector('#analyze-button'); setBusy(button, true, '분석 중…'); status(root, '선택한 글에서 공통적인 글 스타일과 구성 특징을 분석하고 있습니다.');
  const sourceText = sources.map((item, i) => `[참고 글 ${i + 1}: ${item.title}]\n${item.text.slice(0, 10000)}`).join('\n\n---\n\n');
  const prompt = buildAnalysisPrompt(sourceText);
  try {
    const styleGuide = await generateText(prompt, { maxOutputTokens: ANALYSIS_TOKENS });
    const guide = styleGuide.trim();
    /**
     * ⚠️ **주제에 묶지 않는다** (2026-08-20). 예전에는 `상품|주제` 를 키로 저장해서
     *    주제가 바뀌면 스타일이 통째로 날아갔다 — 그래서 매번 다시 수집해야 했다.
     *    문체는 주제와 무관하다. **이름을 붙여 목록에 쌓고**, 쓸 때 고른다.
     */
    const cur = getState();
    const name = (root.querySelector('#style-name')?.value || '').trim()
      || `${(root.querySelector('#research-keyword')?.value || '스타일').trim().slice(0, 12)} 스타일`;
    const entry = { id: newId(), name, guide, at: Date.now(), sources: sources.map((x) => x.title) };
    setState({ styles: [entry, ...(cur.styles || [])].slice(0, 12), styleId: entry.id });
    analysis = guide;
    status(root, `「${name}」로 저장했습니다. 2단계 「아이디어 문서화」에서 골라 쓸 수 있습니다.`);
    render(root);   // 저장 목록을 다시 그린다
  }
  catch (error) { status(root, error.message, true); }
  finally { setBusy(button, false, '스타일 분석'); }
}

function showAnalysis(root, text) { root.querySelector('#analysis-section').hidden = false; root.querySelector('#analysis-result').textContent = text; root.querySelector('#analysis-section').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function downloadPdf(button) {
  setBusy(button, true, 'PDF 생성 중…');
  try {
    const token = await accessToken();
    const response = await fetch('/api/research/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ url: button.dataset.pdfUrl }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || `PDF 생성에 실패했습니다 (${response.status}).`); }
    const blobUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a'); anchor.href = blobUrl; anchor.download = 'naver-blog.pdf'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) { toast(error.message, 6000); }
  finally { setBusy(button, false, 'PDF 다운로드'); }
}
async function post(url, body) { let response; try { const token = await accessToken(); response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }); } catch { throw new Error('수집 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'); } const data = await response.json().catch(() => ({})); if (!response.ok) { if (response.status === 501) throw new Error('현재 서버는 스타일 수집 요청을 지원하지 않습니다. 로컬에서는 python -m http.server 대신 serve.cmd 또는 npm start로 실행해 주세요.'); throw new Error(data.error || `요청에 실패했습니다 (${response.status}).`); } return data; }
function status(root, message, error = false) { const node = root.querySelector('#research-status'); node.textContent = message; node.classList.toggle('is-error', error); }
function setBusy(button, busy, label) { button.disabled = busy; button.textContent = label; button.setAttribute('aria-busy', String(busy)); }
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
