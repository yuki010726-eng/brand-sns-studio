/** 상단 GNB — 브랜드 로고 + 주요 이동 링크 + 구글 로그인 */
import { icon } from '../assets/icons.js';
import { isConfigured } from '../lib/supabase.js';
import { onAuth, signInWithGoogle, signOut, getUser } from '../lib/auth.js';
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
            <a class="nav__link" href="#${item.path}"
               ${isActive(item.path, currentPath) ? 'aria-current="page"' : ''}>
              ${item.label}
            </a>`).join('')}
        </nav>
        <div class="authbox" id="authbox">${authHTML(getUser())}</div>
      </div>
    </header>`;

  bindAuth(root);

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
  if (!isConfigured()) return '';

  if (!user) {
    return `
      <button type="button" class="btn btn--ghost btn--sm" id="auth-in"
              aria-label="구글 계정으로 로그인">
        ${icon('sparkles', 'icon--sm')} 구글 로그인
      </button>`;
  }

  const initial = (user.name || '?').trim().charAt(0);
  return `
    <div class="authbox__user">
      ${user.avatar
        ? `<img class="authbox__avatar" src="${esc(user.avatar)}" alt="" referrerpolicy="no-referrer" />`
        : `<span class="authbox__avatar authbox__avatar--text" aria-hidden="true">${esc(initial)}</span>`}
      <span class="authbox__name" title="${esc(user.email)}">${esc(user.name)}</span>
      <button type="button" class="btn btn--text btn--sm" id="auth-out"
              aria-label="로그아웃">로그아웃</button>
    </div>`;
}

function bindAuth(root) {
  root.querySelector('#auth-in')?.addEventListener('click', async () => {
    const { error } = await signInWithGoogle();
    if (error) toast(`로그인을 시작하지 못했습니다 — ${error}`, 5000);
  });

  root.querySelector('#auth-out')?.addEventListener('click', async () => {
    await signOut();
    toast('로그아웃했습니다. 이 기기에 저장된 내용은 그대로 있습니다.');
  });
}

/** 보관함 외 나머지 경로는 모두 '새 게시물' 흐름으로 본다 */
function isActive(navPath, current) {
  return navPath === '/library' ? current === '/library' : current !== '/library';
}

const esc = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
