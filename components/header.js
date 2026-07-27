/** 상단 GNB — 브랜드 로고 + 주요 이동 링크 */
import { icon } from '../assets/icons.js';

const NAV = [
  { path: '/',        label: '새 게시물', iconName: 'sparkles' },
  { path: '/library', label: '보관함',   iconName: 'archive' },
];

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
      </div>
    </header>`;
}

/** 보관함 외 나머지 경로는 모두 '새 게시물' 흐름으로 본다 */
function isActive(navPath, current) {
  return navPath === '/library' ? current === '/library' : current !== '/library';
}
