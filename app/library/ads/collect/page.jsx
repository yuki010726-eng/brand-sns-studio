"use client";

import { useState } from "react";
import { accessToken } from "../../../../lib/auth.js";
import { MyPageSidebar } from "../../_components/MyPageSidebar.jsx";

export default function GoogleAdsCollectPage() {
  const [country, setCountry] = useState("KR");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function collect() {
    setRunning(true);
    setResult(null);
    setError("");
    try {
      const token = await accessToken();
      const response = await fetch("/api/admin/ads-collect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ country }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "광고 수집을 시작하지 못했습니다.");
      setResult(data);
    } catch (requestError) {
      setError(requestError.message || "광고 수집 중 오류가 발생했습니다.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#1a1a1a] pb-[170px] text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <div className="flex min-h-[700px] overflow-hidden rounded-[15px] bg-white/10 max-[860px]:flex-col">
          <MyPageSidebar />
          <section className="min-w-0 flex-1 px-[49px] pb-20 pt-[61px] max-[860px]:px-6">
            <h1 className="text-[32px] font-bold tracking-[-.04em] text-white">Google 광고 수집</h1>
            <p className="mt-2 max-w-xl text-[15px] leading-6 text-white/55">
              등록된 모든 광고주를 Google Ads Transparency Center에서 검색해 광고 소재를 저장합니다.
            </p>

            <div className="mt-8 max-w-xl rounded-[15px] bg-white p-6">
              <label className="block text-sm font-bold text-[#191f28]" htmlFor="country">검색 국가</label>
              <input
                id="country"
                value={country}
                onChange={(event) => setCountry(event.target.value.toUpperCase())}
                maxLength={2}
                className="mt-2 w-24 rounded-lg border border-[#d1d6db] px-3 py-2 text-center outline-none focus:border-[#287aff]"
              />
              <button
                type="button"
                onClick={collect}
                disabled={running}
                className="mt-5 rounded-full bg-[#287aff] px-5 py-3 text-sm font-bold text-white disabled:bg-[#8b95a1]"
              >
                {running ? "수집 중..." : "등록 광고주 전체 수집"}
              </button>
              <p className="mt-3 text-xs leading-5 text-[#6b7684]">관리자 계정만 실행할 수 있으며 SerpAPI 사용량이 발생합니다.</p>
            </div>

            {error && <p role="alert" className="mt-5 text-sm text-[#e5484d]">{error}</p>}
            {result && (
              <div className="mt-5 max-w-xl rounded-[15px] bg-white p-6">
                <p className="font-bold text-[#191f28]">수집 완료: 광고주 {result.advertisers}개 · 광고 {result.collected}건</p>
                {result.failed > 0 && <p className="mt-2 text-sm text-[#e5484d]">실패한 광고주: {result.failed}개</p>}
                <ul className="mt-4 space-y-2 text-sm">
                  {result.results.map((item) => (
                    <li key={item.advertiserId} className="rounded-lg bg-[#f7f8fa] px-3 py-2">
                      <span className="font-bold">{item.name}</span>: {item.error || `${item.collected}건 저장`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
