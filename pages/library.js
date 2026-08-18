/**
 * 보관함 (STEP 5) — 저장해 둔 게시물을 찾아서 이어서 편집한다
 *
 * 들어오는 길은 하나다. 4단계에서 「보관함에 저장」을 누른 게시물만 여기 있다 (요청자 결정).
 * 자동으로 쌓지 않는 이유는 `lib/librarystore.js` 머리말에 적어 뒀다.
 *
 * 이 화면이 하는 일은 셋이다.
 *   찾기(검색·상품 필터·정렬) → 불러오기(4단계로 복원) → 지우기
 *
 * ⚠️ 검색·필터·정렬 값은 스토어에 넣지 않는다. 화면을 떠나면 사라져도 되는 값이고,
 *    넣으면 기기 간 동기화까지 따라가서 다른 PC 의 필터가 바뀐다.
 */
import { icon } from '../assets/icons.js';
import { getProduct, PRODUCTS } from '../lib/products.js';
import { CHANNELS } from '../data/channels.js';
import { getConcept } from '../lib/concepts.js';
import { TONE_LABEL } from '../lib/copywriter.js';
import { getState, navigate } from '../store.js';
import { getLibrary, getThumb, loadFromLibrary, removeFromLibrary, postKeyOf } from '../lib/librarystore.js';
import { confirmModal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export const title = '보관함';

const SORTS = [
  { id: 'recent', label: '최근 저장순' },
  { id: 'oldest', label: '오래된순' },
  { id: 'title', label: '주제 이름순' },
];

/* 화면 안에서만 쓰는 값 — 스토어에 넣지 않는다 */
let query = '';
let productFilter = 'all';
let sort = 'recent';

/** 이 화면에서 만든 objectURL 만 정리한다 (imagestore 의 revokeAll 은 다른 화면 것까지 지운다) */
let thumbUrls = [];
function releaseThumbs() {
  thumbUrls.forEach((u) => URL.revokeObjectURL(u));
  thumbUrls = [];
}

/* ---------------- 렌더 ---------------- */

export function render(root) {
  releaseThumbs();
  const all = getLibrary();

  root.innerHTML = `
    <div class="container">
      <section class="section">
        <div class="section__head">
          <h1>내 게시물 보관함</h1>
          <p class="section__desc">
            AI로 생성한 게시물과 카드뉴스 편집본이 자동으로 모입니다.
            불러오면 글귀·템플릿·카드 문구가 그대로 되살아납니다.
          </p>
        </div>
        ${all.length ? toolbarHTML(all) : ''}
        <div id="lib-results">${resultsHTML(all)}</div>
      </section>
    </div>`;

  if (all.length) bindToolbar(root);
  bindResults(root);
  loadThumbs(root);
}

function toolbarHTML(all) {
  const counts = { all: all.length };
  for (const p of PRODUCTS) counts[p.id] = all.filter((it) => it.productId === p.id).length;

  return `
    <div class="lib-toolbar">
      <div class="search lib-toolbar__search">
        ${icon('search', 'icon--sm')}
        <label class="sr-only" for="lib-q">보관함 검색</label>
        <input class="input" id="lib-q" type="search" autocomplete="off"
               placeholder="주제나 글 내용으로 검색" value="${esc(query)}" />
      </div>
      <div class="lib-toolbar__sort">
        <label class="sr-only" for="lib-sort">정렬 기준</label>
        ${icon('sort', 'icon--sm')}
        <select class="select" id="lib-sort" autocomplete="off" aria-label="정렬 기준">
          ${SORTS.map((s) => `<option value="${s.id}" ${sort === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="lib-filters" role="group" aria-label="상품으로 거르기">
      ${filterChipHTML('all', '전체', counts.all)}
      ${PRODUCTS.map((p) => filterChipHTML(p.id, p.short, counts[p.id])).join('')}
    </div>`;
}

function filterChipHTML(id, label, count) {
  const on = productFilter === id;
  return `
    <button type="button" class="chip" data-filter="${id}" aria-pressed="${on}"
            aria-label="${esc(label)} 게시물만 보기 (${count}개)">
      ${esc(label)} <span class="chip__count">${count}</span>
    </button>`;
}

/** 검색·필터·정렬을 적용한 목록 */
function visible(all) {
  const q = query.trim().toLowerCase();
  let list = all.filter((it) => productFilter === 'all' || it.productId === productFilter);

  if (q) list = list.filter((it) => haystack(it).includes(q));

  const by = {
    recent: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
    oldest: (a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)),
    title: (a, b) => a.title.localeCompare(b.title, 'ko'),
  };
  return list.slice().sort(by[sort] || by.recent);
}

/** 주제·상품명뿐 아니라 **글 내용까지** 뒤진다. 주제를 잊어도 문장 한 조각으로 찾을 수 있어야 한다. */
function haystack(item) {
  const drafts = item.state?.drafts || {};
  const product = getProduct(item.productId);
  return [item.title, product?.name || '', product?.short || '', ...Object.values(drafts)]
    .join(' ').toLowerCase();
}

function resultsHTML(all) {
  if (!all.length) {
    return `
      <div class="card empty">
        ${icon('archive', 'icon--lg')}
        <h2>아직 보관한 게시물이 없습니다</h2>
        <p>AI 글이 생성되면 자동으로 저장되고, 카드뉴스 편집 내용도 주기적으로 반영됩니다.</p>
        <div class="stub__actions">
          <a class="btn" href="#/" aria-label="새 게시물 만들기 화면으로 이동">새 게시물 만들기</a>
        </div>
      </div>`;
  }

  const list = visible(all);
  if (!list.length) {
    return `
      <div class="card empty">
        ${icon('search', 'icon--lg')}
        <h2>찾는 게시물이 없습니다</h2>
        <p>검색어나 상품 조건을 바꿔 보세요.</p>
        <div class="stub__actions">
          <button type="button" class="btn btn--ghost" id="lib-clear" aria-label="검색과 필터 초기화">조건 지우기</button>
        </div>
      </div>`;
  }

  return `
    <p class="lib-count" role="status">${list.length}개 게시물</p>
    <ul class="lib-grid">${list.map(itemHTML).join('')}</ul>`;
}

function itemHTML(item) {
  const product = getProduct(item.productId);
  const concept = getConcept(item.concept);
  const channels = (item.channels || [])
    .map((id) => CHANNELS.find((c) => c.id === id)?.name)
    .filter(Boolean);

  return `
    <li class="lib-item card card--hover" data-id="${item.id}">
      <div class="lib-item__thumb" data-thumb="${item.id}">
        ${item.hasThumb
          ? '<span class="lib-item__loading" aria-hidden="true"></span>'
          : `<span class="lib-item__noimg">${icon('image')}<span>미리보기 없음</span></span>`}
      </div>
      <div class="lib-item__body">
        <div class="lib-item__tags">
          <span class="badge">${esc(product?.short || item.productId)}</span>
          <span class="badge badge--neutral">${esc(concept?.name || item.concept)}</span>
        </div>
        <h2 class="lib-item__title">${esc(item.title)}</h2>
        <p class="lib-item__meta">
          ${esc(TONE_LABEL[item.tone] || item.tone || '')} · 카드 ${item.cardCount || 6}장${channels.length ? ` · ${esc(channels.join('·'))}` : ''}
        </p>
        <p class="lib-item__date">${esc(dateLabel(item.updatedAt))} 저장</p>
        <div class="lib-item__actions">
          <button type="button" class="btn btn--sm" data-load="${item.id}"
                  aria-label="${esc(item.title)} 불러와서 이어서 편집하기">
            ${icon('arrowRight', 'icon--sm')} 불러오기
          </button>
          <button type="button" class="btn btn--ghost btn--sm" data-remove="${item.id}"
                  aria-label="${esc(item.title)} 보관함에서 삭제하기">
            ${icon('trash', 'icon--sm')} 삭제
          </button>
        </div>
      </div>
    </li>`;
}

/* ---------------- 동작 ---------------- */

function bindToolbar(root) {
  const q = root.querySelector('#lib-q');
  let timer = null;
  q?.addEventListener('input', () => {
    // 한 글자마다 목록을 다시 그리면 입력이 끊긴다
    clearTimeout(timer);
    timer = setTimeout(() => { query = q.value; repaint(root); q.focus(); }, 180);
  });

  root.querySelector('#lib-sort')?.addEventListener('change', (e) => {
    sort = e.target.value;
    repaint(root);
  });

  root.querySelectorAll('[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      productFilter = chip.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((c) => {
        c.setAttribute('aria-pressed', String(c.dataset.filter === productFilter));
      });
      repaint(root);
    });
  });
}

/** 목록만 다시 그린다 — 검색창을 통째로 다시 그리면 커서와 포커스가 날아간다 */
function repaint(root) {
  releaseThumbs();
  const results = root.querySelector('#lib-results');
  if (!results) return;
  results.innerHTML = resultsHTML(getLibrary());
  bindResults(root);
  loadThumbs(root);
}

function bindResults(root) {
  root.querySelector('#lib-clear')?.addEventListener('click', () => {
    query = ''; productFilter = 'all';
    render(root);
    root.querySelector('#lib-q')?.focus();
  });

  root.querySelectorAll('[data-load]').forEach((btn) => {
    btn.addEventListener('click', () => loadItem(root, btn.dataset.load));
  });
  root.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => removeItem(root, btn.dataset.remove));
  });
}

/**
 * 불러오기 — 지금 작업 중인 내용을 덮어쓴다.
 *
 * ⚠️ 작업 중인 게시물이 아직 보관되지 않았다면 **먼저 물어본다.** 여기서 말없이 덮으면
 *    돌이킬 방법이 없다(보관함에 없으니 되찾을 곳도 없다).
 */
async function loadItem(root, id) {
  const s = getState();
  const working = String(s.topic || '').trim();
  const all = getLibrary();
  const target = all.find((it) => it.id === id);
  if (!target) { toast('항목을 찾을 수 없습니다.'); render(root); return; }

  const unsaved = working && !all.some((it) => it.postKey === postKeyOf(s));
  if (unsaved && postKeyOf(s) !== target.postKey) {
    const ok = await confirmModal(
      `지금 작업 중인 「${working}」은(는) 보관함에 없습니다. 불러오면 지금 내용은 사라집니다.`,
      { okLabel: '그래도 불러오기', title: '저장하지 않은 작업이 있습니다' },
    );
    if (!ok) return;
  }

  const result = await loadFromLibrary(id);
  if (!result.ok) { toast(result.error); return; }
  releaseThumbs();
  toast(`「${target.title}」을(를) 불러왔습니다.`);
  navigate('/template');
}

async function removeItem(root, id) {
  const item = getLibrary().find((it) => it.id === id);
  if (!item) return;

  const ok = await confirmModal(
    `「${item.title}」을(를) 보관함에서 지웁니다. 되돌릴 수 없습니다.`,
    { okLabel: '삭제', title: '게시물 삭제', danger: true },
  );
  if (!ok) return;

  await removeFromLibrary(id);
  toast('보관함에서 지웠습니다.');
  render(root);
}

/**
 * 썸네일은 IndexedDB 에 있어서 비동기다. 목록을 먼저 보여 주고 그림은 뒤따라 채운다.
 *
 * ⚠️ 썸네일은 **기기를 따라가지 않는다.** 보관함 목록(글)은 동기화되지만 그림은 이 기기에만 있다.
 *    다른 PC 에서는 「미리보기 없음」으로 뜬다 — 그래서 그림이 없어도 목록이 읽히도록 만들었다.
 */
async function loadThumbs(root) {
  const boxes = [...root.querySelectorAll('[data-thumb]')];
  for (const box of boxes) {
    const item = getLibrary().find((it) => it.id === box.dataset.thumb);
    if (!item?.hasThumb) continue;
    const blob = await getThumb(item);
    if (!box.isConnected) return;          // 그 사이 화면을 떠났다
    if (!blob) { box.innerHTML = `<span class="lib-item__noimg">${icon('image')}<span>미리보기 없음</span></span>`; continue; }
    const url = URL.createObjectURL(blob);
    thumbUrls.push(url);
    // loading="lazy" 를 쓰지 않는다. 이미 메모리에 있는 blob 이라 미룰 이득이 없고,
    // 화면 밖에 있으면 빈 칸으로 남아 "썸네일이 깨졌다"고 오해하게 된다.
    box.innerHTML = `<img src="${url}" alt="${esc(item.title)} 첫 번째 카드 미리보기" />`;
  }
}

/* ---------------- 유틸 ---------------- */

function dateLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (sameDay) return `오늘 ${time}`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const esc = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
