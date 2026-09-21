"use client";

import { ConceptPicker } from "./ConceptPicker.jsx";
import { ProductSection } from "../../_components/home/ProductSection.jsx";
import { Icon } from "../../_components/Icon.jsx";
import { CONCEPTS, IMAGE_TOPIC_CONCEPT_IDS } from "../../../lib/concepts.js";

const IMAGE_TOPIC_CONCEPTS = IMAGE_TOPIC_CONCEPT_IDS
  .map((id) => CONCEPTS.find((concept) => concept.id === id))
  .filter(Boolean);

/** 이미지 탭에서 글 작성 흐름 없이 바로 시작할 때 쓰는 최소 설정 화면입니다. */
export function ImagePostSetup({
  loading,
  products,
  productId,
  topic,
  presets,
  presetsLoading,
  concept,
  selectedConceptIds,
  onProductChange,
  onTopicChange,
  onRefreshPresets,
  onConceptSelectionChange,
  onConceptPreviewChange,
  onStart,
  generating = false,
  expanded = true,
  onToggle,
}) {
  const ready = Boolean(
    productId && topic.trim().length >= 2 && selectedConceptIds.length > 0,
  );
  const hasTopic = topic.trim().length >= 2;
  const productName = products.find((product) => product.id === productId)?.name;
  const templateNames = IMAGE_TOPIC_CONCEPTS
    .filter((item) => selectedConceptIds.includes(item.id))
    .map((item) => item.name)
    .join(", ");

  return (
    <section
      className="relative overflow-hidden rounded-[15px] bg-white p-6 text-[#4e5968] shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
      aria-busy={generating}
    >
      <div className={`${expanded ? "mb-6 border-b border-[#e5e8eb] pb-5" : ""} flex items-center justify-between gap-4`}>
        <h3 className="pl-2.5 text-[18px] font-bold text-[#191f28]">
          이미지 주제 설정
        </h3>
        {!expanded && (
          <dl className="flex min-w-0 flex-1 items-center justify-end gap-x-6 gap-y-2 max-[760px]:gap-x-3 max-sm:flex-wrap max-sm:justify-start">
            {[
              { label: "상품", value: productName },
              { label: "주제", value: topic.trim() },
              { label: "템플릿", value: templateNames },
            ].map(({ label, value }) => (
              <div key={label} className="flex min-w-0 items-center gap-2 text-[14px] leading-[1.3]">
                <dt className="shrink-0 font-bold text-[#333d4b]">{label}</dt>
                <dd className="min-w-0 truncate text-[#6b7684]" title={value || "-"}>
                  {value || "-"}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="inline-flex h-[38px] shrink-0 items-center gap-[5px] text-[14px] font-medium text-[#4e5968] transition hover:text-[#191f28]"
          >
            <Icon
              name="chevronDown"
              className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "접기" : "펼치기"}
          </button>
        )}
      </div>

      {expanded && <>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <ProductSection
            loading={loading}
            products={products}
            selectedId={productId}
            onSelect={onProductChange}
          />
          <div
            className={
              !productId
                ? "pointer-events-none opacity-[0.38] grayscale-[0.35]"
                : ""
            }
          >
            <div className="flex items-center gap-1.5">
              <p className="text-[15px] font-bold text-[#333d4b]">추천 주제</p>
              <button
                type="button"
                className="grid size-7 place-items-center rounded-full text-[#6b7684] transition hover:bg-[#f2f4f6] hover:text-[#1b64da] disabled:cursor-wait disabled:opacity-50"
                aria-label="추천 주제 새로고침"
                title="추천 주제 새로고침"
                disabled={presetsLoading}
                onClick={onRefreshPresets}
              >
                <Icon
                  name="refresh"
                  className={`size-4 ${presetsLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            {presets.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {presets.map((preset) => {
                  const isSelected = topic === preset;

                  return (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onTopicChange(preset)}
                      className={`inline-flex items-center rounded-full border bg-white px-[15px] py-2 text-[15px] font-medium leading-[22.4px] transition ${isSelected ? "border-[#287aff] text-[#287aff] shadow-[0_0_2px_rgba(0,30,78,0.07)]" : "border-[#e5e8eb] text-[#4e5968] hover:border-[#d5dae0] hover:text-[#191f28]"}`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            )}
            <textarea
              id="image-post-topic"
              rows={2}
              value={topic}
              onChange={(event) => onTopicChange(event.target.value)}
              placeholder="만들 이미지의 주제를 입력하세요."
              disabled={!productId}
              className="mt-6 w-full resize-none rounded-[12px] border border-[#e5e8eb] bg-white px-4 py-3 text-[15px] text-[#4e5968] outline-none transition hover:border-[#cdd3d9] focus:border-[#3182f6] focus:shadow-[0_0_0_3px_rgba(49,130,246,0.18)] disabled:bg-[#f2f4f6]"
            />
          </div>
        </div>

        <fieldset
          className={`min-w-0 border-0 p-0 transition ${hasTopic ? "" : "pointer-events-none opacity-[0.38] grayscale-[0.35]"}`}
          disabled={!hasTopic}
          aria-disabled={!hasTopic}
        >
          <legend className="sr-only">템플릿 선택</legend>
          <ConceptPicker
            concepts={IMAGE_TOPIC_CONCEPTS}
            value={hasTopic ? concept : null}
            selectedIds={hasTopic ? selectedConceptIds : []}
            onChange={onConceptSelectionChange}
            onPreviewChange={onConceptPreviewChange}
            emptyPreview={!hasTopic}
          />
        </fieldset>
      </div>

      <div className="flex justify-end">
        {generating && (
          <p className="mr-3 self-center text-[13px] font-medium text-[#4e5968]" role="status">
            AI가 제안서를 바탕으로 카드 문구와 이미지 프롬프트를 만들고 있어요.
          </p>
        )}
        <button
          type="button"
          disabled={!ready || generating}
          onClick={onStart}
          className="rounded-full bg-[#287aff] px-6 py-3 text-[15px] font-bold text-white transition hover:bg-[#1b64da] disabled:cursor-not-allowed disabled:bg-[#d1d6db]"
        >
          이미지 만들기
        </button>
      </div>
      </>}

      {generating && (
        <div
          className="absolute inset-0 z-30 grid place-items-center bg-white/82 px-6 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-[360px] rounded-[20px] border border-[#dce9ff] bg-white px-7 py-6 text-center shadow-[0_18px_45px_rgba(40,122,255,0.18)]">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#eaf2ff]">
              <span className="size-6 animate-spin rounded-full border-[3px] border-[#287aff]/25 border-t-[#287aff]" aria-hidden="true" />
            </div>
            <p className="mt-4 text-[17px] font-bold text-[#191f28]">AI가 콘텐츠를 준비하고 있어요</p>
            <p className="mt-2 text-[14px] leading-6 text-[#6b7684]">제안서를 바탕으로 카드 문구와<br />이미지 프롬프트를 만들고 있습니다.</p>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#eaf2ff]">
              <span className="block h-full w-1/2 animate-pulse rounded-full bg-[#287aff]" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
