import { Icon } from "../../../_components/Icon.jsx";

/** Instagram 계정 프로필과 최근 게시물 미리보기. */
export function InstagramPreview({ profile, avatarUrl }) {
  if (!profile) {
    return <div className="flex min-h-[280px] items-center justify-center rounded-[15px] border border-dashed border-white/20 bg-white/5 p-6 text-center text-[14px] text-white/50">계정 유형을 고르면 여기에 프로필 미리보기가 나타납니다.</div>;
  }

  const initial = (profile.name || "?").trim().charAt(0) || "?";
  const handle = profile.slug || "account";
  const shownLink = String(profile.link || "").replace(/^https?:\/\//, "");
  const stats = profile.stats || {};
  const media = Array.isArray(profile.media) ? profile.media : [];
  const formatCount = (value) => (Number.isFinite(Number(value)) ? Number(value).toLocaleString("ko-KR") : "--");

  return (
    <div>
      <div className="overflow-hidden rounded-[24px] border border-[#e5e8eb] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-center border-b border-[#f2f4f6] px-4 py-3">
          <span className="truncate text-[14px] font-bold text-[#191f28]">{handle}</span>
        </div>
        <div className="flex items-center gap-6 px-5 py-5">
          {avatarUrl ? <img src={avatarUrl} alt="프로필 이미지" referrerPolicy="no-referrer" className="size-[72px] shrink-0 rounded-full object-cover" /> : (
            <span aria-label="기본 프로필 이미지" className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-[#f2f4f6] text-[#8b95a1]"><Icon name="user" className="size-9" /></span>
          )}
          <ul className="flex flex-1 justify-around text-center">
            {[["게시물", stats.media], ["팔로워", stats.followers], ["팔로우", stats.follows]].map(([label, value]) => (
              <li key={label}>
                <strong className="block text-[16px] font-bold text-[#191f28]">{formatCount(value)}</strong>
                <span className="block text-[13px] text-[#5f6b7a]">{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 pb-4">
          <p className="text-[14px] font-bold text-[#191f28]">{profile.name}</p>
          {profile.bio && <p className="mt-1 whitespace-pre-line text-[13px] leading-[1.55] text-[#191f28]">{profile.bio}</p>}
          {shownLink && <p className="mt-1 break-all text-[13px] font-semibold text-[#3897f0]">{shownLink}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-4" aria-hidden="true">
          <span className="flex-1 rounded-[8px] bg-[#efefef] py-1.5 text-center text-[13px] font-bold text-[#191f28]">팔로우</span>
          <span className="flex-1 rounded-[8px] bg-[#efefef] py-1.5 text-center text-[13px] font-bold text-[#191f28]">메시지</span>
        </div>
        <div className="grid grid-cols-3 gap-[2px] border-t border-[#f2f4f6]" aria-label="최근 게시물">
          {media.length ? media.map((item) => {
            const image = item.media_url || item.thumbnail_url;
            return <a key={item.id} href={item.permalink || undefined} target={item.permalink ? "_blank" : undefined} rel="noreferrer" className="aspect-square bg-[#f2f4f6]">
              {image && <img src={image} alt="최근 Instagram 게시물" referrerPolicy="no-referrer" className="size-full object-cover" />}
            </a>;
          }) : Array.from({ length: 6 }, (_, index) => <span key={index} className="aspect-square bg-[#f2f4f6]" />)}
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-[1.5] text-white/45">Instagram API에서 방금 조회한 프로필 정보와 최근 게시물입니다.</p>
    </div>
  );
}
