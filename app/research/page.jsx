"use client";

import { useEffect, useState } from "react";
import { sectionsOf, summaryOf, NAME_MAX } from "../../lib/blogstyles.js";
import { getState, setState, subscribe } from "../../store.js";
import { LoadingScreen } from "../_components/LoadingScreen.jsx";
import { MyPageSidebar } from "../library/_components/MyPageSidebar.jsx";

function StyleCard({ style }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(style.name || "");
  const sections = sectionsOf(style.guide);

  function saveName(event) {
    event.preventDefault();
    const nextName = name.trim().slice(0, NAME_MAX);
    if (!nextName) return;
    const current = getState();
    setState({
      styles: (current.styles || []).map((item) =>
        item.id === style.id ? { ...item, name: nextName } : item,
      ),
    });
    setEditing(false);
  }

  return (
    <article className="rounded-[15px] border border-[#e5e8eb] bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <form className="flex min-w-0 flex-1 gap-2" onSubmit={saveName}>
            <input
              autoFocus
              maxLength={NAME_MAX}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="스타일 이름"
              className="min-w-0 flex-1 rounded-[10px] border border-[#3182f6] px-3 py-2 text-[16px] font-bold text-[#191f28] outline-none"
            />
            <button className="rounded-full bg-[#287aff] px-4 py-2 text-sm font-bold text-white" type="submit">
              저장
            </button>
            <button className="rounded-full px-3 py-2 text-sm font-semibold text-[#6b7684]" type="button" onClick={() => { setName(style.name); setEditing(false); }}>
              취소
            </button>
          </form>
        ) : (
          <>
            <h2 className="text-[19px] font-bold text-[#191f28]">{style.name}</h2>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border border-[#d1d6db] px-4 py-2 text-sm font-semibold text-[#4e5968] hover:bg-[#f2f4f6]"
            >
              이름 수정
            </button>
          </>
        )}
      </div>
      <p className="mt-3 text-[14px] leading-6 text-[#6b7684]">
        {summaryOf(style.guide, 110) || "저장된 스타일 분석 요약입니다."}
      </p>
      <details className="group mt-5 border-t border-[#e5e8eb] pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-bold text-[#333d4b]">
          어떤 스타일인지 자세히 보기
          <span className="text-[#8b95a1] transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <dl className="mt-4 grid gap-4 rounded-[12px] bg-[#f7f8fa] p-5">
          {sections.map((section, index) => (
            <div key={`${section.label}-${index}`}>
              <dt className="text-[13px] font-bold text-[#333d4b]">{section.label}</dt>
              <dd className="mt-1 text-[14px] leading-6 text-[#6b7684]">{section.body || "분석 내용 없음"}</dd>
            </div>
          ))}
        </dl>
      </details>
    </article>
  );
}

export default function WritingStylesPage() {
  const [state, setViewState] = useState(null);

  useEffect(() => {
    setViewState(getState());
    return subscribe(setViewState);
  }, []);

  if (!state) return <LoadingScreen />;
  const styles = Array.isArray(state.styles) ? state.styles : [];

  return (
    <main className="min-h-dvh bg-[#1a1a1a] pb-[170px] text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <div className="flex min-h-[900px] overflow-hidden rounded-[15px] bg-white/10 max-[860px]:flex-col">
          <MyPageSidebar />
          <div className="min-w-0 flex-1 px-[49px] pb-20 pt-[61px] max-[860px]:px-6 max-[860px]:pt-[34px]">
            <header className="mb-8">
              <h1 className="text-[32px] font-bold tracking-[-0.04em] text-white">글 스타일</h1>
              <p className="mt-2 text-[15px] text-white/55">
                새 게시글에서 저장한 글 스타일을 확인하고 이름을 바꿀 수 있어요.
              </p>
            </header>
            {styles.length ? (
              <div className="grid max-w-[860px] gap-4">
                {styles.map((style) => <StyleCard key={style.id} style={style} />)}
              </div>
            ) : (
              <div className="max-w-[860px] rounded-[15px] border border-dashed border-white/20 px-6 py-16 text-center text-white/55">
                아직 저장한 글 스타일이 없습니다. 새 게시글에서 ‘글 스타일 직접 추가’를 선택해 저장해 보세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
