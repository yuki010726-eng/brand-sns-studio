/**
 * `renderCard()` 로 실제 캔버스를 그릴 수 있는 컨셉인지 가리는 값. AI가 실제로 이미지를
 * 만들어 주던 기능(2026-09-07)은 필요 없다는 요청자 판단으로 다시 뗐다(2026-09-08,
 * `app/template/_components/ImagePanel.jsx` · `app/template/page.jsx` 참고) — 이제
 * 모든 컨셉이 프롬프트 복사 + 파일 올리기만 쓴다.
 *
 * 이 값은 여전히 남겨 둔다 — `NaverBlogPreview.jsx` 가 "블로그 미리보기의 카드뉴스
 * 이미지 자리를 실제 캔버스로 그려 보여줄지"를 판단하는 데 쓴다.
 *
 * ⚠️ 하드코딩된 id 목록(`['card', 'note']`) 대신 `concept.promptOnly` 로 판단한다.
 *    캔버스 자체가 없는 직관형(`promptOnly: true`)만 빠지면 되는데, 목록으로 관리하면
 *    새 컨셉을 추가할 때마다 여기도 같이 고쳐야 한다 — 실제로 **기본 템플릿인 매거진형이
 *    빠진 채로 남아 있어서**, 블로그 미리보기의 카드뉴스 이미지 자리를 눌러도 모달이
 *    안 열리는 버그가 있었다(썸네일이 없어 클릭 대상 자체가 안 그려졌다).
 */
import { CONCEPTS } from './concepts.js';

export const AI_IMAGE_CONCEPTS = CONCEPTS.filter((c) => !c.promptOnly).map((c) => c.id);
export const canGenerateImage = (conceptId) =>
  Boolean(CONCEPTS.find((c) => c.id === conceptId && !c.promptOnly));
