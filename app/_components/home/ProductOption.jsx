import { Icon } from "../Icon.jsx";

export function ProductOption({ product, checked, onSelect }) {
  return (
    <label
      className={`flex w-full cursor-pointer items-center gap-3 rounded-full border px-4 py-[11px] transition-colors hover:bg-[#f2f4f6] ${checked ? "border-[#287AFF] bg-white text-[#287AFF]" : "border-transparent text-[#8E8E8E]"}`}
    >
      <input
        className="sr-only"
        type="radio"
        name="product"
        checked={checked}
        onChange={() => onSelect(product.id)}
      />
      <Icon
        name={product.icon}
        className={`size-6 ${checked ? "stroke-[2px]" : "stroke-[1.5px]"}`}
      />
      <span
        className={`min-w-0 flex-1 text-[18px] ${checked ? "font-bold" : "font-medium"}`}
      >
        {product.name}
      </span>
      <span
        className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full ${checked ? "bg-[#287AFF] text-white" : "invisible"}`}
      >
        {checked && <Icon name="check" className="size-[18px] stroke-[1.75]" />}
      </span>
    </label>
  );
}
