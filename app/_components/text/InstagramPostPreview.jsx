"use client";

/**
 * 인스타그램 게시글 미리보기 — 실제로 올렸을 때 어떻게 보이는지 흉내 낸다.
 *
 * 3단계의 기본 미리보기(CopyEditor.jsx 의 `Preview`)는 블로그·인스타·쓰레드가 모두 같은
 * 문서 스타일(소제목·인용구·이미지 자리)로 렌더링된다. 인스타그램 글은 소제목·이미지 자리가
 * 없고(##·📷 는 블로그 전용, lib/copyai.js 의 channelPrinciplesV1 참고) 대신 캡션 끝에
 * 해시태그 한 줄이 붙는 구조라, 문서처럼 보여줘서는 실제 느낌을 알 수 없다는 지적을 반영했다.
 *
 * 프로필 화면의 `InstagramPreview.jsx`(계정 프로필 미리보기)와 같은 성격이다 — 실제 서비스
 * 화면을 흉내 내되, 지어낼 수 없는 값(좋아요·댓글 수)은 `—` 로 비운다.
 *
 * ⚠️ 카드뉴스 실제 이미지는 4단계(템플릿)에서 만든다. 이 단계에는 아직 없으므로
 *    자리표시자만 그린다 — 없는 이미지를 지어내 보여주면 안 된다.
 */
import { useEffect, useRef, useState } from "react";
import { AVATAR_KEY, getImage, objectUrl } from "../../../lib/imagestore.js";
import { Icon } from "../Icon.jsx";

const TAGS_RE = /^(#[^#\s]+\s*)+$/;

/** 캡션 본문과 맨 끝 해시태그 줄을 가른다. 해시태그 앞의 빈 줄·점 스페이서는 본문에서 정리한다. */
function splitCaption(raw) {
  const lines = String(raw || "").split("\n");
  let end = lines.length;
  while (end > 0 && !lines[end - 1].trim()) end -= 1;
  const hasTags = end > 0 && TAGS_RE.test(lines[end - 1].trim());
  const tags = hasTags ? lines[end - 1].trim() : "";
  let bodyEnd = hasTags ? end - 1 : end;
  while (bodyEnd > 0 && !lines[bodyEnd - 1].trim()) bodyEnd -= 1;
  return { body: lines.slice(0, bodyEnd).join("\n").trim(), tags };
}

export function InstagramPostPreview({ value, handle, cardCount = 1 }) {
  const [expanded, setExpanded] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const avatarLoaded = useRef(false);

  useEffect(() => {
    setExpanded(false);
  }, [value]);

  useEffect(() => {
    if (avatarLoaded.current) return;
    avatarLoaded.current = true;
    getImage(AVATAR_KEY)
      .then((blob) => {
        if (blob) setAvatarUrl(objectUrl(blob));
      })
      .catch(() => {
        /* 저장소가 막힌 환경이면 아바타 없이 간다 */
      });
  }, []);

  if (!value.trim()) {
    return (
      <p className="py-16 text-center text-[15px] text-[#8b95a1]">
        AI 생성 버튼을 눌러 글을 만들어 보세요.
      </p>
    );
  }

  const { body, tags } = splitCaption(value);
  const name = handle || "instagram";
  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const slides = Math.max(1, Number(cardCount) || 1);

  return (
    <div>
      <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[12px] border border-[#dbdbdb] bg-white text-[#191f28]">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- objectURL(blob)
            <img
              src={avatarUrl}
              alt=""
              className="size-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-[13px] font-bold text-white"
            >
              {initial}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
            {name}
          </span>
          <Icon name="more-horizontal" className="size-5 text-[#191f28]" />
        </div>

        <div className="relative aspect-square bg-[#f2f4f6]">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#8b95a1]">
            <Icon name="image" className="size-9" />
            <span className="text-[13px]">카드뉴스 이미지 자리 (4단계에서 완성)</span>
          </div>
          {slides > 1 && (
            <>
              <span className="absolute right-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                1/{slides}
              </span>
              <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1">
                {Array.from({ length: slides }, (_, index) => (
                  <span
                    key={index}
                    className={`size-1.5 rounded-full ${index === 0 ? "bg-[#3897f0]" : "bg-white/70"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-3 pt-2.5">
          <div className="flex items-center gap-3.5">
            <Icon name="heart" className="size-[26px]" />
            <Icon name="chat" className="size-[26px]" />
            <Icon name="send" className="size-[24px]" />
          </div>
          <Icon name="bookmark" className="size-[24px]" />
        </div>

        <p className="px-3 pt-2 text-[13px] font-semibold">좋아요 —개</p>

        <div className="px-3 pt-1 text-[13px] leading-[19px]">
          <p className={expanded ? "whitespace-pre-wrap" : "line-clamp-2 whitespace-pre-wrap"}>
            <span className="font-semibold">{name}</span> {body}
          </p>
          {expanded && tags && (
            <p className="mt-1.5 whitespace-pre-wrap text-[#00376b]">{tags}</p>
          )}
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="mt-0.5 text-[13px] text-[#8e8e8e]"
          >
            {expanded ? "간략히" : "더보기"}
          </button>
        </div>

        <p className="px-3 pt-1.5 text-[12.5px] text-[#8e8e8e]">댓글 —개 모두 보기</p>
        <p className="px-3 pb-3.5 pt-1 text-[11px] uppercase tracking-wide text-[#8e8e8e]">
          게시 전 미리보기
        </p>
      </div>
      <p className="mt-3 text-center text-[12px] leading-[1.5] text-[#8b95a1]">
        인스타그램 피드에서 보이는 모양을 흉내 낸 미리보기입니다. 실제 화면과는 다를 수 있어요.
      </p>
    </div>
  );
}
