import { Icon } from '../Icon.jsx';

const STATUS = {
  pass: {
    label: '검토 통과',
    summary: '현재 기준에서 확인된 위험 문구가 없습니다.',
    box: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    badge: 'bg-emerald-600 text-white',
    icon: 'check',
  },
  warning: {
    label: '주의 항목 있음',
    summary: '게시 전 근거나 채널 기준을 확인해 주세요.',
    box: 'border-amber-200 bg-amber-50 text-amber-950',
    badge: 'bg-amber-500 text-white',
    icon: 'alert',
  },
  review: {
    label: '법무 확인 필요',
    summary: '적용 범위나 문맥에 따라 판단이 달라질 수 있는 항목입니다.',
    box: 'border-orange-200 bg-orange-50 text-orange-950',
    badge: 'bg-orange-600 text-white',
    icon: 'alert',
  },
  error: {
    label: '수정 필요',
    summary: '다음 단계로 이동하려면 위험 문구를 먼저 수정해 주세요.',
    box: 'border-red-200 bg-red-50 text-red-950',
    badge: 'bg-red-600 text-white',
    icon: 'alert',
  },
};

export function CompliancePanel({ report }) {
  const view = STATUS[report.status];
  return (
    <section
      aria-label="컴플라이언스 검토 결과"
      aria-live="polite"
      className={`mt-4 rounded-xl border p-4 ${view.box}`}
    >
      <div className="flex items-start gap-3">
        <Icon name={view.icon} className="mt-0.5 size-5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">컴플라이언스 검토</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${view.badge}`}>
              {view.label}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-5 opacity-80">{view.summary}</p>

          <div className="mt-3 grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            {report.scopes.map((scope) => {
              const scopeView = STATUS[scope.status];
              return (
                <div
                  key={scope.law}
                  className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-white/70 px-3 py-2"
                >
                  <span className="text-[12px] font-semibold">{scope.law}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${scopeView.badge}`}>
                    <Icon name={scope.status === 'pass' ? 'check' : 'alert'} className="size-3" />
                    {scopeView.label}
                  </span>
                </div>
              );
            })}
          </div>

          {report.issues.length > 0 && (
            <ul className="mt-3 space-y-2">
              {report.issues.map((issue) => (
                <li key={issue.id} className="rounded-lg bg-white/70 px-3 py-2.5 text-[13px] leading-5">
                  <div className="flex items-center gap-2 font-bold">
                    <span className={`size-2 shrink-0 rounded-full ${issue.level === 'error' ? 'bg-red-500' : issue.level === 'review' ? 'bg-orange-500' : 'bg-amber-500'}`} />
                    <span className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] font-semibold opacity-70">
                      {issue.law}
                    </span>
                    {issue.title}
                  </div>
                  <p className="mt-0.5 pl-4 opacity-75">{issue.detail}</p>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] leading-4 opacity-60">
            표시광고법·자본시장법·불법 콘텐츠·언론/인격권 위험의 내부 사전 점검입니다.
            일반 브랜드 SNS에는 언론중재법이 직접 적용되지 않을 수 있으며, 이 결과는 변호사의 법률 검토를 대신하지 않습니다.
          </p>
        </div>
      </div>
    </section>
  );
}
