/** 상단 GNB — 브랜드 로고 + 주요 이동 링크 + 계정 정보 */
import { icon } from '../assets/icons.js';
import { onAuth, signOut, getUser, usernameOf } from '../lib/auth.js';
import { getState, resetFlow, navigate } from '../store.js';
import {
  getLibrary, postKeyOf, POST_KEYS, getLibraryEditId, clearLibraryEdit, saveToLibrary,
} from '../lib/librarystore.js';
import { flushSync } from '../lib/sync.js';
import { toast } from './toast.js';

/**
 * ⚠️ **프로필·블로그 스타일은 메뉴에서 뺐다** (2026-08-21, 요청자 지시).
 *    둘 다 「한 번 정해 두는 설정」인데 「지금 만드는 것」(새 게시물)과 나란히 서 있으니
 *    메뉴만 보고는 뭐가 흐름이고 뭐가 설정인지 알 수 없었다.
 *    이제 **마이페이지 안**에서 들어간다 (`pages/library.js` 의 `SETTINGS`).
 *    ⚠️ 경로(`/profile`·`/research`)는 그대로 살아 있다 — 문만 옮긴 것이다.
 */
const NAV = [
  { path: '/',        label: '새 게시물', iconName: 'sparkles' },
  { path: '/library', label: '마이페이지', iconName: 'archive' },
];

/** 로그인 상태가 바뀌면 헤더만 다시 그린다 — 페이지 전체를 건드리지 않는다 */
let unsubscribe = null;

/**
 * @param {HTMLElement} root
 * @param {string} currentPath 현재 라우트
 */
export function renderHeader(root, currentPath) {
  const nav = getUser()?.role === 'admin'
    ? [...NAV, { path: '/products-admin', label: '상품 관리', iconName: 'settings' }]
    : NAV;
  root.innerHTML = `
    <header class="site-header">
      <div class="container site-header__inner">
        <!-- ⚠️ 글자를 span 으로 감싼 이유 — 좁은 화면에서 이것만 감춰 헤더를 줄인다.
             a 의 aria-label 이 이름을 그대로 갖고 있어 감춰도 읽어 준다. -->
        <a class="brand" href="#/" aria-label="브랜드 SNS 스튜디오 홈으로 이동">
          <span class="brand__mark">${icon('sparkles')}</span>
          <span class="brand__text">브랜드 SNS 스튜디오</span>
        </a>
        <nav class="nav" aria-label="주요 메뉴">
          ${nav.map((item) => `
            <a class="nav__link" href="#${item.path}" data-nav-path="${item.path}"
               ${isActive(item.path, currentPath) ? 'aria-current="page"' : ''}>
              ${item.label}
            </a>`).join('')}
        </nav>
        <div class="authbox" id="authbox">${authHTML(getUser())}</div>
      </div>
    </header>`;

  bindAuth(root);
  root.querySelector('[data-nav-path="/"]')?.addEventListener('click', startNewPost);
  root.querySelector('.brand')?.addEventListener('click', startNewPost);

  // 라우트를 옮길 때마다 헤더가 다시 그려지므로 구독도 새로 건다
  unsubscribe?.();
  unsubscribe = onAuth((user) => {
    const box = root.querySelector('#authbox');
    if (!box) return;
    box.innerHTML = authHTML(user);
    bindAuth(root);
  });
}

/**
 * 로그인 영역.
 *
 * ⚠️ 설정이 없으면 **버튼을 아예 감춘다.** 눌러도 안 되는 버튼을 두면
 *    고장 난 것처럼 보인다. 로그인은 없어도 앱이 완전히 동작한다.
 */
function authHTML(user) {
  if (!user) return '';

  const initial = (user.name || '?').trim().charAt(0);
  return `
    <div class="authbox__user">
      ${user.avatar
        ? `<img class="authbox__avatar" src="${esc(user.avatar)}" alt="" referrerpolicy="no-referrer" />`
        : `<span class="authbox__avatar authbox__avatar--text" aria-hidden="true">${esc(initial)}</span>`}
      <span class="authbox__name" title="${esc(usernameOf(user.email))}">${esc(user.name)}</span>
      <button type="button" class="btn btn--text btn--sm" id="auth-out"
              aria-label="로그아웃">로그아웃</button>
    </div>`;
}

/**
 * 지금 작업 중인 게시물이 보관함에 저장된 것과 다른지(=저장 안 한 채 로그아웃하는지) 본다.
 * 신원(`postKeyOf`)이 같은 항목이 없거나, 있어도 내용이 그때와 달라졌으면 저장 안 한 것으로 본다.
 */
function hasUnsavedPost(state) {
  if (!state.productId || !String(state.topic || '').trim()) return false;
  const saved = getLibrary().find((it) => it.postKey === postKeyOf(state));
  if (!saved) return true;
  return POST_KEYS.some((k) => JSON.stringify(state[k]) !== JSON.stringify(saved.state[k]));
}

/**
 * 「새 게시물」 — 누르면 만들던 내용을 전부 비우고 1단계부터 다시 시작한다
 * (요청자 지시 2026-08-14: "새 게시물 누르면 다 초기화 되도록 세팅").
 *
 * 예전에는 `clearLibraryEdit()` 만 해서 상품·주제·글귀·카드가 그대로 남았다.
 * 새로 만들려고 눌렀는데 앞 게시물이 남아 있으니 매번 손으로 지워야 했다.
 *
 * 보관함에서 불러온 게시물은 수정본을 먼저 저장한 다음 확인창 없이 새 작업을 연다.
 * 저장이 실패하면 초기화와 이동을 중단해 수정 내용이 사라지지 않게 한다.
 * ⚠️ **프로필은 지우지 않는다.** `resetFlow()` 가 계정 정보를 건드리지 않는 이유와 같다.
 * ⚠️ **보관함에 저장한 게시물은 지워지지 않는다.** 비우는 것은 지금 화면의 작업 상태뿐이다.
 */
let startingNewPost = false;

async function startNewPost(e) {
  e.preventDefault();
  if (startingNewPost) return;
  startingNewPost = true;

  const state = getState();
  const started = Boolean(state.productId) || Boolean(String(state.topic || '').trim());

  try {
    // 보관함에서 불러온 게시물은 확인창 없이 현재 수정본을 먼저 저장한다.
    // 저장에 실패하면 작업 상태를 비우지 않아 사용자의 수정 내용을 보호한다.
    if (getLibraryEditId()) {
      const saved = await saveToLibrary(state);
      if (!saved.ok) {
        toast(`저장하지 못해 새 게시물로 이동하지 않았습니다. ${saved.error}`, 6000);
        return;
      }
    }

    /**
     * 이미 홈(`#/`)에 있으면 해시가 안 바뀌어 라우터가 다시 돌지 않으므로
     * 상태를 비운 뒤 화면 갱신을 직접 요청한다.
     */
    const onHome = location.hash === '#/' || location.hash === '';
    clearLibraryEdit();
    resetFlow();
    if (onHome) window.dispatchEvent(new Event('hashchange'));
    else navigate('/');

    if (started) toast('현재 수정 내용을 저장하고 새 게시물을 시작합니다.');
  } finally {
    startingNewPost = false;
  }
}

function bindAuth(root) {
  root.querySelector('#auth-out')?.addEventListener('click', async () => {
    const unsaved = hasUnsavedPost(getState());

    /**
     * ⚠️ 초기화는 signOut() 보다 먼저, 그리고 flushSync() 로 즉시 서버에 올려야 한다.
     * scheduleSync() 는 로그인 상태(getUser())가 있어야만 동작하는데, signOut() 을 먼저
     * 부르면 그 순간부터 로그인 상태가 사라져 초기화가 이 기기에만 남고 서버 값은
     * 그대로다. 그러면 다시 로그인할 때 pull() 이 옛 내용을 도로 받아온다.
     */
    if (unsaved) {
      resetFlow();
      await flushSync(getState());
    }

    await signOut();

    toast(unsaved
      ? '로그아웃했습니다. 보관함에 저장하지 않은 입력 내용은 초기화됐습니다.'
      : '로그아웃했습니다. 이 기기에 저장된 내용은 그대로 있습니다.');
  });
}

/** 보관함에서 불러온 편집 흐름은 세부 단계에서도 '보관함' 탭으로 표시한다. */
const MYPAGE_PATHS = ['/library', '/profile', '/research'];

function isActive(navPath, current) {
  if (navPath === '/products-admin') return current === '/products-admin';
  if (current === '/products-admin') return false;
  // 설정 화면(프로필·블로그 스타일)도 마이페이지 안에 있으므로 같은 탭으로 표시한다
  const inMypage = MYPAGE_PATHS.includes(current) || Boolean(getLibraryEditId());
  if (navPath === '/library') return inMypage;
  return !inMypage;
}

const esc = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
