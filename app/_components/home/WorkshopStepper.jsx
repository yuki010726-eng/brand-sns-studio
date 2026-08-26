import { Icon } from "../Icon.jsx";

export function WorkshopStepper({ steps }) {
  return (
    <aside className="min-w-[174px] rounded-[15px] bg-white/10 px-[9px] py-2 max-[860px]:w-full">
      <p className="px-5 pb-5 pt-2 text-center text-[18px] font-bold leading-[22.4px] text-white">
        SNS 게시물 제작
      </p>
      <ol
        className="flex flex-col gap-0.5 max-[860px]:flex-row max-[860px]:flex-wrap"
        aria-label="게시물 제작 단계"
      >
        {steps.map((step, index) => (
          <li key={step.path} className="contents max-[860px]:block">
            {index > 0 && (
              <span className="flex justify-center py-0.5 text-white/40 max-[860px]:items-center">
                <Icon
                  name="chevronRight"
                  className="size-[18px] rotate-90 max-[860px]:rotate-0"
                />
              </span>
            )}
            <button
              type="button"
              className={`flex w-full items-center gap-3 rounded-full py-2 pl-2 pr-5 text-left text-[14px] font-medium text-white transition-colors max-[860px]:w-auto ${index === 0 ? "bg-[#1a1a1a] font-bold" : "cursor-not-allowed text-white/45"}`}
              disabled={index !== 0}
              aria-current={index === 0 ? "step" : undefined}
            >
              <span
                className={`inline-flex size-[22px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${index === 0 ? "bg-white text-[#1a1a1a]" : "bg-white/35 text-white"}`}
              >
                {step.n}
              </span>
              {step.label}
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
