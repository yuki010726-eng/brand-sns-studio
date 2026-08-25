import { getUser, signIn, signUp, signOut, usernameOf } from '../lib/auth.js';
import { isConfigured } from '../lib/supabase.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';

const SIGNUP_COMPLETE_MESSAGE = '회원가입 요청이 정상적으로 처리되었습니다. 관리자가 확인하여 승인 후 로그인이 가능합니다.';
const SIGNUP_EMAIL_CONFIRM_MESSAGE = '회원가입이 완료되었습니다. 이메일 확인을 마친 뒤 관리자의 승인을 기다려 주세요.';
const APPROVAL_PENDING_MESSAGE = '관리자가 확인 중에 있습니다. 승인이 완료된 후 로그인이 가능합니다.';
const APPROVAL_REJECTED_MESSAGE = '가입이 승인되지 않았습니다. 계정 상태는 관리자에게 문의해 주세요.';

export const title = '로그인';

/** 상단 로고 + 왼쪽 아트 — 로그인·회원가입·상태 화면이 전부 공유하는 껍데기 */
function shellHTML(inner) {
  return `
    <section class="login-page" aria-labelledby="login-title">
      <div class="login-brand" aria-hidden="true">
        <img src="assets/logos/logo.svg" alt="브랜드 SNS 스튜디오 로고" />
      </div>
      <div class="login-stage">
        <img class="login-art" src="assets/img/login.png" alt="" aria-hidden="true" />
        ${inner}
      </div>
    </section>`;
}

export function render(root) {
  const configured = isConfigured();
  const user = getUser();
  if (user && user.status !== 'approved') return renderStatus(root, user);

  root.innerHTML = shellHTML(`
    <div class="login-card">
      <h1 id="login-title">로그인</h1>
      <p class="login-card__desc">승인된 계정으로 로그인해 주세요.</p>
      <div class="login-tabs" role="tablist" aria-label="계정 메뉴">
        <button class="login-tabs__tab is-active" id="login-tab" type="button" role="tab" aria-selected="true">로그인</button>
        <button class="login-tabs__tab" id="signup-tab" type="button" role="tab" aria-selected="false">회원가입</button>
      </div>
      <form class="login-form" id="login-form">
        <label class="login-field">
          <span class="login-field__label">아이디</span>
          <input class="login-input" name="username" type="text" autocomplete="username" required maxlength="64" pattern="[A-Za-z0-9.!#$%&amp;'*+/=?^_{|}~-]+" title="이메일 도메인을 제외한 아이디만 입력해 주세요" placeholder="아이디를 입력해 주세요" />
        </label>
        <label class="login-field">
          <span class="login-field__label">비밀번호</span>
          <input class="login-input" name="password" type="password" autocomplete="current-password" minlength="6" required placeholder="비밀번호를 입력해 주세요" />
        </label>
        <p class="login-form__error" id="login-error" role="alert" aria-live="polite" hidden></p>
        <button class="login-submit__final" type="submit" ${configured ? '' : 'disabled'}>로그인</button>
      </form>
      <form class="login-form" id="signup-form" hidden>
        <label class="login-field">
          <span class="login-field__label">아이디</span>
          <input class="login-input" name="username" type="text" autocomplete="username" required maxlength="64" pattern="[A-Za-z0-9.!#$%&amp;'*+/=?^_{|}~-]+" title="이메일 도메인을 제외한 아이디만 입력해 주세요" placeholder="사용할 아이디를 입력해 주세요" />
        </label>
        <label class="login-field">
          <span class="login-field__label">이름</span>
          <input class="login-input" name="name" type="text" autocomplete="name" maxlength="50" required placeholder="이름을 입력해 주세요" />
        </label>
        <label class="login-field">
          <span class="login-field__label">비밀번호</span>
          <input class="login-input" name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="비밀번호를 입력해 주세요" />
        </label>
        <button class="login-submit__final" type="submit" ${configured ? '' : 'disabled'}>회원가입</button>
        <p class="login-card__hint">가입 후 관리자의 승인이 완료되어야 서비스를 이용할 수 있습니다.</p>
      </form>
      ${configured ? '' : '<p class="login-card__notice" role="alert">Supabase 연결 정보가 설정되지 않았습니다.</p>'}
    </div>`);
  bindTabs(root);
  bindForms(root);
}

function renderStatus(root, user) {
  const rejected = user.status === 'rejected';
  const profileError = Boolean(user.profileError);
  const statusTitle = profileError
    ? '승인 상태를 확인하지 못했습니다'
    : rejected ? '가입이 승인되지 않았습니다' : '관리자 승인 대기 중입니다';
  const description = profileError
    ? '잠시 후 다시 확인해 주세요. 계속되면 users 테이블의 계정 ID와 RLS 정책을 확인해 주세요.'
    : rejected ? '계정 상태에 관한 문의는 관리자에게 연락해 주세요.' : '승인이 완료된 후 상태를 다시 확인해 주세요.';

  root.innerHTML = shellHTML(`
    <div class="login-card">
      <h1 id="login-title">${statusTitle}</h1>
      <p class="login-card__desc">${description}</p>
      <p class="login-card__account">${escapeHtml(usernameOf(user.email))}</p>
      <div class="login-status__actions">
        <button class="login-submit" id="status-refresh" type="button">상태 다시 확인</button>
        <button class="login-submit login-submit--ghost" id="status-logout" type="button">로그아웃</button>
      </div>
    </div>`);
  root.querySelector('#status-refresh').addEventListener('click', () => location.reload());
  root.querySelector('#status-logout').addEventListener('click', () => signOut());
}

function bindTabs(root) {
  const loginTab = root.querySelector('#login-tab');
  const signupTab = root.querySelector('#signup-tab');
  const loginForm = root.querySelector('#login-form');
  const signupForm = root.querySelector('#signup-form');
  const select = (signup) => {
    loginForm.hidden = signup; signupForm.hidden = !signup;
    showLoginError(loginForm, '');
    loginTab.classList.toggle('is-active', !signup); signupTab.classList.toggle('is-active', signup);
    loginTab.setAttribute('aria-selected', String(!signup)); signupTab.setAttribute('aria-selected', String(signup));
  };
  loginTab.addEventListener('click', () => select(false));
  signupTab.addEventListener('click', () => select(true));
}

function bindForms(root) {
  const loginForm = root.querySelector('#login-form');
  loginForm.addEventListener('input', () => showLoginError(loginForm, ''));
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget; const button = form.querySelector('button[type="submit"]'); const values = new FormData(form);
    showLoginError(form, '');
    setBusy(button, true, '로그인 중…');
    const { error, errorType, status } = await signIn(values.get('username'), values.get('password'));
    if (errorType === 'credentials' || errorType === 'email_unconfirmed') { setBusy(button, false, '로그인'); showLoginError(form, error); }
    else if (error) { setBusy(button, false, '로그인'); toast(`로그인에 실패했습니다: ${error}`, 5000); }
    else if (status === 'rejected') { setBusy(button, false, '로그인'); modal(APPROVAL_REJECTED_MESSAGE); }
    else if (status !== 'approved') { setBusy(button, false, '로그인'); modal(APPROVAL_PENDING_MESSAGE); }
  });
  root.querySelector('#signup-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget; const button = form.querySelector('button[type="submit"]'); const values = new FormData(form);
    setBusy(button, true, '가입 중…');
    const result = await signUp(values.get('username'), values.get('password'), values.get('name'));
    if (result.error) { setBusy(button, false, '회원가입'); toast(`회원가입에 실패했습니다: ${result.error}`, 5000); return; }
    setBusy(button, false, '회원가입');
    form.reset();
    modal(result.needsEmailConfirmation ? SIGNUP_EMAIL_CONFIRM_MESSAGE : SIGNUP_COMPLETE_MESSAGE);
  });
}

function showLoginError(form, message) {
  const error = form.querySelector('#login-error');
  error.textContent = message;
  error.hidden = !message;
}

function setBusy(button, busy, label) { button.disabled = busy; button.textContent = label; }
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
