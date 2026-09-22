import Image from "next/image.js";
import { BLOG_CONCEPTS } from "../../../lib/blogprompt.js";

/** 블로그형 전용 이미지 세부안을 하나 선택한다. */
export function BlogConceptPicker({ selectedIds = [], onChange }) {
  const selectedId = selectedIds[0] || BLOG_CONCEPTS[0]?.id;

  return (
    <fieldset className="m-0">
      <legend className="sr-only">블로그형 이미지 템플릿 선택</legend>
      <p className="mb-4 text-[13px] leading-[1.6] text-[#5f6b7a]">
        블로그형 안에서 사용할 이미지 템플릿을 선택해 주세요.
      </p>
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
        role="group"
        aria-label="블로그형 이미지 템플릿 선택"
      >
        {BLOG_CONCEPTS.map((concept) => {
          const checked = selectedId === concept.id;
          return (
            <button
              type="button"
              key={concept.id}
              onClick={() => onChange([concept.id])}
              aria-pressed={checked}
              className={`relative overflow-hidden rounded-[11px] border p-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287aff] ${checked ? "border-[#287aff] bg-[#f3f7ff] ring-1 ring-[#287aff]" : "border-[#e5e8eb] bg-white hover:bg-[#f7f8fa]"}`}
            >
              <span className="block aspect-square w-full overflow-hidden rounded-[7px] bg-[#f2f4f6]">
                <Image
                  src={concept.previewImage}
                  alt={`${concept.name} 예시`}
                  width={400}
                  height={400}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="mt-2 block text-[13px] font-bold text-[#191f28]">
                {concept.name}
              </span>
              <span
                className={`absolute right-3 top-3 grid size-6 place-items-center rounded-full text-[14px] font-bold ${checked ? "bg-[#287aff] text-white" : "bg-white/90 text-[#8b95a1]"}`}
                aria-hidden="true"
              >
                {checked ? "✓" : "+"}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
