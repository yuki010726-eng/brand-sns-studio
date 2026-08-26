"use client";

import { useEffect, useState } from "react";
import { getThumb } from "../../../lib/librarystore.js";
import { Icon } from "../../_components/Icon.jsx";

/**
 * 썸네일은 IndexedDB 에 있어서 비동기다. 목록은 먼저 보여 주고 그림은 뒤따라 채운다.
 *
 * ⚠️ 썸네일은 기기를 따라가지 않는다. 보관함 목록(글)은 동기화되지만 그림은 이 기기에만
 *    있다. 다른 PC 에서는 「미리보기 없음」으로 뜬다 — 그래서 그림이 없어도 목록이 읽히도록
 *    만들었다.
 */
export function LibraryItemThumb({ item }) {
  const [status, setStatus] = useState("loading"); // 'loading' | 'ready' | 'none'
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!item.hasThumb) {
      setStatus("none");
      setUrl(null);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;
    setStatus("loading");
    setUrl(null);

    getThumb(item).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setStatus("none");
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      setStatus("ready");
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item]);

  return (
    <div className="grid aspect-[4/5] place-items-center overflow-hidden rounded-[12px] bg-[#f2f4f6]">
      {status === "loading" && (
        <span
          className="size-6 animate-spin rounded-full border-2 border-[#e5e8eb] border-t-[#8b95a1]"
          aria-hidden="true"
        />
      )}
      {status === "ready" && (
        // 화면 밖이어도 빈 칸으로 남으면 "썸네일이 깨졌다"고 오해하게 되므로 lazy 를 쓰지 않는다.
        <img
          src={url}
          alt={`${item.title} 첫 번째 카드 미리보기`}
          className="h-full w-full object-cover"
        />
      )}
      {status === "none" && (
        <span className="flex flex-col items-center gap-1.5 text-[13px] text-[#5f6b7a]">
          <Icon name="image" className="size-6 text-[#8b95a1]" />
          미리보기 없음
        </span>
      )}
    </div>
  );
}
