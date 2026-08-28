"use client";

export function InstagramPublishDialog({
  open, images, caption, busy, accounts, accountId, accountLocked,
  onAccountChange, onCaptionChange, onClose, onPublish,
}) {
  if (!open) return null;
  const selectedAccount = accounts.find((account) => account.instagram_user_id === accountId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5" role="dialog" aria-modal="true" aria-labelledby="instagram-publish-title">
      <div className="max-h-[90dvh] w-full max-w-[720px] overflow-auto rounded-[18px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="instagram-publish-title" className="text-[20px] font-bold text-black">Instagram 게시 전 확인</h2>
            <p className="mt-1 text-[13px] text-[#6b7280]">아래 순서대로 슬라이드 캐러셀을 바로 게시합니다.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full px-3 py-1 text-[22px] text-[#6b7280] hover:bg-[#f3f4f6]" aria-label="닫기">×</button>
        </div>

        <div className="mt-5">
          <label className="block text-[14px] font-bold text-black" htmlFor="instagram-account">게시할 Instagram 계정</label>
          {accountLocked ? (
            <div className="mt-2 rounded-[12px] border border-[#d1d5db] bg-[#f9fafb] px-3 py-3 text-[14px] font-semibold text-black">@{selectedAccount?.username || accountId}</div>
          ) : (
            <select id="instagram-account" value={accountId} onChange={(event) => onAccountChange(event.target.value)} disabled={busy} className="mt-2 w-full rounded-[12px] border border-[#d1d5db] bg-white p-3 text-[14px] text-black outline-none focus:border-[#287aff] disabled:opacity-50">
              <option value="">계정을 선택해 주세요</option>
              {accounts.map((account) => <option key={account.instagram_user_id} value={account.instagram_user_id}>@{account.username}</option>)}
            </select>
          )}
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {images.map((src, index) => <img key={src} src={src} alt={`${index + 1}번 카드`} className="h-[180px] w-[144px] shrink-0 rounded-[10px] border border-[#e5e7eb] object-cover" />)}
        </div>
        <label className="mt-5 block text-[14px] font-bold text-black" htmlFor="instagram-caption">캡션</label>
        <textarea id="instagram-caption" value={caption} onChange={(event) => onCaptionChange(event.target.value)} maxLength={2200} rows={8} className="mt-2 w-full resize-y rounded-[12px] border border-[#d1d5db] p-3 text-[14px] text-black outline-none focus:border-[#287aff]" />
        <div className="mt-1 text-right text-[12px] text-[#9ca3af]">{caption.length} / 2,200</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-[#e5e7eb] px-5 py-2.5 text-[14px] font-bold text-[#4b5563] disabled:opacity-40">취소</button>
          <button type="button" onClick={onPublish} disabled={busy || !accountId} className="rounded-full bg-[#287aff] px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-40">{busy ? "게시 중…" : "Instagram에 게시"}</button>
        </div>
      </div>
    </div>
  );
}
