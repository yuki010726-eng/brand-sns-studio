import { CHANNELS } from "../../../data/channels.js";
import { getConcept } from "../../../lib/concepts.js";
import { TONE_LABEL } from "../../../lib/copywriter.js";
import { getProduct } from "../../../lib/products.js";
import { Icon } from "../../_components/Icon.jsx";
import { LibraryItemThumb } from "./LibraryItemThumb.jsx";

function dateLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (sameDay) return `오늘 ${time}`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function LibraryItemCard({ item, onLoad, onRemove }) {
  const product = getProduct(item.productId);
  const concept = getConcept(item.concept);
  const channels = (item.channels || [])
    .map((id) => CHANNELS.find((c) => c.id === id)?.name)
    .filter(Boolean);

  return (
    <li className="flex flex-col gap-3.5 rounded-[15px] border border-[#e5e8eb] bg-white p-4 transition hover:border-[#d5dae0]">
      <LibraryItemThumb item={item} />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-[#f2f4f6] px-[11px] py-1 text-[12px] font-bold text-[#5f6b7a]">
            {product?.short || item.productId}
          </span>
          <span className="inline-flex items-center rounded-full bg-[#f2f4f6] px-[11px] py-1 text-[12px] font-bold text-[#5f6b7a]">
            {concept?.name || item.concept}
          </span>
        </div>
        <h3 className="line-clamp-2 text-[18px] leading-[1.4] text-[#191f28]">
          {item.title}
        </h3>
        <p className="text-[13px] text-[#5f6b7a]">
          {TONE_LABEL[item.tone] || item.tone || ""} · 카드{" "}
          {item.cardCount || 6}장
          {channels.length ? ` · ${channels.join("·")}` : ""}
        </p>
        <p className="mt-auto pt-1.5 text-[13px] text-[#5f6b7a]">
          {dateLabel(item.updatedAt)} 저장
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => onLoad(item.id)}
            aria-label={`${item.title} 불러와서 이어서 편집하기`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#e5e8eb] bg-white px-4 py-2 text-[14px] font-bold text-[#333d4b] transition hover:bg-[#f2f4f6]"
          >
            <Icon name="arrowRight" className="size-4" />
            불러오기
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`${item.title} 보관함에서 삭제하기`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-transparent bg-transparent px-4 py-2 text-[14px] font-bold text-[#5f6b7a] transition hover:bg-[#f2f4f6]"
          >
            <Icon name="trash" className="size-4" />
            삭제
          </button>
        </div>
      </div>
    </li>
  );
}
