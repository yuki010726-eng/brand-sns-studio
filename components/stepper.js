/** 4단계 진행 표시 — 도달하지 않은 단계는 disabled 로 막는다 */
import { icon } from '../assets/icons.js';
import { STEPS, reachedStep, navigate } from '../store.js';

/**
 * @param {string} currentPath
 * @returns {string} HTML
 */
export function stepperHTML(currentPath) {
  const reached = reachedStep();

  const items = STEPS.map((step, i) => {
    const isCurrent = step.path === currentPath;
    const isDone = step.n < reached && !isCurrent;
    const locked = step.n > reached;

    return `
      ${i > 0 ? `<span class="stepper__sep" aria-hidden="true">${icon('chevronRight', 'icon--sm')}</span>` : ''}
      <button type="button"
              class="stepper__item${isDone ? ' stepper__item--done' : ''}"
              data-step-path="${step.path}"
              ${isCurrent ? 'aria-current="step"' : ''}
              ${locked ? 'disabled' : ''}
              aria-label="${step.n}단계 ${step.label}${locked ? ' (아직 진행할 수 없음)' : ''}">
        <span class="stepper__num" aria-hidden="true">${isDone ? '✓' : step.n}</span>
        <span>${step.label}</span>
      </button>`;
  }).join('');

  return `<nav class="stepper" aria-label="게시물 제작 단계">${items}</nav>`;
}

/** 스테퍼 클릭 위임 — 페이지 렌더 후 한 번 호출 */
export function bindStepper(scope) {
  scope.querySelectorAll('[data-step-path]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.stepPath));
  });
}
