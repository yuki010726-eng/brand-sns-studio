/** 4단계 — 템플릿 카드뉴스 에디터 · STEP 4에서 구현 */
import { makeStubPage } from './_stub.js';
import { getState } from '../store.js';

const page = makeStubPage({
  path: '/template',
  title: '카드뉴스 템플릿',
  iconName: 'layout',
  desc: '만든 이미지 위에 하고 싶은 문구를 자유롭게 얹어 카드뉴스를 완성합니다. (STEP 4에서 구현)',
});

export const title = page.title;
export const render = page.render;

export function guard() {
  const s = getState();
  return s.productId && s.topic.trim() ? null : '/';
}
