"use client";
import { useEffect, useState } from "react";
import { accessToken, getUser, onAuth } from "../../../lib/auth.js";
import { MyPageSidebar } from "../_components/MyPageSidebar.jsx";
function fmt(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = typeof value === "number" ? value : Number(value);
  // Meta/Google may return Unix time in seconds; Date expects milliseconds.
  const date = Number.isFinite(number)
    ? new Date(Math.abs(number) < 100_000_000_000 ? number * 1000 : number)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ko-KR");
}
function hasEnded(value) {
  if (!value) return false;
  // Compare calendar dates: ads remain active through three days ago,
  // and become ended when their last delivery date is four days ago.
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(0, 0, 0, 0);
  const fourDaysAgo = new Date();
  fourDaysAgo.setHours(0, 0, 0, 0);
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
  return date <= fourDaysAgo;
}
function deliveryStartTime(ad, platform) {
  const value = platform === "meta" ? ad.ad_delivery_start_time : ad.firstShown;
  if (value === null || value === undefined || value === "")
    return Number.NEGATIVE_INFINITY;
  const number = typeof value === "number" ? value : Number(value);
  const date = Number.isFinite(number)
    ? new Date(Math.abs(number) < 100_000_000_000 ? number * 1000 : number)
    : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}
function newestFirst(ads, platform) {
  return [...ads].sort(
    (a, b) => deliveryStartTime(b, platform) - deliveryStartTime(a, platform),
  );
}
function adDetails(ad, platform) {
  const meta = platform === "meta";
  const endDate = meta ? ad.ad_delivery_stop_time : ad.lastShown;
  return {
    meta,
    title: meta
      ? ad.page_name || "페이지 정보 없음"
      : ad.advertiser || "광고주 정보 없음",
    copy: meta
      ? ad.ad_creative_bodies?.join("\n") ||
        ad.ad_creative_link_titles?.join(" · ")
      : ad.text,
    url: meta ? ad.ad_snapshot_url : ad.url,
    startDate: fmt(meta ? ad.ad_delivery_start_time : ad.firstShown),
    ended: hasEnded(endDate),
    image: meta ? ad.thumbnail_url : ad.image,
    format: meta ? ad.publisher_platforms?.join(", ") : ad.format,
  };
}
function AdThumbnail({ src, title, onError }) {
  return (
    <img
      src={src}
      alt={`${title} 광고 이미지`}
      onError={onError}
      className="h-full w-full object-contain"
    />
  );
}
function Card({ ad, platform, onOpen }) {
  const { title, copy, url, startDate, image, ended } = adDetails(ad, platform);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  return (
    <article
      onClick={() => onOpen(ad)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(ad);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${title} 광고 상세 보기`}
      className="group cursor-pointer overflow-hidden rounded-[15px] bg-white shadow-[0_2px_10px_rgba(0,0,0,.08)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#287aff]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#edf0f2]">
        {image && !thumbnailFailed ? (
          <AdThumbnail
            src={image}
            title={title}
            onError={() => setThumbnailFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-5 text-center text-sm font-medium text-[#6b7684]">
            Preview unavailable
          </div>
        )}
        <span
          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${ended ? "bg-white/90 text-[#6b7684]" : "bg-[#191f28]/85 text-white"}`}
        >
          {ended ? "게재 종료" : "게재 중"}
        </span>
      </div>
      <div className="p-4">
        <h2 className="truncate text-[17px] font-bold text-[#191f28]">
          {title}
        </h2>
        {copy && (
          <p className="mt-2 line-clamp-2 min-h-10 whitespace-pre-line text-sm leading-5 text-[#4e5968]">
            {copy}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#edf0f2] pt-3">
          <span className="text-xs text-[#6b7684]">
            {startDate || "게재일 정보 없음"}
          </span>
          {url && (
            <a
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-full border border-[#d1d6db] px-2.5 py-1 text-xs font-bold text-[#4e5968] transition hover:border-[#287aff] hover:text-[#287aff]"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              광고 보기 ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
function AdPreviewModal({ ad, platform, onClose }) {
  const details = ad ? adDetails(ad, platform) : null;
  useEffect(() => {
    if (!ad) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ad, onClose]);
  if (!details) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ad-preview-title"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="max-h-[min(780px,calc(100dvh-32px))] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#edf0f2] bg-white px-6 py-5">
          <div>
            <p className="text-[13px] font-semibold text-[#287aff]">
              광고 라이브러리
            </p>
            <h2
              id="ad-preview-title"
              className="mt-1 text-xl font-bold text-[#191f28]"
            >
              {details.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full text-2xl text-[#4e5968] hover:bg-[#f2f4f6]"
            aria-label="모달 닫기"
          >
            ×
          </button>
        </header>
        <div className="p-6">
          <div className="overflow-hidden rounded-xl border border-[#edf0f2] bg-[#f8fafc]">
            {details.image ? (
              <img
                src={details.image}
                alt={`${details.title} 광고 이미지`}
                className="max-h-[420px] w-full object-contain"
              />
            ) : (
              <div className="flex min-h-52 items-center justify-center px-8 text-center text-sm text-[#6b7684]">
                이미지 미리보기를 제공하지 않는 광고입니다.
              </div>
            )}
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-[120px_1fr]">
            <p className="font-bold text-[#4e5968]">광고 내용</p>
            <p className="whitespace-pre-line leading-7 text-[#191f28]">
              {details.copy || "광고 문구 정보가 없습니다."}
            </p>
            {details.startDate && (
              <>
                <p className="font-bold text-[#4e5968]">게재 시작일</p>
                <p>{details.startDate}</p>
              </>
            )}
            {details.format && (
              <>
                <p className="font-bold text-[#4e5968]">플랫폼 / 형식</p>
                <p>{details.format}</p>
              </>
            )}
          </div>
          {details.url && (
            <a
              href={details.url}
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex rounded-lg bg-[#287aff] px-5 py-3 font-bold text-white"
            >
              원본 광고 보기 ↗
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
export default function AdsLibraryPage() {
  const [user, setUser] = useState(() => getUser()),
    [platform, setPlatform] = useState("meta"),
    [keyword, setKeyword] = useState(""),
    [country, setCountry] = useState("KR"),
    [ads, setAds] = useState([]),
    [category, setCategory] = useState("all"),
    [status, setStatus] = useState(""),
    [loading, setLoading] = useState(true),
    [selectedAd, setSelectedAd] = useState(null);
  const admin = user?.role === "admin";
  const categories = [...new Set(ads.map((ad) => ad.category?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const filteredAds = category === "all" ? ads : ads.filter((ad) => ad.category === category);
  useEffect(() => onAuth(setUser), []);
  useEffect(() => {
    if (user) loadStored();
  }, [user, platform]);
  async function loadStored() {
    setLoading(true);
    setStatus("");
    try {
      const token = await accessToken(),
        r = await fetch(`/api/ads-library/stored?platform=${platform}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        j = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(j.error || "저장된 광고를 불러오지 못했습니다.");
      setAds(newestFirst(j.data || [], platform));
      setCategory("all");
      if (!j.data?.length)
        setStatus("관리자가 검색해 저장한 광고가 아직 없습니다.");
    } catch (e) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function search(e) {
    e.preventDefault();
    if (!keyword.trim()) return setStatus("검색어를 입력해 주세요.");
    setLoading(true);
    setStatus("");
    try {
      const token = await accessToken(),
        p = new URLSearchParams({ q: keyword.trim(), country }),
        r = await fetch(
          `/api/ads-library${platform === "google" ? "/google" : ""}?${p}`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
        j = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(j.error || "광고를 불러오지 못했습니다.");
      setAds(newestFirst(j.data || [], platform));
      setCategory("all");
      if (!j.data?.length) setStatus("조건에 맞는 광고가 없습니다.");
    } catch (e) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="min-h-dvh bg-[#1a1a1a] pb-[170px] text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <div className="flex min-h-[900px] overflow-hidden rounded-[15px] bg-white/10">
          <MyPageSidebar />
          <div className="min-w-0 flex-1 px-[49px] pb-20 pt-[61px]">
            <h1 className="text-[32px] font-bold text-white">
              광고 라이브러리
            </h1>
            <p className="mt-2 text-[15px] text-white/55">
              관리자가 검색해 저장한 광고를 콘텐츠 레퍼런스로 살펴보세요.
            </p>
            <div className="my-6 flex gap-2 border-b border-white/15">
              {["meta", "google"].map((x) => (
                <button
                  key={x}
                  onClick={() => {
                    setPlatform(x);
                    setSelectedAd(null);
                  }}
                  className={`border-b-2 px-4 py-3 font-bold ${platform === x ? "border-white text-white" : "border-transparent text-white/50"}`}
                >
                  {x === "meta" ? "Meta" : "Google"}
                </button>
              ))}
            </div>
            {admin ? (
              <form
                className="mb-6 flex max-w-[860px] flex-wrap gap-2"
                onSubmit={search}
              >
                <input
                  className="min-w-[220px] flex-1 rounded-[12px] bg-white px-4 py-3"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={
                    platform === "google"
                      ? "광고주 또는 도메인 검색"
                      : "브랜드명 또는 키워드 검색"
                  }
                />
                <input
                  className="w-[84px] rounded-[12px] bg-white px-3 py-3 text-center uppercase"
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  maxLength={2}
                />
                <button
                  className="rounded-full bg-[#287aff] px-6 py-3 font-bold text-white"
                  disabled={loading}
                >
                  {loading ? "불러오는 중" : "검색"}
                </button>
              </form>
            ) : (
              <p className="mb-6 text-[14px] text-white/55"></p>
            )}
            {status && <p className="mb-5 text-white/70">{status}</p>}
            {categories.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-2" aria-label="광고 카테고리 필터">
                <button
                  type="button"
                  onClick={() => setCategory("all")}
                  aria-pressed={category === "all"}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${category === "all" ? "border-white bg-white text-[#191f28]" : "border-white/25 text-white/70 hover:border-white/60 hover:text-white"}`}
                >
                  전체 ({ads.length})
                </button>
                {categories.map((item) => {
                  const count = ads.filter((ad) => ad.category === item).length;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCategory(item)}
                      aria-pressed={category === item}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${category === item ? "border-white bg-white text-[#191f28]" : "border-white/25 text-white/70 hover:border-white/60 hover:text-white"}`}
                    >
                      {item} ({count})
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid max-w-full grid-cols-5 gap-4">
              {filteredAds.map((ad, i) => (
                <Card
                  key={ad.id || i}
                  ad={ad}
                  platform={platform}
                  onOpen={setSelectedAd}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <AdPreviewModal
        ad={selectedAd}
        platform={platform}
        onClose={() => setSelectedAd(null)}
      />
    </main>
  );
}
