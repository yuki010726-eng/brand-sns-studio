import { Icon } from "../Icon.jsx";

export function InfoList({ title, items = [] }) {
  return (
    <div className="mt-3.5">
      <h3 className="text-[18px] font-bold text-white">{title}</h3>
      <ul className="mt-2.5 flex flex-col gap-2 text-[15px] text-white">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Icon name="check" className="mt-0.5 size-[18px] text-white/60" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
