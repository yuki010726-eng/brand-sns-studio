/**
 * 앱 진입점 — 해시 라우터
 * 각 페이지 모듈은 render(root) 를 내보내고, 선택적으로 guard() 로 접근 조건을 정한다.
 */
import { renderHeader } from './components/header.js';
import * as ProfilePage from './pages/profile.js';
import * as HomePage from './pages/home.js';
import * as CopyPage from './pages/copy.js';
import * as TemplatePage from './pages/template.js';
import * as LibraryPage from './pages/library.js';

const ROUTES = {
  '/profile': ProfilePage,
  '/': HomePage,
  '/copy': CopyPage,
  '/template': TemplatePage,
  '/library': LibraryPage,
};

/** 없어진 경로 → 현재 경로. 이미지 제작 단계는 템플릿 안으로 합쳤다. */
const MOVED = { '/image': '/template' };

const headerRoot = document.getElementById('header-root');
const mainRoot = document.getElementById('main');

/** 해시에서 경로만 뽑는다 (`#/copy` → `/copy`) */
function currentPath() {
  const raw = location.hash.replace(/^#/, '');
  return ROUTES[raw] ? raw : '/';
}

function route() {
  const raw = location.hash.replace(/^#/, '');
  if (MOVED[raw]) { location.replace(`#${MOVED[raw]}`); return; }

  const path = currentPath();
  const page = ROUTES[path];

  // 접근 조건 확인 — 조건 미달이면 지정한 경로로 되돌린다
  const redirect = page.guard?.();
  if (redirect) {
    location.replace(`#${redirect}`);
    return;
  }

  renderHeader(headerRoot, path);
  mainRoot.innerHTML = '';
  page.render(mainRoot);

  document.title = `${page.title} · 브랜드 SNS 스튜디오`;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', route);

// 해시가 없으면 기본 경로를 채워 넣고 시작
if (!location.hash) location.replace('#/');
route();
