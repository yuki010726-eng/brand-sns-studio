"use client";

/**
 * 프로필 탭 — 인스타그램 계정 프로필 세팅.
 * 옛 pages/profile.js 를 Next.js/React 로 옮겼다. 로직은 lib/profile.js 를 그대로 재사용한다.
 *
 * 흐름은 요청자가 정한 순서 그대로다.
 *   ① 브랜드 어워즈 / AI TV CF / 마케터 선택
 *   ② 그 유형에 맞게 이름·프로필 이미지·소개를 무작위 제작
 *   ③ litt.ly 링크 추가
 *
 * 이미지 생성 API 연결은 하지 않는다(요청자 결정, CLAUDE.md 8절) — 여기서는 영문 프롬프트까지만 만든다.
 *
 * ⚠️ 경로는 `/library/profile` 이다(요청자 지시 2026-08-27) — 마이페이지 하위 설정이라는 성격을
 *    경로에도 남긴다. 옮기면 `app/_components/layout/Header.jsx` 의 `MY_PAGE_PATHS` 와
 *    `app/library/_components/SettingsList.jsx` 의 링크도 함께 고쳐야 한다.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "../../../components/toast.js";
import { deleteImage, getImage, objectUrl, putImage } from "../../../lib/imagestore.js";
import { loadProducts } from "../../../lib/products.js";
import {
  AWARD_BRANDS,
  buildProfile,
  littlySlug,
  littlyUrl,
  replaceLinkLine,
} from "../../../lib/profile.js";
import { getState, setState, subscribe } from "../../../store.js";
import { Icon } from "../../_components/Icon.jsx";
import { LoadingScreen } from "../../_components/LoadingScreen.jsx";
import { InstagramPreview } from "./_components/InstagramPreview.jsx";
import { ProfileDraftPanel } from "./_components/ProfileDraftPanel.jsx";
import { ProfileTypePicker } from "./_components/ProfileTypePicker.jsx";
import { InstagramAccounts } from "./_components/InstagramAccounts.jsx";
import { MyPageSidebar } from "../_components/MyPageSidebar.jsx";

/**
 * 미리보기 아바타에 쓸 이미지.
 *
 * ⚠️ **store 에 넣지 않는다.** 이미지 Blob 은 localStorage 에 안 들어가고(보관함과 같은 이유),
 *    기기 간 동기화 대상에 넣으면 실제 Blob 이 없는 기기에서 있다고 표시된다.
 *    Blob 은 IndexedDB 에 두고 화면은 objectURL 만 들고 있는다.
 * ⚠️ 계정은 하나뿐이라 키도 하나다. 카드 이미지(`imageKey`)와 섞이지 않게 이름을 따로 둔다.
 */
const AVATAR_KEY = "profile-avatar";

async function copyText(text, okMessage) {
  if (!String(text).trim()) {
    toast("복사할 내용이 없습니다.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    // 클립보드 권한이 막힌 환경 폴백
    const tmp = document.createElement("textarea");
    tmp.value = text;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand("copy");
    tmp.remove();
    toast(okMessage);
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [state, setViewState] = useState(null);
  const [productsReady, setProductsReady] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const avatarLoaded = useRef(false);

  useEffect(() => {
    setViewState(getState());
    const unsubscribe = subscribe(setViewState);
    loadProducts().finally(() => setProductsReady(true));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (avatarLoaded.current) return;
    avatarLoaded.current = true;
    getImage(AVATAR_KEY)
      .then((blob) => {
        if (!blob) return;
        setAvatarUrl(objectUrl(blob));
      })
      .catch(() => {
        /* 저장소가 막힌 환경이면 아바타 없이 간다 */
      });
  }, []);

  function remake(opts) {
    setState({ profile: buildProfile(opts), profileSeed: opts.seed });
  }

  function handleTypeChange(typeId) {
    remake({ typeId, brandId: AWARD_BRANDS[0]?.id, marketerStyle: "symbol", seed: 0 });
    toast("프로필 초안을 만들었습니다.");
  }

  function handleBrandChange(brandId) {
    // 브랜드만 갈아 끼운다 — 문장 조합(seed)은 그대로 둬야 브랜드 비교가 된다
    remake({ typeId: "awards", brandId, seed: state.profileSeed ?? 0 });
  }

  function handleMarketerStyleChange(marketerStyle) {
    // 방식만 갈아 끼운다 — 문장 조합(seed)은 그대로 둬야 비교가 된다
    remake({ typeId: "marketer", marketerStyle, seed: state.profileSeed ?? 0 });
  }

  function handleRegen() {
    const p = state.profile;
    remake({
      typeId: p.typeId,
      brandId: p.brandId,
      marketerStyle: p.marketerStyle ?? "symbol",
      seed: (state.profileSeed ?? 0) + 1,
    });
  }

  function handleNameChange(name) {
    setState({ profile: { ...state.profile, name } });
  }

  function handleBioChange(bio) {
    setState({ profile: { ...state.profile, bio } });
  }

  function handleSlugChange(rawSlug) {
    const slug = littlySlug(rawSlug, state.profile.typeId);
    // 소개 안의 🔗 줄만 갈아 끼운다. 통째로 다시 만들면 사용자가 고친 소개가 날아간다.
    const bio = replaceLinkLine(state.profile.bio, slug);
    setState({ profile: { ...state.profile, slug, link: littlyUrl(slug), bio } });
  }

  async function handleCopyAll() {
    const p = state.profile;
    await copyText(
      [
        `[이름]\n${p.name}`,
        `[소개]\n${p.bio}`,
        `[링크]\n${p.link}`,
        `[프로필 이미지 프롬프트]\n${p.imagePrompt}`,
      ].join("\n\n"),
      "프로필을 복사했습니다.",
    );
  }

  async function handleCopyPrompt() {
    await copyText(state.profile.imagePrompt, "이미지 프롬프트를 복사했습니다.");
  }

  async function handlePhotoUpload(file) {
    if (!file.type.startsWith("image/")) {
      toast("이미지 파일만 올릴 수 있습니다.");
      return;
    }
    const url = objectUrl(file);
    try {
      await putImage(AVATAR_KEY, file);
      setAvatarUrl(url);
      toast("미리보기에 적용했습니다.");
    } catch {
      // 저장이 막혀도 이번 화면에서는 보여 준다 — 새로고침하면 사라진다는 것만 알린다
      setAvatarUrl(url);
      toast("미리보기에만 적용했습니다. 저장에 실패해 새로고침하면 사라집니다.");
    }
  }

  async function handlePhotoClear() {
    try {
      await deleteImage(AVATAR_KEY);
    } catch {
      /* 지우기 실패는 화면을 막지 않는다 */
    }
    setAvatarUrl(null);
    toast("올린 이미지를 지웠습니다.");
  }

  if (!state || !productsReady) return <LoadingScreen />;
  const profile = state.profile;

  return (
    <main className="min-h-dvh bg-[#1a1a1a] pb-[170px] pt-0 text-[#4e5968]">
      <div className="w-full px-[clamp(20px,3.85vw,74px)]">
        <div className="flex min-h-[1170px] items-stretch overflow-hidden rounded-[15px] bg-white/10 max-[860px]:min-h-0 max-[860px]:flex-col">
        <MyPageSidebar />
        <div className="min-w-0 flex-1 px-[39px] pb-20 pl-[49px] pt-[61px] max-[860px]:px-6 max-[860px]:pb-[54px] max-[860px]:pt-[34px]">
        <header className="mb-10">
          <h1 className="text-[32px] font-bold tracking-[-0.04em] text-white">계정 프로필을 설정해 보세요</h1>
          <p className="mt-2 max-w-[560px] text-white/55">
            유형을 고르면 이름·소개·프로필 이미지 초안을 만들어 드립니다. 마음에 들지 않으면 아래
            「다시 뽑기」를 눌러 주세요.
          </p>
        </header>

        <InstagramAccounts />

        <section className="mb-12">
          <h2 className="mb-4 text-[20px] font-bold text-white">1. 계정 유형</h2>
          <ProfileTypePicker
            profile={profile}
            onTypeChange={handleTypeChange}
            onBrandChange={handleBrandChange}
            onMarketerStyleChange={handleMarketerStyleChange}
          />
        </section>

        <section>
          <h2 className="mb-4 text-[20px] font-bold text-white">2. 이름 · 소개 · 프로필 이미지</h2>
          {!profile ? (
            <div className="flex items-start gap-3 rounded-[15px] border border-white/15 bg-white/5 p-5 text-[14px] text-white/70">
              <Icon name="sparkles" className="mt-0.5 size-4 shrink-0 text-white/50" />
              <div>
                <strong className="block font-bold text-white">위에서 유형을 먼저 고르세요</strong>
                <p className="mt-0.5">고르는 즉시 이름·소개·이미지 프롬프트 초안이 만들어집니다.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(260px,320px)_1fr] items-start gap-6 max-[880px]:grid-cols-1">
              <InstagramPreview profile={profile} avatarUrl={avatarUrl} />
              <ProfileDraftPanel
                profile={profile}
                avatarUrl={avatarUrl}
                onNameChange={handleNameChange}
                onBioChange={handleBioChange}
                onSlugChange={handleSlugChange}
                onRegen={handleRegen}
                onCopyAll={handleCopyAll}
                onCopyPrompt={handleCopyPrompt}
                onPhotoUpload={handlePhotoUpload}
                onPhotoClear={handlePhotoClear}
              />
            </div>
          )}
        </section>

        <div className="mt-10 flex justify-end">
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="상품·주제 선택 단계로 이동"
            className="inline-flex items-center gap-[5px] rounded-full bg-white px-6 py-3 text-[15px] font-bold text-[#191f28] transition hover:bg-[#ececec]"
          >
            상품·주제 선택하기 <Icon name="arrowRight" className="size-4" />
          </button>
        </div>
        </div>
        </div>
      </div>
      <div id="toast-root" className="toast-root" role="status" aria-live="polite" />
    </main>
  );
}
