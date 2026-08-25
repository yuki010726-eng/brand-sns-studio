import { getUser, accessToken } from '../lib/auth.js';
import { PRODUCTS, getProduct, reloadProducts } from '../lib/products.js';
import { toast } from '../components/toast.js';

export const title = '상품 관리';
export function guard() { return getUser()?.role === 'admin' ? null : '/'; }

export function render(root) {
  root.innerHTML = `
    <div class="container page product-admin-page">
      <section class="hero">
        <h1>상품 관리</h1>
        <p class="hero__sub">블로그·카페에서 새로 확인된 내용을 검토한 뒤 상품 자료에 반영합니다.</p>
      </section>
      <section class="card product-admin-form" aria-labelledby="product-source-title">
        <div>
          <h2 id="product-source-title">상품 자료 확인</h2>
          <p class="section__desc">링크를 읽어 기존 상품 근거에 없는 내용만 먼저 보여드립니다. 확인 단계에서는 Supabase에 저장하지 않습니다.</p>
        </div>
        <form id="product-update-form">
          <label class="field">
            <span class="field__label">확인할 상품</span>
            <select class="select" id="admin-product" required>
              <option value="">상품 선택</option>
              ${PRODUCTS.map((product) => `<option value="${esc(product.id)}">${esc(product.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field__label">블로그·카페 링크</span>
            <textarea class="textarea" id="admin-source-urls" rows="7" required placeholder="https://blog.naver.com/...&#10;https://cafe.naver.com/..."></textarea>
            <span class="field__hint">네이버 공개 글만 가능하며 한 번에 최대 10개까지 확인합니다.</span>
          </label>
          <button class="btn btn--primary" id="product-update-button" type="submit">새 내용 확인</button>
        </form>
        <p class="research-status" id="product-update-status" role="status" aria-live="polite"></p>
        <div id="product-update-results"></div>
      </section>
    </div>`;
  root.querySelector('#product-update-form').addEventListener('submit', (event) => preview(event, root));
}

async function preview(event, root) {
  event.preventDefault();
  const button = root.querySelector('#product-update-button');
  setBusy(button, true, '내용 확인 중…');
  setStatus(root, '링크의 본문을 읽고 기존 상품 자료와 비교하고 있습니다. 아직 저장하지 않습니다.');
  try {
    let request = requestValues(root);
    const data = await callUpdateApi({ ...request, action: 'preview' });
    setStatus(root, '원문에서 상품 자료로 쓸 핵심 내용만 뽑아 정리하고 있습니다.');
    const items = await extractPreviewItems(data.items || [], getProduct(request.productId));
    const newCount = items.reduce((sum, item) => sum + (item.newContent?.length || 0), 0);
    root.querySelector('#product-update-results').innerHTML = previewHTML(items, newCount);
    if (newCount) {
      setStatus(root, `새 내용 ${newCount}개를 찾았습니다. 아래 목록을 확인한 뒤 반영해 주세요.`);
      const applyButton = root.querySelector('#product-apply-button');
      applyButton?.addEventListener('click', () => apply(root, { ...request, sources: selectedSources(root, items) }));
      root.querySelector('#product-update-results')?.addEventListener('change', (event) => {
        if (event.target.matches('.product-content-check')) updateSelectionSummary(root);
      });
    } else {
      setStatus(root, '새로 추가할 내용이 없습니다. Supabase는 변경되지 않았습니다.');
    }
  } catch (error) {
    setStatus(root, error.message || '내용을 확인하지 못했습니다.');
  } finally { setBusy(button, false, '새 내용 확인'); }
}

function extractPreviewItems(items, product) {
  const existingContent = product?.voice?.proof || [];
  const productTokens = keywordTokens(`${product?.name || ''} ${product?.summary || ''}`);
  return items.map((item) => {
    if (item.error) return item;
    const extracted = extractFacts(item.content || [], productTokens)
      .filter((line) => !existingContent.some((known) => isDuplicateContent(line, known)));
    return { ...item, newContent: extracted };
  });
}

const FACT_WORDS = /(?:주최|주관|후원|개최|일정|시상식|접수|신청|모집|마감|발표|심사|선정|평가|기준|부문|대상|자격|제출|서류|절차|특전|제공|지원|수상|인증|엠블럼|상장|상패|기사|영상|광고|송출|채널|장소|호텔|그랜드볼룸|비대면|연중|상시|무료|무상|포함|제외|가능|불가)/;
const NUMBER_FACT = /(?:\d{4}\s*년|\d{1,2}\s*월|\d{1,2}\s*일|\d{1,2}\s*시|\d+(?:[.,]\d+)?\s*(?:개|명|곳|종|회|점|%|퍼센트|만원|원|초|분|가구|채널))/;
const NOISE = /(?:안녕하세요|반갑습니다|오늘은|포스팅|블로그|공감|댓글|이웃추가|서이추|문의주세요|문의 주세요|클릭|링크|카테고리|프로필|로그인|작성자|저작권|무단전재|내돈내산|협찬|소정의|원고료)/i;
const OPINION = /(?:것 같|느꼈|생각했|추천드|추천해|좋았|아쉬웠|다녀왔|방문했|궁금하|어떠셨|해보세요|바랍니다)/;

function extractFacts(lines, productTokens) {
  const candidates = lines.flatMap(splitSourceSentences)
    .map(cleanSourceSentence)
    .filter((line) => line.length >= 12 && line.length <= 500)
    .filter((line) => !NOISE.test(line) && !OPINION.test(line))
    .filter((line) => {
      const normalized = normalizeContent(line);
      const productMatch = productTokens.some((token) => normalized.includes(token));
      const factSignal = FACT_WORDS.test(line) || NUMBER_FACT.test(line);
      return factSignal && (productMatch || factSignalScore(line) >= 2);
    });
  const unique = [];
  for (const candidate of candidates) {
    if (!unique.some((known) => isDuplicateContent(candidate, known))) unique.push(candidate);
  }
  return unique.slice(0, 40);
}

function splitSourceSentences(value) {
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return [];
  return text.split(/(?<=[.!?。！？])\s+|\s*[|｜]\s*/).filter(Boolean);
}

function cleanSourceSentence(value) {
  const line = String(value).replace(/^\s*(?:[-*•▶▷✓✔]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').trim();
  if (!line || /[.!?。！？]$/.test(line)) return line;
  return `${line}.`;
}

function keywordTokens(value) {
  const stopwords = new Set(['브랜드', '어워즈', '대한민국', '상품', '서비스', '진행', '관련', '기반']);
  return [...new Set(normalizeContent(value).split(/[^0-9a-z가-힣]+/).filter((token) => token.length >= 2 && !stopwords.has(token)))];
}

function factSignalScore(value) {
  let score = (String(value).match(new RegExp(FACT_WORDS.source, 'g')) || []).length;
  if (NUMBER_FACT.test(value)) score += 1;
  if (/(?:에서|까지|부터|통해|기준|대상|제공|진행|열린|개최)/.test(value)) score += 1;
  return score;
}

const normalizeContent = (value) => String(value).replace(/\s+/g, ' ').trim().toLocaleLowerCase('ko-KR');

function isDuplicateContent(left, right) {
  const a = normalizeComparable(left);
  const b = normalizeComparable(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (numberKey(a) !== numberKey(b)) return false;
  return similarity(a, b) >= 0.82;
}

const normalizeComparable = (value) => normalizeContent(value)
  .replace(/[^0-9a-z가-힣]/g, '')
  .replace(/(?:열립니다|열린다|입니다|됩니다|합니다|습니다|이다|한다|된다)$/u, '');
const numbersOf = (value) => String(value).match(/\d+(?:[.,]\d+)*/g) || [];
const numberKey = (value) => [...new Set(numbersOf(value))].sort().join('|');
function similarity(a, b) {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (!longer.length) return 1;
  const row = Array.from({ length: shorter.length + 1 }, (_, index) => index);
  for (let i = 1; i <= longer.length; i++) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= shorter.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (longer[i - 1] === shorter[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return 1 - row[shorter.length] / longer.length;
}

async function apply(root, request) {
  const button = root.querySelector('#product-apply-button');
  setBusy(button, true, '반영 중…');
  setStatus(root, '원문을 다시 확인한 뒤 Supabase에 반영하고 있습니다.');
  try {
    const data = await callUpdateApi({ ...request, action: 'apply' });
    await reloadProducts();
    root.querySelector('#product-update-results').innerHTML = savedHTML(data.items || []);
    setStatus(root, `${data.updated}개 링크의 내용을 상품 자료에 반영했습니다.`);
    toast('상품 자료를 업데이트했습니다.');
  } catch (error) {
    setStatus(root, error.message || '상품 자료에 반영하지 못했습니다.');
    setBusy(button, false, '확인한 내용 반영');
  }
}

function requestValues(root) {
  return {
    productId: root.querySelector('#admin-product').value,
    urls: root.querySelector('#admin-source-urls').value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
  };
}

async function callUpdateApi(body) {
  const token = await accessToken();
  const response = await fetch('/api/admin/product-update', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 501) {
    throw new Error('현재 Python 정적 서버에서는 상품 자료 확인을 할 수 없습니다. 서버를 종료한 뒤 serve.cmd 또는 npm start로 다시 실행해 주세요.');
  }
  if (!response.ok) throw new Error(data.error || `요청에 실패했습니다 (${response.status}).`);
  return data;
}

function previewHTML(items, newCount) {
  let sourceIndex = -1;
  return `<div class="product-preview">
    <div class="product-preview__head"><h3>새로 확인된 내용</h3><span id="product-selected-count">${newCount.toLocaleString('ko-KR')}개 선택</span></div>
    <ul class="product-update-results">${items.map((item) => {
      if (item.error) return errorItem(item);
      sourceIndex += 1;
      const currentSource = sourceIndex;
      return `
      <li>
        <strong>${esc(item.title || item.url)}</strong>
        <span>${item.type === 'cafe' ? '카페' : '블로그'} · 새 내용 ${item.newContent.length.toLocaleString('ko-KR')}개</span>
        ${item.newContent.length ? `<ul class="product-new-content">${item.newContent.map((line, contentIndex) => `<li><label class="product-content-option"><input class="product-content-check" type="checkbox" data-source-index="${currentSource}" data-content-index="${contentIndex}" checked /><span>${esc(line)}</span></label></li>`).join('')}</ul>` : '<p class="product-preview__empty">기존 자료와 비교해 새로 추가할 내용이 없습니다.</p>'}
      </li>`;
    }).join('')}</ul>
    ${newCount ? '<div class="product-preview__actions"><p>체크한 내용만 source_content에 저장됩니다.</p><button class="btn btn--primary" id="product-apply-button" type="button">선택한 내용 반영</button></div>' : ''}
  </div>`;
}

function selectedSources(root, items) {
  const successful = items.filter((item) => !item.error);
  const selected = new Map();
  root.querySelectorAll('.product-content-check:checked').forEach((input) => {
    const sourceIndex = Number(input.dataset.sourceIndex);
    const contentIndex = Number(input.dataset.contentIndex);
    const item = successful[sourceIndex];
    const content = item?.newContent?.[contentIndex];
    if (!item || !content) return;
    if (!selected.has(item.url)) selected.set(item.url, []);
    selected.get(item.url).push(content);
  });
  return [...selected].map(([url, content]) => ({ url, content }));
}

function updateSelectionSummary(root) {
  const count = root.querySelectorAll('.product-content-check:checked').length;
  const label = root.querySelector('#product-selected-count');
  const button = root.querySelector('#product-apply-button');
  if (label) label.textContent = `${count.toLocaleString('ko-KR')}개 선택`;
  if (button) button.disabled = count === 0;
}

function savedHTML(items) {
  return `<ul class="product-update-results">${items.map((item) => item.error ? errorItem(item) : `<li><strong>${esc(item.title || item.url)}</strong><span>${item.type === 'cafe' ? '카페' : '블로그'} · ${Number(item.chars || 0).toLocaleString('ko-KR')}자 저장</span></li>`).join('')}</ul>`;
}

const errorItem = (item) => `<li class="is-error"><strong>${esc(item.title || item.url)}</strong><span>${esc(item.error)}</span></li>`;
const setStatus = (root, text) => { root.querySelector('#product-update-status').textContent = text; };
function setBusy(button, busy, label) { if (button) { button.disabled = busy; button.textContent = label; } }
const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
