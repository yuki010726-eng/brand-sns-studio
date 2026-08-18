/**
 * STEP 1 단계의 임시 페이지 골격.
 * 라우팅·가드·스테퍼가 실제로 동작하는지 확인하기 위한 자리표시자이며,
 * STEP 2~4에서 각 페이지 파일이 자체 render() 로 대체한다.
 */
import { icon } from '../assets/icons.js';
import { stepperHTML, bindStepper } from '../components/stepper.js';
import { getProduct } from '../lib/products.js';
import { getState, navigate } from '../store.js';

/**
 * @param {{path:string, title:string, iconName:string, desc:string, next?:string}} cfg
 */
export function makeStubPage(cfg) {
  return {
    title: cfg.title,
    render(root) {
      const s = getState();
      const p = getProduct(s.productId);

      root.innerHTML = `
        <div class="container">
          ${stepperHTML(cfg.path)}
          <section class="section">
            <div class="card empty stub">
              ${icon(cfg.iconName, 'icon--lg')}
              <h2>${cfg.title}</h2>
              <p>${cfg.desc}</p>
              ${p ? `
                <p class="stub__ctx">
                  선택한 상품 <strong>${p.name}</strong> · 주제 <strong>${s.topic || '(없음)'}</strong>
                </p>` : ''}
              <div class="stub__actions">
                <button type="button" class="btn btn--ghost" id="stub-back" aria-label="이전 화면으로 돌아가기">
                  ${icon('arrowLeft', 'icon--sm')} 이전
                </button>
                ${cfg.next ? `
                  <button type="button" class="btn" id="stub-next" aria-label="다음 단계로 이동">
                    다음 ${icon('arrowRight', 'icon--sm')}
                  </button>` : ''}
              </div>
            </div>
          </section>
        </div>`;

      bindStepper(root);
      root.querySelector('#stub-back')?.addEventListener('click', () => history.back());
      root.querySelector('#stub-next')?.addEventListener('click', () => navigate(cfg.next));
    },
  };
}
