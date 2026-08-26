export function Tags({ title, items = [] }) {
  return (
    <div className="mt-3.5">
      <h3 className="text-[18px] font-bold text-white">{title}</h3>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-full bg-white px-[11px] py-[5px] text-[13px] font-medium text-black"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
