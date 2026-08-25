/**
 * 앱 진입점 — 해시 라우터
 * 각 페이지 모듈은 render(root) 를 내보내고, 선택적으로 guard() 로 접근 조건을 정한다.
 */
import { renderHeader } from './components/header.js';
import { loadLocalConfig } from './lib/localconfig.js';
import { detect } from './lib/serverapi.js';
import { initAuth, onAuth, getUser } from './lib/auth.js';
import { pull, applyRemote } from './lib/sync.js';
import { setState } from './store.js';
import { toast } from './components/toast.js';
import { loadProducts } from './lib/products.js';
import * as ProfilePage from './pages/profile.js';
import * as HomePage from './pages/home.js';
import * as CopyPage from './pages/copy.js';
import * as TemplatePage from './pages/template.js';
import * as LibraryPage from './pages/library.js';
import * as LoginPage from './pages/login.js';
import * as ResearchPage from './pages/research.js';
import * as ProductsAdminPage from './pages/products-admin.js';

const ROUTES = {
  '/login': LoginPage,
  '/profile': ProfilePage,
  '/': HomePage,
  '/copy': CopyPage,
  '/template': TemplatePage,
  '/library': LibraryPage,
  '/research': ResearchPage,
  '/products-admin': ProductsAdminPage,
};

const LOGIN_PATH = '/login';
const RETURN_PATH_KEY = 'auth:return-path';
let authReady = false;

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

  // 인증 확인 전에는 보호된 화면을 잠깐이라도 노출하지 않는다.
  if (!authReady) return;

  const user = getUser();
  const hasAccess = user?.status === 'approved';
  if (!hasAccess && path !== LOGIN_PATH) {
    sessionStorage.setItem(RETURN_PATH_KEY, path);
    location.replace(`#${LOGIN_PATH}`);
    return;
  }

  if (hasAccess && path === LOGIN_PATH) {
    const savedPath = sessionStorage.getItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(RETURN_PATH_KEY);
    // 프로필은 게시물 제작 단계가 아닌 독립 탭이다. 로그인 후에는 새 게시물로 보낸다.
    const fallback = '/';
    const destination = savedPath && ROUTES[savedPath] && savedPath !== LOGIN_PATH ? savedPath : fallback;
    location.replace(`#${destination}`);
    return;
  }

  // 접근 조건 확인 — 조건 미달이면 지정한 경로로 되돌린다
  const redirect = page.guard?.();
  if (redirect) {
    location.replace(`#${redirect}`);
    return;
  }

  if (path === LOGIN_PATH) {
    headerRoot.innerHTML = '';
    document.body.classList.add('is-login-page');
  } else {
    document.body.classList.remove('is-login-page');
    renderHeader(headerRoot, path);
  }
  // 1·2단계는 Figma jRjBo4LUHkohSoPRqSaEAv node 8:3 을 반영한 다크 워크스페이스 화면이다
  // (styles/pages.css 의 `.workshop`). 로그인 화면이 body.is-login-page 를 쓰는 것과 같은 방식.
  document.body.classList.toggle('is-home-page', path === '/' || path === '/copy');
  mainRoot.innerHTML = '';
  page.render(mainRoot);

  document.title = `${page.title} · 브랜드 SNS 스튜디오`;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/**
 * 로그인 복구 → 서버에 저장된 작업 내용 불러오기.
 *
 * ⚠️ 화면을 먼저 그리고 나서 조용히 진행한다. 로그인 확인을 기다리느라 흰 화면을 보여주면
 *    설정이 없거나 네트워크가 막힌 환경에서 앱이 멈춘 것처럼 보인다.
 * ⚠️ 서버에 내용이 있으면 그걸 쓴다. 기기를 옮겨 왔다는 뜻이기 때문이다.
 *    다만 로그인 **직후 한 번만** 받아온다 — 이후에는 이 기기가 기준이다.
 */
// 로그인 상태가 잡히면(복구든 새 로그인이든) 그때 한 번 받아온다.
// initAuth() 안에서도 onAuth 가 울리므로, 불러오기는 여기 한 곳에만 둔다 — 두 번 받지 않게.
let restored = false;

onAuth(async (user) => {
  if (!authReady) return;
  if (user?.status !== 'approved') {
    restored = false;
    route();
    return;
  }

  const path = currentPath();
  if (path === '/products-admin' && user?.role !== 'admin') {
    location.replace('#/');
    return;
  }

  // 비로그인 상태로 앱을 연 뒤 로그인한 경우에도 이 시점에 상품 원본을 받는다.
  await loadProducts();
  route();
  if (restored) return;
  restored = true;

  pull().then((remote) => {
    if (!remote || !Object.keys(remote.state).length) return;
    applyRemote(remote.state, setState);
    route();
    toast('다른 기기에서 저장한 작업을 불러왔습니다.', 4000);
  });
});

window.addEventListener('hashchange', route);

// 해시가 없으면 기본 경로를 채워 넣고 시작
if (!location.hash) location.replace('#/');

/**
 * 인증 상태 확인이 끝난 뒤 로그인 또는 보호된 화면을 그린다.
 *
 * ⚠️ `loadLocalConfig()` 와 `detect()` 를 **첫 렌더 전에** 끝내야 한다. `hasKey()` ·
 *    `isServerMode()` 가 동기 함수이고 화면 곳곳에서 조건문으로 쓰이기 때문이다 — 늦게 읽히면
 *    키가 있는데도 「키를 넣어 주세요」가 한 번 그려졌다가 바뀐다.
 *    설정 파일이 없거나 `/api` 가 없어도(로컬 실행) 실패하지 않는다(빈 값 · 로컬 모드로 진행).
 */
Promise.all([loadLocalConfig(), initAuth(), detect()]).finally(async () => {
  // products RLS는 로그인 세션과 승인 상태를 확인하므로 인증 복구 뒤에 읽는다.
  await loadProducts();
  authReady = true;
  route();
});
