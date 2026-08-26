export function Criteria({ criteria }) {
  return (
    <div className="mt-3.5">
      <h3 className="text-[18px] font-bold text-white">심사 기준</h3>
      <ul className="mt-2.5 flex flex-col gap-[9px]">
        {criteria.map((item) => (
          <li key={item.label}>
            <span className="mb-1 flex justify-between text-[13px]">
              <span>{item.label}</span>
              <b>{item.weight}%</b>
            </span>
            <span className="block h-1.5 overflow-hidden rounded-full bg-white/18">
              <span
                className="block h-full rounded-full bg-white"
                style={{ width: `${Math.min(item.weight * 2, 100)}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
