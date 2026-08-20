import { generateText, hasKey } from '../lib/llm.js';
import { toast } from '../components/toast.js';
import { accessToken } from '../lib/auth.js';
import { icon } from '../assets/icons.js';
import { getState, setState, navigate } from '../store.js';
import { getProduct } from '../lib/products.js';

export const title = '블로그 스타일 연구';
let candidates = [];
let selectedCandidateUrls = new Set();
let collected = [];
let analysis = '';
let researchContextKey = '';

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

/** 저장된 스타일 목록 — 이 화면의 본체다. 수집은 이 목록을 채우는 수단이다. */
function savedStylesHTML() {
  const list = getState().styles || [];
  if (!list.length) {
    return `
      <section class="card research-saved research-saved--empty">
        <h2>저장된 스타일이 없습니다</h2>
        <p class="section__desc">아래에서 글을 검색해 수집하면 문체 스타일로 저장할 수 있습니다.</p>
      </section>`;
  }
  return `
    <section class="section" aria-labelledby="saved-title">
      <div class="section__head">
        <h2 id="saved-title">저장된 스타일 ${list.length}개</h2>
        <p class="section__desc">게시물을 만들 때 2단계에서 골라 씁니다.</p>
      </div>
      <div class="research-results">
        ${list.map((st) => `
          <article class="card research-item research-item--collected">
            <div class="research-item__body">
              <strong>${esc(st.name)}</strong>
              <span>${new Date(st.at).toLocaleDateString('ko-KR')} · ${st.sources?.length || 0}개 글에서 분석</span>
              <p class="research-saved__peek">${esc(String(st.guide).replace(/\s+/g, ' ').slice(0, 90))}…</p>
              <div class="research-item__links">
                <button class="btn btn--text btn--sm" type="button" data-style-del="${st.id}"
                        aria-label="${esc(st.name)} 스타일 삭제">삭제</button>
              </div>
            </div>
          </article>`).join('')}
      </div>
    </section>`;
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
        <h1>문체 스타일을 모아 둡니다</h1>
        <p class="hero__sub">
          잘 쓴 블로그를 찾아 문체만 뽑아 저장해 두면, 게시물을 만들 때 <strong>골라서 쓸 수 있습니다.</strong>
          게시물마다 다시 수집하지 않아도 됩니다.
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
          <input class="input" id="style-name" placeholder="스타일 이름 (비우면 검색어로)" autocomplete="off" maxlength="20" />
          <button class="btn btn--primary" id="analyze-button" type="button" aria-label="수집한 글 스타일 분석 후 저장">분석해서 저장</button>
        </div></div>
        <div class="research-results" id="collection-list"></div>
      </section>
      <section class="section" id="analysis-section" hidden aria-labelledby="analysis-title">
        <div class="section__head"><h2 id="analysis-title">4. 스타일 분석</h2><p class="section__desc">고유 문장을 복제하지 않고 재사용 가능한 특징만 정리한 결과입니다.</p></div>
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
    setState({
      styles: (cur.styles || []).filter((x) => x.id !== id),
      styleId: cur.styleId === id ? null : cur.styleId,
    });
    toast('스타일을 지웠습니다.');
    render(root);
  }));
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

async function analyze(root) {
  const sources = collected.filter((item) => item.text); if (!sources.length) return;
  if (!hasKey()) { toast('OpenAI API 키가 없습니다. 게시물 제작 화면의 AI 설정에서 먼저 입력해 주세요.', 6000); return; }
  const button = root.querySelector('#analyze-button'); setBusy(button, true, '분석 중…'); status(root, '선택한 글에서 공통적인 문체와 구성 특징을 분석하고 있습니다.');
  const state = getState();
  const product = getProduct(state.productId);
  const fixedTopic = String(state.topic || '').trim();
  const sourceText = sources.map((item, i) => `[참고 글 ${i + 1}: ${item.title}]\n${item.text.slice(0, 10000)}`).join('\n\n---\n\n');
  const prompt = `아래 네이버 블로그 글들에서 **글 스타일만** 분석해 재사용 가능한 한국어 문체 가이드를 작성하세요.\n\n참고 글의 제품, 주제, 산업군, 독자, 사실 내용은 절대 가져오지 마세요. 문체·리듬·구성·가독성만 분석합니다.\n원문의 고유 문장·비유·표현을 복사하거나 가깝게 바꾸지 마세요. 특정 작성자를 흉내 내지 말고 여러 특징을 일반화하세요.\n\n다음 7개 항목만 작성하세요. 8번 프롬프트는 작성하지 마세요.\n1. 한 줄 분위기 요약\n2. 도입 방식\n3. 문장 길이와 리듬\n4. 소제목과 전체 구성\n5. 정보와 개인 경험의 비율\n6. 어휘·존댓말·이모지·강조 방식\n7. 피해야 할 요소\n\n${sourceText}`;
  try {
    const styleGuide = await generateText(prompt, { maxOutputTokens: 1500 });
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
    status(root, `「${name}」로 저장했습니다. 2단계에서 골라 쓸 수 있습니다.`);
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
