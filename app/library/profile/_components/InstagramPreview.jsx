/**
 * 왼쪽에 붙는 인스타그램 느낌의 프로필 미리보기.
 * 옛 pages/profile.js 의 `previewHTML()` 을 그대로 옮겼다 — 요청자 지시(2026-08-14)로
 * 입력칸만 보고서는 30자·150자가 실제로 어떻게 보이는지 알 수 없어 만들었다.
 *
 * ⚠️ 게시물·팔로워 수는 지어내지 않는다. 아직 없는 계정이라 자리만 두고 값은 `—` 로 비운다.
 * ⚠️ 소개는 `whitespace-pre-line` 으로 그린다 — 줄바꿈이 이 화면의 존재 이유다.
 */
export function InstagramPreview({ profile, avatarUrl }) {
  if (!profile) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-[15px] border border-dashed border-white/20 bg-white/5 p-6 text-center text-[14px] text-white/50">
        유형을 고르면 여기에 프로필 미리보기가 나타납니다.
      </div>
    );
  }

  const initial = (profile.name || "?").trim().charAt(0) || "?";
  const handle = profile.slug || "account";
  const shownLink = String(profile.link || "").replace(/^https?:\/\//, "");

  return (
    <div>
      <div className="overflow-hidden rounded-[24px] border border-[#e5e8eb] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-center border-b border-[#f2f4f6] px-4 py-3">
          <span className="truncate text-[14px] font-bold text-[#191f28]">{handle}</span>
        </div>
        <div className="flex items-center gap-6 px-5 py-5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- objectURL(blob), Next Image 가 다루지 못한다
            <img
              src={avatarUrl}
              alt="올린 프로필 이미지 미리보기"
              className="size-[72px] shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-[#f2f4f6] text-[24px] font-bold text-[#8b95a1]"
            >
              {initial}
            </span>
          )}
          <ul className="flex flex-1 justify-around text-center">
            {[
              ["게시물", "—"],
              ["팔로워", "—"],
              ["팔로우", "—"],
            ].map(([label, value]) => (
              <li key={label}>
                <strong className="block text-[16px] font-bold text-[#191f28]">{value}</strong>
                <span className="block text-[13px] text-[#5f6b7a]">{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 pb-4">
          <p className="text-[14px] font-bold text-[#191f28]">{profile.name}</p>
          <p className="mt-1 whitespace-pre-line text-[13px] leading-[1.55] text-[#191f28]">{profile.bio}</p>
          {shownLink && <p className="mt-1 text-[13px] font-semibold text-[#3897f0]">{shownLink}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-4" aria-hidden="true">
          <span className="flex-1 rounded-[8px] bg-[#efefef] py-1.5 text-center text-[13px] font-bold text-[#191f28]">
            팔로우
          </span>
          <span className="flex-1 rounded-[8px] bg-[#efefef] py-1.5 text-center text-[13px] font-bold text-[#191f28]">
            메시지
          </span>
        </div>
        <div className="grid grid-cols-3 gap-[2px] border-t border-[#f2f4f6]" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="aspect-square bg-[#f2f4f6]" />
          ))}
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-[1.5] text-white/45">
        인스타그램 프로필에서 보이는 모양을 흉내 낸 미리보기입니다. 실제 화면과는 다를 수 있어요.
      </p>
    </div>
  );
}
