import { Icon } from "../Icon.jsx";
import { Criteria } from "./Criteria.jsx";
import { Events } from "./Events.jsx";
import { InfoList } from "./InfoList.jsx";
import { Tags } from "./Tags.jsx";

function externalUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function instagramUrl(handle) {
  const value = String(handle || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://www.instagram.com/${value.replace(/^@/, "").replace(/^\/+|\/+$/g, "")}/`;
}

export function ProductDetail({ product }) {
  const panel =
    "relative z-0 -ml-[15px] grid min-h-[337px] grid-cols-[minmax(340px,1fr)_minmax(430px,1.2fr)] content-start gap-x-14 gap-y-4 rounded-r-[15px] bg-white/20 pb-9 pl-10 pr-3.5 pt-[25px] text-white max-[1024px]:-mt-[15px] max-[1024px]:ml-0 max-[1024px]:grid-cols-1 max-[1024px]:rounded-b-[15px] max-[1024px]:rounded-t-none max-[1024px]:px-7 max-[1024px]:pb-7 max-[1024px]:pt-[43px]";

  if (!product) {
    return (
      <div className={panel}>
        <div className="absolute inset-0 flex items-center justify-center px-5 text-center text-white/60">
          <div>
            <Icon name="award" className="mx-auto mb-3 size-8 text-white/40" />
            <p>왼쪽에서 상품을 선택하면 기준 정보가 열립니다.</p>
          </div>
        </div>
      </div>
    );
  }

  const siteUrl = externalUrl(product.site);
  const handleUrl = instagramUrl(product.handle);
  const proposalUrl = externalUrl(product.proposal_url);

  return (
    <article className={panel} aria-labelledby="brief-title">
      <div className="col-span-full -ml-[30px] -mr-1 flex min-w-0 items-center justify-between pl-[42px] pr-[21px] max-[1024px]:mx-[-18px] max-[1024px]:px-[18px]">
        <h2 className="text-[18px] font-bold text-white">상품 정보</h2>
        <div className="flex items-center gap-5 text-white">
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noreferrer" aria-label={`${product.name} 홈페이지 열기`} title="홈페이지">
              <Icon name="house" className="size-6 !stroke-2" />
            </a>
          )}
          {handleUrl && (
            <a href={handleUrl} target="_blank" rel="noreferrer" aria-label={`${product.name} 인스타그램 열기`} title="인스타그램">
              <Icon name="instagram" className="size-6 !stroke-2" />
            </a>
          )}
          {proposalUrl && (
            <a href={proposalUrl} target="_blank" rel="noreferrer" download aria-label={`${product.name} 제안서 다운로드`} title="제안서 다운로드">
              <Icon name="download" className="size-6 !stroke-2" />
            </a>
          )}
        </div>
      </div>
      <div className="col-span-full -ml-1.5 mr-1 -mt-px mb-3 h-px bg-white/55 max-[1024px]:mx-[-18px]" />
      <div className="flex min-w-0 flex-col gap-2.5 pl-5 max-[1024px]:pl-0">
        <h3 id="brief-title" className="text-[18px] font-bold text-white">
          {product.name}
        </h3>
        <div className="ml-0.5 flex items-stretch gap-3">
          <span className="w-[3px] shrink-0 rounded-full bg-white" />
          <p className="text-[15px] font-medium leading-[1.3] break-keep text-white/82">
            {product.summary}
          </p>
        </div>
        <InfoList title="기본 정보" items={product.facts} />
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 pl-5 pr-[42px] max-[1024px]:px-0">
        {product.events?.length > 0 && <Events events={product.events} />}
        {product.criteria?.length > 0 && (
          <Criteria criteria={product.criteria} />
        )}
        <Tags title="기본 특전" items={product.benefits} />
        {product.packages?.length > 0 && (
          <InfoList
            title="추가 패키지"
            items={product.packages.map(
              (item) => `${item.name} · ${item.desc}`,
            )}
          />
        )}
      </div>
    </article>
  );
}
