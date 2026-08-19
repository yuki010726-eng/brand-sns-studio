import { generateText, hasKey } from '../lib/llm.js';
import { toast } from '../components/toast.js';

export const title = '블로그 스타일 연구';
let candidates = [];
let collected = [];
let analysis = '';

export function render(root) {
  root.innerHTML = `
    <div class="container page research-page">
      <section class="hero">
        <h1>검색한 글의 스타일을 분석합니다</h1>
        <p class="hero__sub">후보를 직접 고르면 본문과 PDF를 수집하고, 원문을 베끼지 않는 문체 가이드로 정리합니다.</p>
      </section>
      <section class="card research-search" aria-labelledby="research-search-title">
        <div><h2 id="research-search-title">1. 키워드 검색</h2><p class="section__desc">네이버 블로그 검색 결과에서 최대 12개를 가져옵니다.</p></div>
        <form id="research-form" class="research-search__form">
          <label class="sr-only" for="research-keyword">검색 키워드</label>
          <input class="input" id="research-keyword" autocomplete="off" placeholder="예: 병원 브랜드 마케팅" required minlength="2" />
          <button class="btn btn--primary" type="submit" id="research-search-button" aria-label="네이버 블로그 검색">검색</button>
        </form>
        <p class="research-status" id="research-status" role="status" aria-live="polite"></p>
      </section>
      <section class="section" id="candidate-section" hidden aria-labelledby="candidate-title">
        <div class="section__head research-section-head"><div><h2 id="candidate-title">2. 후보 글 선택</h2><p class="section__desc">스타일이 잘 드러나는 글을 1~5개 선택하세요.</p></div><button class="btn btn--primary" id="collect-button" type="button" disabled aria-label="선택한 블로그 글 수집">선택한 글 수집</button></div>
        <div class="research-results" id="candidate-list"></div>
      </section>
      <section class="section" id="collection-section" hidden aria-labelledby="collection-title">
        <div class="section__head research-section-head"><div><h2 id="collection-title">3. 수집 결과</h2><p class="section__desc">PDF는 research-output 폴더에도 보관됩니다.</p></div><button class="btn btn--primary" id="analyze-button" type="button" aria-label="수집한 글 스타일 분석">스타일 분석</button></div>
        <div class="research-results" id="collection-list"></div>
      </section>
      <section class="section" id="analysis-section" hidden aria-labelledby="analysis-title">
        <div class="section__head"><h2 id="analysis-title">4. 스타일 분석</h2><p class="section__desc">고유 문장을 복제하지 않고 재사용 가능한 특징만 정리한 결과입니다.</p></div>
        <article class="card research-analysis" id="analysis-result"></article>
      </section>
    </div>`;
  bind(root);
  if (candidates.length) showCandidates(root);
  if (collected.length) showCollected(root);
  if (analysis) showAnalysis(root, analysis);
}

function bind(root) {
  root.querySelector('#research-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const keyword = root.querySelector('#research-keyword').value.trim();
    const button = root.querySelector('#research-search-button');
    setBusy(button, true, '검색 중…'); status(root, '네이버 블로그에서 후보 글을 찾고 있습니다.');
    try {
      const data = await post('/api/research/search', { keyword });
      candidates = data.results || []; collected = []; analysis = '';
      showCandidates(root); root.querySelector('#collection-section').hidden = true; root.querySelector('#analysis-section').hidden = true;
      status(root, `${candidates.length}개의 후보를 찾았습니다.`);
    } catch (error) { status(root, error.message, true); }
    finally { setBusy(button, false, '검색'); }
  });
  root.querySelector('#collect-button').addEventListener('click', () => collectSelected(root));
  root.querySelector('#analyze-button').addEventListener('click', () => analyze(root));
}

function showCandidates(root) {
  const section = root.querySelector('#candidate-section'); const list = root.querySelector('#candidate-list');
  section.hidden = false;
  list.innerHTML = candidates.map((item, index) => `<label class="card research-item"><input class="sr-only research-check" type="checkbox" autocomplete="off" value="${esc(item.url)}" /><span class="research-item__check" aria-hidden="true">✓</span><span class="research-item__body"><strong>${esc(item.title)}</strong><span>${esc(item.author)}${item.date ? ` · ${esc(item.date)}` : ''}</span><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" data-result-link="${index}">원문 열기</a></span></label>`).join('');
  list.querySelectorAll('[data-result-link]').forEach((link) => link.addEventListener('click', (event) => event.stopPropagation()));
  list.querySelectorAll('.research-check').forEach((box) => box.addEventListener('change', () => {
    const checked = [...list.querySelectorAll('.research-check:checked')];
    if (checked.length > 5) { box.checked = false; toast('한 번에 최대 5개까지 선택할 수 있습니다.'); }
    root.querySelector('#collect-button').disabled = !list.querySelector('.research-check:checked');
  }));
}

async function collectSelected(root) {
  const urls = [...root.querySelectorAll('.research-check:checked')].map((box) => box.value); const button = root.querySelector('#collect-button');
  setBusy(button, true, '수집 중…'); status(root, '본문을 읽고 PDF로 저장하고 있습니다. 글마다 잠시 시간이 걸립니다.');
  try {
    const data = await post('/api/research/collect', { urls }); collected = data.items || []; analysis = '';
    showCollected(root); root.querySelector('#analysis-section').hidden = true;
    const ok = collected.filter((item) => !item.error).length; status(root, `${ok}개의 본문을 수집했습니다.`);
    if (ok && hasKey()) await analyze(root); else if (ok) toast('본문 수집 완료. OpenAI API 키를 설정한 뒤 스타일 분석을 눌러 주세요.', 6000);
  } catch (error) { status(root, error.message, true); }
  finally { setBusy(button, false, '선택한 글 수집'); }
}

function showCollected(root) {
  root.querySelector('#collection-section').hidden = false;
  root.querySelector('#collection-list').innerHTML = collected.map((item) => item.error
    ? `<article class="card research-item research-item--error"><div class="research-item__body"><strong>수집 실패</strong><span>${esc(item.error)}</span><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">원문 열기</a></div></article>`
    : `<article class="card research-item research-item--collected"><div class="research-item__body"><strong>${esc(item.title)}</strong><span>${esc(item.author)} · 본문 ${item.text.length.toLocaleString()}자</span><div class="research-item__links"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">원문</a>${item.pdfUrl ? `<a href="${esc(item.pdfUrl)}" target="_blank">PDF 열기</a>` : `<span>PDF 실패: ${esc(item.pdfError)}</span>`}</div></div></article>`).join('');
  root.querySelector('#analyze-button').disabled = !collected.some((item) => item.text);
}

async function analyze(root) {
  const sources = collected.filter((item) => item.text); if (!sources.length) return;
  if (!hasKey()) { toast('OpenAI API 키가 없습니다. 게시물 제작 화면의 AI 설정에서 먼저 입력해 주세요.', 6000); return; }
  const button = root.querySelector('#analyze-button'); setBusy(button, true, '분석 중…'); status(root, '선택한 글에서 공통적인 문체와 구성 특징을 분석하고 있습니다.');
  const sourceText = sources.map((item, i) => `[참고 글 ${i + 1}: ${item.title}]\n${item.text.slice(0, 10000)}`).join('\n\n---\n\n');
  const prompt = `아래 네이버 블로그 글들을 분석해 재사용 가능한 한국어 문체 가이드를 작성하세요.\n\n원문의 고유 문장·비유·표현을 복사하거나 가깝게 바꾸지 마세요. 특정 작성자를 흉내 내는 지침이 아니라 여러 특징을 일반화하세요. 근거가 부족한 특징은 단정하지 마세요.\n\n다음 순서로 작성하세요:\n1. 한 줄 분위기 요약\n2. 도입 방식\n3. 문장 길이와 리듬\n4. 소제목과 전체 구성\n5. 정보와 개인 경험의 비율\n6. 어휘·존댓말·이모지·강조 방식\n7. 피해야 할 요소\n8. 새 글 작성용 프롬프트\n\n${sourceText}`;
  try { analysis = await generateText(prompt, { maxOutputTokens: 1800 }); showAnalysis(root, analysis); status(root, '스타일 분석을 완료했습니다.'); }
  catch (error) { status(root, error.message, true); }
  finally { setBusy(button, false, '스타일 분석'); }
}

function showAnalysis(root, text) { root.querySelector('#analysis-section').hidden = false; root.querySelector('#analysis-result').textContent = text; root.querySelector('#analysis-section').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function post(url, body) { let response; try { response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch { throw new Error('로컬 수집 서버에 연결하지 못했습니다. npm start로 실행했는지 확인해 주세요.'); } const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `요청에 실패했습니다 (${response.status}).`); return data; }
function status(root, message, error = false) { const node = root.querySelector('#research-status'); node.textContent = message; node.classList.toggle('is-error', error); }
function setBusy(button, busy, label) { button.disabled = busy; button.textContent = label; button.setAttribute('aria-busy', String(busy)); }
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
