import Link from "next/link";
import { Icon } from "../Icon.jsx";

/**
 * 지나온 단계는 눌러서 바로 돌아갈 수 있다 (2026-09-07, UI/UX 정리).
 * 예전엔 스텝 표시가 그림일 뿐이라, 조건을 고치려면 본문 안에 숨어 있는
 * 「글 수정」·「조건 수정」 버튼을 따로 찾아야 했다 — 이 자체가 화면을 왔다갔다하게
 * 만드는 원인 중 하나였다. 아직 안 지난 단계는 그대로 눌리지 않는다 — 이전 단계에서
 * 필요한 값(주제·초안 등)이 없으면 각 화면의 guard 가 어차피 되돌려보내기 때문이다.
 */
export function TextStepper({ steps, activeIndex = 1 }) {
  return (
    <aside className="w-[174px] shrink-0 rounded-[15px] bg-white/10 px-2 py-4 max-[860px]:w-full">
      <p className="mb-5 text-center text-lg font-bold text-white">
        SNS 게시물 제작
      </p>
      <ol className="space-y-1 max-[860px]:flex max-[860px]:items-center max-[860px]:space-y-0">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const isDone = index < activeIndex;
          const content = (
            <>
              <span
                className={`grid size-[22px] shrink-0 place-items-center rounded-full text-xs font-bold ${isActive ? "bg-white text-[#1a1a1a]" : isDone ? "bg-white/70 text-[#1a1a1a]" : "bg-white/30 text-white"}`}
              >
                {isDone ? <Icon name="check" className="size-3 stroke-[3]" /> : step.n}
              </span>
              <span className="max-[620px]:hidden">{step.label}</span>
            </>
          );
          return (
            <li key={step.path} className="max-[860px]:contents">
              {index > 0 && (
                <Icon
                  name="chevronRight"
                  className="mx-auto my-1 size-4 rotate-90 text-white/35 max-[860px]:mx-1 max-[860px]:rotate-0"
                />
              )}
              {isDone ? (
                <Link
                  href={step.path}
                  aria-label={`${step.n}단계 ${step.label}로 돌아가기`}
                  className="flex items-center gap-3 rounded-full px-2 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  {content}
                </Link>
              ) : (
                <div
                  aria-current={isActive ? "step" : undefined}
                  className={`flex items-center gap-3 rounded-full px-2 py-2 text-sm ${isActive ? "bg-[#1a1a1a] font-bold text-white" : "cursor-not-allowed text-white/45"}`}
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
