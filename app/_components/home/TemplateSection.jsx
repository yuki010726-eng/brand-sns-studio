"use client";

/**
 * 3. 카드뉴스 템플릿 선택 (2026-09-08, 요청자 지시)
 *
 * 예전에는 카드뉴스 템플릿(컨셉)을 글귀를 다 만든 뒤 `/template` 화면에서만 고를 수
 * 있었다. 그래서 `/template` 에 들어올 때마다 마지막 선택과 무관하게 항상 매거진형부터
 * 보여 줬다(옛 `app/template/page.jsx` 의 강제 초기화). 지금은 조건을 고르는 시점
 * (상품·주제 다음)에 템플릿까지 함께 정하고, 미리보기(`useCardDeck`)와 이후 `/template`
 * 화면이 그 선택을 그대로 이어받는다 — 매거진형 강제 초기화는 걷어냈다.
 *
 * 화면은 `/template` 의 `ConceptPicker` 를 그대로 재사용한다. 컨셉마다 다른 미리보기
 * 이미지·설명을 이미 갖고 있어서 여기서 새로 만들 이유가 없다.
 */
import { CONCEPTS, getConcept } from "../../../lib/concepts.js";
import { toast } from "../../../components/toast.js";
import { ConceptPicker } from "../../template/_components/ConceptPicker.jsx";

export function TemplateSection({ product, state, onUpdate }) {
  const hasTopic = state.topic.trim().length >= 2;

  function handleChange(id) {
    onUpdate({ concept: id });
    toast(`${getConcept(id).name} 템플릿으로 골랐습니다.`);
  }

  return (
    <section className="flex flex-col gap-7" aria-labelledby="template-heading">
      <h2
        id="template-heading"
        className="text-[25px] font-bold leading-[1.35] text-white max-sm:text-[22px]"
      >
        3. 카드뉴스 템플릿을 선택해주세요.
      </h2>
      {product ? (
        <fieldset
          className={`min-w-0 border-0 transition ${hasTopic ? "" : "pointer-events-none opacity-[0.38] grayscale-[0.35]"}`}
          disabled={!hasTopic}
          aria-disabled={!hasTopic}
        >
          <legend className="sr-only">카드뉴스 템플릿 선택</legend>
          <ConceptPicker
            concepts={CONCEPTS}
            value={state.concept}
            onChange={handleChange}
          />
        </fieldset>
      ) : (
        <div className="grid min-h-[180px] place-items-center rounded-[15px] bg-white/10 px-5 text-center text-[14px] text-white/60">
          상품을 선택하면 템플릿 선택이 열립니다.
        </div>
      )}
    </section>
  );
}
