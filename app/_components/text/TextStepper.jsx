import { Icon } from "../Icon.jsx";

export function TextStepper({ steps }) {
  return <aside className="w-[174px] shrink-0 rounded-[15px] bg-white/10 px-2 py-4 max-[860px]:w-full">
    <p className="mb-5 text-center text-lg font-bold text-white">SNS 게시물 제작</p>
    <ol className="space-y-1 max-[860px]:flex max-[860px]:items-center max-[860px]:space-y-0">
      {steps.map((step, index) => <li key={step.path} className="max-[860px]:contents">
        {index > 0 && <Icon name="chevronRight" className="mx-auto my-1 size-4 rotate-90 text-white/35 max-[860px]:mx-1 max-[860px]:rotate-0" />}
        <div aria-current={index === 1 ? "step" : undefined} className={`flex items-center gap-3 rounded-full px-2 py-2 text-sm ${index === 1 ? "bg-[#1a1a1a] font-bold text-white" : "text-white/45"}`}>
          <span className={`grid size-[22px] place-items-center rounded-full text-xs font-bold ${index === 1 ? "bg-white text-[#1a1a1a]" : "bg-white/30 text-white"}`}>{step.n}</span>
          <span className="max-[620px]:hidden">{step.label}</span>
        </div>
      </li>)}
    </ol>
  </aside>;
}
