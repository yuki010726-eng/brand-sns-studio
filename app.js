/**
 * 앱 진입점 — 해시 라우터
 * 각 페이지 모듈은 render(root) 를 내보내고, 선택적으로 guard() 로 접근 조건을 정한다.
 */
import { renderHeader } from './components/header.js';
import { initAuth, onAuth } from './lib/auth.js';
import { pull, applyRemote } from './lib/sync.js';
import { setState } from './store.js';
import { toast } from './components/toast.js';
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

onAuth((user) => {
  if (!user) { restored = false; return; }
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
route();

// 화면을 그린 뒤에 조용히 로그인 상태를 복구한다.
// 먼저 기다렸다가 그리면, 설정이 없거나 네트워크가 막힌 환경에서 흰 화면이 뜬다.
initAuth();
