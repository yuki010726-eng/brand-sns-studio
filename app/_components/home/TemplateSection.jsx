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
import { AD_CONCEPTS, adConceptForTone } from "../../../lib/adprompt.js";
import { toast } from "../../../components/toast.js";
import { ConceptPicker } from "../../template/_components/ConceptPicker.jsx";

export function TemplateSection({ product, state, onUpdate }) {
  const hasTopic = state.topic.trim().length >= 2;
  // An empty array is an intentional "nothing selected" state. Only use the
  // legacy single-value fallback when the array does not exist at all.
  const selectedIds = (Array.isArray(state.concepts)
    ? state.concepts
    : [state.concept]
  ).filter((id) => CONCEPTS.some((concept) => concept.id === id));
  const adSelectedIds = (Array.isArray(state.adConcepts)
    ? state.adConcepts
    : [state.adConcept || adConceptForTone(state.tone)]
  ).filter((id) => AD_CONCEPTS.some((concept) => concept.id === id));

  function handleChange(id) {
    const alreadySelected = selectedIds.includes(id);
    const concepts = alreadySelected
      ? selectedIds.filter((conceptId) => conceptId !== id)
      : [...selectedIds, id];
    const concept =
      alreadySelected && state.concept === id
        ? concepts[concepts.length - 1]
        : id;
    onUpdate({ concept, concepts });
    toast(
      alreadySelected
        ? `${getConcept(id).name} 템플릿 선택을 해제했습니다.`
        : `${getConcept(id).name} 템플릿을 추가했습니다.`,
    );
  }

  function handleAdSelectionChange(ids) {
    onUpdate({
      adConcept: ids[0] || "",
      adConcepts: ids,
      adConceptTone: state.tone,
    });
  }

  return (
    <section className="flex flex-col gap-7" aria-labelledby="template-heading">
      {product ? (
        <fieldset
          className={`min-w-0 border-0 transition ${hasTopic ? "" : "pointer-events-none opacity-[0.38] grayscale-[0.35]"}`}
          disabled={!hasTopic}
          aria-disabled={!hasTopic}
        >
          <legend className="sr-only">카드뉴스 템플릿 선택</legend>
          <div className="mb-6 rounded-[15px] border border-white/20 bg-white/10 px-5 py-4">
            <p className="text-[15px] font-bold text-white">이미지 장수</p>
            <p className="mt-1 text-[14px] text-white/70">
              만들 이미지 수를 선택해 주세요.
            </p>
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="카드뉴스 장수 선택"
            >
              {[4, 5, 6].map((count) => {
                const checked = Number(state.cardCount) === count;
                return (
                  <label
                    key={count}
                    className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-[9px] text-[15px] font-medium transition ${
                      checked
                        ? "border-[#287aff] bg-[#287aff] font-bold text-white"
                        : "border-white/40 bg-white text-[#4e5968] hover:border-white"
                    }`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="card-count"
                      value={count}
                      checked={checked}
                      onChange={() => onUpdate({ cardCount: count })}
                    />
                    {count}장
                  </label>
                );
              })}
            </div>
          </div>
          <p className="mb-3 text-[14px] text-white/75">
            템플릿을 여러 개 선택할 수 있습니다.
          </p>
          <ConceptPicker
            concepts={CONCEPTS}
            value={state.concept}
            selectedIds={selectedIds}
            onChange={handleChange}
            adSelectedIds={adSelectedIds}
            onAdSelectionChange={handleAdSelectionChange}
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
