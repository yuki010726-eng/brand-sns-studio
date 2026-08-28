/** 토스트 — aria-live 영역에 넣어 스크린리더에도 전달된다 */

const root = () => document.getElementById('toast-root');

/**
 * @param {string} message
 * @param {number} [ms] 유지 시간
 */
export function toast(message, ms = 2200) {
  console.log('[toast]', message);

  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  root().appendChild(el);
  setTimeout(() => el.remove(), ms);
}
