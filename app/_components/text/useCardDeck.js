"use client";

/**
 * 상품·주제·톤 등 지금 조건으로 카드뉴스 덱을 세우고, 카드별 미리보기 썸네일(PNG data URL)을
 * 그려 낸다. 블로그 미리보기(`NaverBlogPreview`)의 이미지 자리와 인스타그램 캐러셀
 * 미리보기(`InstagramPostPreview`)가 **같은 덱·같은 썸네일**을 봐야 카드 번호가 어긋나지
 * 않으므로, 계산을 이 훅 하나에 모아 두고 `CopyEditor`가 양쪽에 같은 결과를 내려준다.
 *
 * ⚠️ 캔버스로 그릴 수 있는 컨셉(매거진형·카드형·노트형)만 실제 카드 이미지를 미리
 *    그린다(`canGenerateImage`) — 직관형(promptOnly, 광고 프롬프트 전용)은 캔버스 자체가
 *    없어 아직 이 단계에서 미리 볼 이미지가 없다. `deck`이 비어 있으면 각 미리보기가
 *    알아서 자리표시자를 보여준다.
 */
import { useEffect, useMemo, useState } from "react";
import { canGenerateImage } from "../../../lib/imagegen.js";
import { baseOf, buildPreviewDeck } from "../../template/_lib/deckBuilder.js";
import { renderCard, loadImage, ensureFonts, W, H } from "../../../lib/cardrender.js";
import { draftKeyOf } from "../../../store.js";
import { getImage, imageKey } from "../../../lib/imagestore.js";

export function useCardDeck(state, product, { suspendThumbs = false } = {}) {
  const [cardThumbs, setCardThumbs] = useState({});

  // 지금 상품·주제·톤·장수·템플릿(`draftKeyOf`)과 담당자가 3단계에서 손으로 고친 문구가
  // 둘 다 맞아떨어질 때만 그 문구를 미리보기에 쓴다 — 하나라도 다르면 다른 게시물/템플릿에서
  // 남은 값이라 기본값으로 그린다.
  const savedCard =
    state && state.card?.key === draftKeyOf(state) && state.card.concept === state.concept
      ? state.card
      : null;

  const previewable = Boolean(state && product && canGenerateImage(state.concept));
  const hasDeck = Boolean(state && product);

  const deckSignature = useMemo(() => {
    if (!hasDeck) return "";
    return JSON.stringify({
      productId: state.productId,
      concept: state.concept,
      cardCount: state.cardCount,
      topic: state.topic,
      tone: state.tone,
      variant: state.image?.variant ?? 0,
      outlineKey: state.outline?.key,
      postId: state.postId,
      cardTheme: state.cardTheme,
      noteSymbol: state.noteSymbol,
      notePaper: state.notePaper,
      noteInk: state.noteInk,
      noteGrain: state.noteGrain,
      cardCopy: state.cardCopy,
      blogDraft: state.drafts?.blog,
      savedCard,
      images: state.images,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 위 문자열이 곧 의존값이다
  }, [hasDeck, state, savedCard]);

  // `deckSignature` 가 같으면 늘 같은 덱이 나온다(순수 함수) — 카드 편집 모달도 이 배열을
  // 그대로 받아써야 미리보기 썸네일과 모달 안 카드 번호가 어긋나지 않는다.
  const deck = useMemo(() => {
    if (!deckSignature) return [];
    return buildPreviewDeck(state, product);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deckSignature 가 진짜 의존값이다
  }, [deckSignature]);

  useEffect(() => {
    if (!deckSignature) {
      setCardThumbs({});
      return undefined;
    }
    if (suspendThumbs) return undefined;
    let cancelled = false;
    (async () => {
      if (!previewable) {
        const next = {};
        for (let i = 0; i < deck.length; i += 1) {
          const blob = await getImage(imageKey(state.productId, state.concept, i, state.postId)).catch(() => null);
          if (cancelled) return;
          if (blob) next[i] = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        }
        if (!cancelled) setCardThumbs(next);
        return;
      }
      await ensureFonts();
      const base = baseOf(state.concept, deck, product, []);
      const savedTexts = savedCard?.texts;

      const next = {};
      for (let i = 0; i < deck.length; i += 1) {
        if (cancelled) return;
        const texts = savedTexts?.[i] || base[i];
        const blob = await getImage(
          imageKey(state.productId, state.concept, i, state.postId),
        ).catch(() => null);
        const bitmap = blob ? await loadImage(blob).catch(() => null) : null;
        if (cancelled) return;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        renderCard(canvas, texts, {
          conceptId: state.concept,
          kind: deck[i].kind,
          image: bitmap,
          accent: state.accent,
          cardTheme: state.cardTheme,
          mark: state.mark,
          noteSymbol: state.noteSymbol,
          notePaper: state.notePaper,
          noteInk: state.noteInk,
          noteGrain: state.noteGrain,
          // 블로그/인스타 썸네일도 제작 화면과 같은 매거진 하위 템플릿과
          // 추가 텍스트 상자를 그려야, 클릭해서 연 모달과 내용이 어긋나지 않는다.
          magazineTemplate: state.magazineTemplate,
          layout: savedCard?.layout?.[i] || {},
          extraTexts: savedCard?.extraTexts?.[i] || [],
        });
        next[i] = canvas.toDataURL("image/png");
      }
      if (!cancelled) setCardThumbs(next);
    })().catch(() => {
      if (!cancelled) setCardThumbs({});
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deckSignature 가 진짜 의존값이다
  }, [deckSignature, suspendThumbs]);

  // `cardThumbs`를 실제로 그릴 때 쓴 상태도 함께 내보낸다. 모달이 전역 상태를
  // 다시 조합하는 사이 문구가 바뀌어, 눌렀던 미리보기와 다른 카드가 열리는 일을 막는다.
  return { deck, cardThumbs, previewable, previewCard: savedCard };
}
