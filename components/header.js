/** 상단 GNB — 브랜드 로고 + 주요 이동 링크 + 계정 정보 */
import { icon } from '../assets/icons.js';
import { onAuth, signOut, getUser, usernameOf } from '../lib/auth.js';
import { getState, resetFlow } from '../store.js';
import { getLibrary, postKeyOf, POST_KEYS, getLibraryEditId, clearLibraryEdit } from '../lib/librarystore.js';
import { flushSync } from '../lib/sync.js';
import { toast } from './toast.js';

const NAV = [
  { path: '/',        label: '새 게시물', iconName: 'sparkles' },
  { path: '/library', label: '보관함',   iconName: 'archive' },
];

/** 로그인 상태가 바뀌면 헤더만 다시 그린다 — 페이지 전체를 건드리지 않는다 */
let unsubscribe = null;

/**
 * @param {HTMLElement} root
 * @param {string} currentPath 현재 라우트
 */
export function renderHeader(root, currentPath) {
  root.innerHTML = `
    <header class="site-header">
      <div class="container site-header__inner">
        <a class="brand" href="#/" aria-label="브랜드 SNS 스튜디오 홈으로 이동">
          <span class="brand__mark">${icon('sparkles')}</span>
          브랜드 SNS 스튜디오
        </a>
        <nav class="nav" aria-label="주요 메뉴">
          ${NAV.map((item) => `
            <a class="nav__link" href="#${item.path}" data-nav-path="${item.path}"
               ${isActive(item.path, currentPath) ? 'aria-current="page"' : ''}>
              ${item.label}
            </a>`).join('')}
        </nav>
        <div class="authbox" id="authbox">${authHTML(getUser())}</div>
      </div>
    </header>`;

  bindAuth(root);
  root.querySelector('[data-nav-path="/"]')?.addEventListener('click', clearLibraryEdit);
  root.querySelector('.brand')?.addEventListener('click', clearLibraryEdit);

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
function isActive(navPath, current) {
  const inLibrary = current === '/library' || Boolean(getLibraryEditId());
  return navPath === '/library' ? inLibrary : !inLibrary;
}

const esc = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
