import { LIMITS, LITTLY_SIGNUP, needsPhoto } from "../../../../lib/profile.js";
import { Icon } from "../../../_components/Icon.jsx";

/**
 * 이름 · 소개 · litt.ly 링크 · 이미지 프롬프트 · 사진 올리기 · 액션 버튼을 담는 카드.
 * 옛 pages/profile.js 의 `draftHTML()` + `imageHTML()` + `photoRowHTML()` 을 그대로 옮겼다.
 *
 * ⚠️ 이미지는 여기서 만들지 않는다(요청자 결정, 8절). 프롬프트를 복사해 원하는 도구에서
 *    만든 뒤 「파일 선택」으로 올려 미리보기만 확인하는 흐름이다.
 */
export function ProfileDraftPanel({
  profile,
  avatarUrl,
  onNameChange,
  onBioChange,
  onSlugChange,
  onRegen,
  onCopyAll,
  onCopyPrompt,
  onPhotoUpload,
  onPhotoClear,
}) {
  const photoNeeded = needsPhoto(profile);
  // 엠블럼에 글자를 새기는 쪽은 어워즈형뿐이다 — AI TV CF·마케터형은 NO_TEXT 로 만든다(lib/profile.js).
  const hasLettering = profile.typeId === "awards";

  return (
    <div className="space-y-5">
      <div className="rounded-[15px] border border-[#e5e8eb] bg-white p-6">
        <div className="space-y-5">
          <Field label="계정 이름" htmlFor="p-name" hint={`${profile.name.length} / ${LIMITS.name}자`}>
            <input
              id="p-name"
              className="w-full rounded-[12px] border border-[#e5e8eb] px-4 py-[13px] text-[15px] text-[#4e5968] outline-none focus-visible:border-[#287aff] focus-visible:ring-2 focus-visible:ring-[#287aff]/25"
              value={profile.name}
              maxLength={LIMITS.name}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </Field>

          <Field
            label="소개"
            htmlFor="p-bio"
            hint={`${profile.bio.length} / ${LIMITS.bio}자 · 「。」은 인스타가 빈 줄을 먹어버려서 여백 대신 넣는 글자입니다. 레퍼런스도 같은 방식입니다.`}
          >
            <textarea
              id="p-bio"
              rows={7}
              className="w-full resize-y rounded-[12px] border border-[#e5e8eb] px-4 py-[13px] text-[15px] leading-[1.6] text-[#4e5968] outline-none focus-visible:border-[#287aff] focus-visible:ring-2 focus-visible:ring-[#287aff]/25"
              value={profile.bio}
              maxLength={LIMITS.bio}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => onBioChange(e.target.value)}
            />
          </Field>

          <Field
            label="litt.ly 링크 주소"
            htmlFor="p-slug"
            labelHidden
            hint={
              <>
                litt.ly 계정이 없다면 —{" "}
                <a
                  className="font-semibold text-[#287aff] hover:underline"
                  href={LITTLY_SIGNUP}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  litt.ly 만들기
                </a>
              </>
            }
          >
            <div className="flex items-center rounded-[12px] border border-[#e5e8eb] px-4 py-[13px] focus-within:border-[#287aff] focus-within:ring-2 focus-within:ring-[#287aff]/25">
              <span className="shrink-0 text-[15px] text-[#8b95a1]">litt.ly/</span>
              <input
                id="p-slug"
                className="w-full border-0 bg-transparent p-0 text-[15px] text-[#4e5968] outline-none"
                value={profile.slug}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => onSlugChange(e.target.value)}
              />
            </div>
          </Field>

          <Field
            label="프로필 이미지 프롬프트 (영문)"
            htmlFor="p-img"
            hint={
              <>
                프롬프트를 복사해 이미지 도구에 붙여 쓰시면 됩니다. 정사각형 아바타 기준입니다.
                {photoNeeded && (
                  <>
                    {" "}
                    <b className="text-[#191f28]">본인 얼굴 사진을 함께 첨부</b>해야 이 프롬프트가 제 일을 합니다.
                  </>
                )}
                {hasLettering && (
                  <>
                    {" "}
                    <b className="text-[#191f28]">글자가 들어갑니다</b> — 만든 뒤 철자가 맞는지 꼭 눈으로 확인해
                    주세요. 이미지 도구는 글자를 자주 틀립니다.
                  </>
                )}
              </>
            }
          >
            <textarea
              id="p-img"
              rows={4}
              readOnly
              className="w-full resize-y rounded-[12px] border border-[#e5e8eb] bg-[#f7f8fa] px-4 py-[13px] text-[13px] leading-[1.6] text-[#5f6b7a] outline-none"
              value={profile.imagePrompt}
            />
          </Field>

          <PhotoRow
            photoNeeded={photoNeeded}
            avatarUrl={avatarUrl}
            onUpload={onPhotoUpload}
            onClear={onPhotoClear}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#f2f4f6] pt-5">
          <button
            type="button"
            onClick={onRegen}
            aria-label="프로필 초안 다시 뽑기"
            className="inline-flex items-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] py-[11px] text-[15px] font-bold text-[#5f6b7a] transition hover:bg-[#f7f8fa]"
          >
            <Icon name="refresh" className="size-[18px]" /> 다시 뽑기
          </button>
          <button
            type="button"
            onClick={onCopyAll}
            aria-label="프로필 전체를 복사하기"
            className="inline-flex items-center gap-[5px] rounded-full border border-[#287aff] bg-[#287aff] px-[19px] py-[11px] text-[15px] font-bold text-white transition hover:border-[#1b64da] hover:bg-[#1b64da]"
          >
            <Icon name="copy" className="size-[18px]" /> 전체 복사
          </button>
          <button
            type="button"
            onClick={onCopyPrompt}
            aria-label="이미지 프롬프트만 복사하기"
            className="text-[14px] font-semibold text-[#5f6b7a] transition hover:text-[#191f28]"
          >
            프롬프트만 복사
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-[15px] border border-[#ffd6d6] bg-[#fff5f5] p-4" role="note">
        <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-[#e11d48]" />
        <div className="text-[13px] leading-[1.6] text-[#c81e3a]">
          <strong className="block font-bold">올리기 전에 반드시 확인하세요</strong>
          <p className="mt-0.5">
            여기서 만든 이름·연도·행사명은 <b>무작위 조합한 초안</b>입니다. 실제 계정에 올릴 때는 공식 자료와
            맞는지 직접 확인해 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, hint, labelHidden, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelHidden ? "sr-only" : "mb-[6px] block text-[15px] font-bold text-[#333d4b]"}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[13px] leading-[1.5] text-[#5f6b7a]">{hint}</p>}
    </div>
  );
}

/** 아바타 미리보기용 사진 올리기 — 이 앱은 이미지 API 를 쓰지 않는다(8절 결정). */
function PhotoRow({ photoNeeded, avatarUrl, onUpload, onClear }) {
  return (
    <div>
      <span className="mb-[6px] block text-[15px] font-bold text-[#333d4b]">
        {photoNeeded ? "얼굴 사진 올리기" : "만든 이미지 올려 보기"}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] py-[11px] text-[15px] font-bold text-[#5f6b7a] transition hover:bg-[#f7f8fa]">
          <Icon name="image" className="size-[18px]" /> 파일 선택
          <input
            type="file"
            accept="image/*"
            autoComplete="off"
            className="sr-only"
            aria-label="프로필 미리보기용 이미지 파일 선택"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onUpload(file);
            }}
          />
        </label>
        {avatarUrl && (
          <button
            type="button"
            onClick={onClear}
            aria-label="올린 이미지 지우기"
            className="text-[13px] font-semibold text-[#5f6b7a] transition hover:text-[#e11d48]"
          >
            지우기
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[13px] leading-[1.5] text-[#5f6b7a]">
        {avatarUrl
          ? "왼쪽 미리보기의 프로필 자리에 적용했습니다. 실제 인스타에서도 원형으로 잘립니다."
          : "올리면 왼쪽 미리보기의 프로필 자리에 바로 넣어 드립니다. 이 기기에만 저장되고 계정에 올라가지는 않습니다."}
      </p>
    </div>
  );
}
