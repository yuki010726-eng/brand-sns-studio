/** 보관함 — 검색·필터·정렬이 들어갈 페이지 · STEP 5에서 구현 */
import { icon } from '../assets/icons.js';

export const title = '보관함';

export function render(root) {
  root.innerHTML = `
    <div class="container">
      <section class="section">
        <div class="section__head">
          <h1>내 게시물 보관함</h1>
          <p class="section__desc">만든 게시물을 키워드로 검색하고 상품·채널로 필터링합니다.</p>
        </div>
        <div class="card empty stub">
          ${icon('search', 'icon--lg')}
          <h2>검색 · 필터 · 정렬</h2>
          <p>키워드 검색과 상품별·채널별 필터, 최신순/이름순 정렬이 이 화면에 들어갑니다. (STEP 5에서 구현)</p>
          <div class="stub__actions">
            <a class="btn" href="#/" aria-label="새 게시물 만들기 화면으로 이동">새 게시물 만들기</a>
          </div>
        </div>
      </section>
    </div>`;
}
