/**
 * 상품 선택 리스트 항목 (Figma jRjBo4LUHkohSoPRqSaEAv, node 8:3 「상품 리스트」)
 * 접근성: 시각적으로 숨긴 radio + label 구조라 화살표 키 이동·스크린리더 안내가 그대로 동작한다.
 */
import { icon } from '../assets/icons.js';

/**
 * @param {object} p
 * @param {boolean} checked
 */
export function productCardHTML(p, checked) {
  return `
    <div class="prod-item">
      <input class="sr-only prod-item__input" type="radio" name="product"
             id="product-${p.id}" value="${p.id}" autocomplete="off" ${checked ? 'checked' : ''}
             aria-label="${p.name} — ${p.tagline}" />
      <label class="prod-item__body" for="product-${p.id}">
        <span class="prod-item__icon" aria-hidden="true">${icon(p.icon)}</span>
        <span class="prod-item__name">${p.name}</span>
        <span class="prod-item__check" aria-hidden="true">${icon('check', 'icon--sm')}</span>
      </label>
    </div>`;
}
