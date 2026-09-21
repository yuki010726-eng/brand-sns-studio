/** 토스트 — aria-live 영역에 넣어 스크린리더에도 전달된다 */

const root = () => {
  if (typeof document === "undefined") return null;

  const existing = document.getElementById("toast-root");
  if (existing) return existing;

  // Some transitional/loading views do not render their local toast root.
  // Keep notifications non-fatal while those views are mounted.
  const fallback = document.createElement("div");
  fallback.id = "toast-root";
  fallback.className = "toast-root";
  fallback.setAttribute("role", "status");
  fallback.setAttribute("aria-live", "polite");
  document.body.appendChild(fallback);
  return fallback;
};

/**
 * @param {string} message
 * @param {number} [ms] 유지 시간
 */
export function toast(message, ms = 2200) {
  console.log('[toast]', message);

  const container = root();
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
