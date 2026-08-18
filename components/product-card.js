/**
 * 상품 선택 카드
 * 접근성: 시각적으로 숨긴 radio + label 구조라 화살표 키 이동·스크린리더 안내가 그대로 동작한다.
 */
import { icon } from '../assets/icons.js';

/**
 * @param {object} p
 * @param {boolean} checked
 */
export function productCardHTML(p, checked) {
  return `
    <div class="product-card">
      <input class="sr-only product-card__input" type="radio" name="product"
             id="product-${p.id}" value="${p.id}" autocomplete="off" ${checked ? 'checked' : ''}
             aria-label="${p.name} — ${p.tagline}" />
      <label class="product-card__body card card--hover" for="product-${p.id}">
        <span class="product-card__top">
          <span class="product-card__icon" aria-hidden="true">${icon(p.icon)}</span>
          <span class="product-card__check" aria-hidden="true">${icon('check', 'icon--sm')}</span>
        </span>
        <span class="product-card__name">${p.name}</span>
        <span class="product-card__tagline">${p.tagline}</span>
        <span class="product-card__meta">
          <span class="badge badge--neutral">${p.intake}</span>
          <span class="product-card__handle">${p.handle}</span>
        </span>
      </label>
    </div>`;
}
