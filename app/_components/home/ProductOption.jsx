import { Icon } from "../Icon.jsx";

export function ProductOption({ product, checked, onSelect }) {
  return (
    <label
      className={`flex w-full cursor-pointer items-center gap-3 rounded-full border px-4 py-[11px] text-[#5f6b7a] transition-colors hover:bg-[#f2f4f6] ${checked ? "border-[#1b64da] bg-[#e8f2fe] text-[#1b64da]" : "border-transparent"}`}
    >
      <input
        className="sr-only"
        type="radio"
        name="product"
        checked={checked}
        onChange={() => onSelect(product.id)}
      />
      <Icon name={product.icon} className="size-6" />
      <span className="min-w-0 flex-1 text-[18px] font-bold">
        {product.name}
      </span>
      <span
        className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] ${checked ? "border-[#1b64da] bg-[#1b64da] text-white" : "border-[#e5e8eb] text-transparent"}`}
      >
        <Icon name="check" className="size-[18px] stroke-[1.75]" />
      </span>
    </label>
  );
}
