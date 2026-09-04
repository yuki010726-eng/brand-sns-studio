"use client";

/**
 * 네이버 블로그 게시글 미리보기 — 실제로 올렸을 때 어떻게 보이는지 흉내 낸다.
 *
 * `InstagramPostPreview.jsx` 와 같은 목적, 같은 성격이다 — 3단계의 기본 미리보기
 * (CopyEditor.jsx 의 `Preview`)는 채널을 가리지 않는 공용 문서 스타일이라, "실제로
 * 네이버 블로그에 올라간 것처럼" 보고 싶다는 요청에는 부족하다. 여기서는 블로그
 * 글의 구조(인용구 표식 다음 두 줄 = 제목, `## 소제목`, `📷 [이미지 N · 역할]` +
 * `⤷ 캡션`, 끝의 `#해시태그` 줄)를 그대로 파싱해 네이버 블로그 포스트 화면처럼 그린다.
 *
 * ⚠️ 실제 이미지는 4단계(템플릿)에서 만든다. 이 단계에는 아직 없으므로 자리표시자만
 *    그린다 — 없는 이미지를 지어내 보여주면 안 된다.
 * ⚠️ 좋아요·댓글 수처럼 지어낼 수 없는 값은 `—` 로 비운다.
 */
import { useEffect, useRef, useState } from "react";
import { AVATAR_KEY, getImage, objectUrl } from "../../../lib/imagestore.js";
import { Icon } from "../Icon.jsx";

const QUOTE_RE = /^\[[^\]]*인용구\]$/;
const SLOT_RE = /^📷\s*\[이미지\s*(\d+)\s*·\s*([^\]]+)\]/;
const TAGS_RE = /^(#[^#\s]+\s*)+$/;

/** 원고를 제목 두 줄과 본문 블록으로 나눈다 — CopyEditor.jsx 의 `Preview` 와 같은 표식을 본다. */
function parseBlog(raw) {
  const lines = String(raw || "").split("\n");
  const title = [];
  let cursor = 0;

  if (QUOTE_RE.test(lines[0]?.trim() || "")) {
    let index = 1;
    while (index < lines.length && title.length < 2) {
      const text = lines[index]?.trim();
      if (text) title.push(text);
      index += 1;
    }
    cursor = index;
  }

  const blocks = [];
  let paraLines = [];
  const flushPara = () => {
    if (!paraLines.length) return;
    blocks.push({
      type: "para",
      key: `para-${blocks.length}`,
      text: paraLines.join("\n"),
    });
    paraLines = [];
  };

  for (let index = cursor; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      // 빈 줄은 문단 구분이다 — 지금까지 모은 줄을 한 문단으로 묶어 낸다.
      flushPara();
      continue;
    }

    const slot = line.match(SLOT_RE);
    if (slot) {
      flushPara();
      const captionLine = lines[index + 1]?.trim() || "";
      const caption = captionLine.startsWith("⤷")
        ? captionLine.slice(1).trim()
        : "";
      if (caption) index += 1;
      blocks.push({ type: "image", key: `image-${index}`, caption });
      continue;
    }

    if (line.startsWith("## ")) {
      flushPara();
      blocks.push({ type: "head", key: `head-${index}`, text: line.slice(3) });
      continue;
    }

    if (TAGS_RE.test(line)) {
      flushPara();
      blocks.push({
        type: "tags",
        key: `tags-${index}`,
        tags: line.split(/\s+/).filter(Boolean),
      });
      continue;
    }

    paraLines.push(line);
  }
  flushPara();

  return { title, blocks };
}

export function NaverBlogPreview({ value, title: titleHint, authorName }) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const avatarLoaded = useRef(false);

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

  const { title, blocks } = parseBlog(value);
  const displayTitle = title.join(" ") || titleHint?.trim() || "제목을 입력해 주세요";
  const name = authorName || "블로그";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dateLabel = (() => {
    const now = new Date();
    return `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`;
  })();

  return (
    <div>
      <div className="mx-auto w-full max-w-[1046px] overflow-hidden rounded-[12px] border border-[#e3e3e3] bg-white text-[#333]">
        <div className="flex items-center gap-1.5 border-b border-[#ededed] bg-[#f7f8f7] px-3.5 py-2 text-[11px] text-[#8e8e8e]">
          <span className="text-[13px] font-black text-[#03c75a]">N</span>
          <span className="min-w-0 truncate">blog.naver.com</span>
        </div>

        <div className="px-4 pt-4">
          <p className="text-[12px] text-[#8e8e8e]">전체보기 · 이야기</p>
          <h2 className="mt-2 break-words text-[19px] font-bold leading-[1.4] text-[#222]">
            {displayTitle}
          </h2>

          <div className="mt-3 flex items-center gap-2 border-b border-[#f1f1f1] pb-3.5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- objectURL(blob)
              <img
                src={avatarUrl}
                alt=""
                className="size-7 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#03c75a]/15 text-[12px] font-bold text-[#03c75a]"
              >
                {initial}
              </span>
            )}
            <span className="min-w-0 truncate text-[13px] font-semibold text-[#333]">
              {name}
            </span>
            <span className="text-[12px] text-[#c4c4c4]" aria-hidden="true">
              ·
            </span>
            <span className="shrink-0 text-[12px] text-[#8e8e8e]">
              {dateLabel}
            </span>
            <button
              type="button"
              tabIndex={-1}
              className="ml-auto shrink-0 rounded-[3px] border border-[#03c75a] px-2 py-[3px] text-[11px] font-semibold text-[#03c75a]"
            >
              이웃추가
            </button>
          </div>
        </div>

        <div className="px-4 py-4">
          {blocks.map((block) => {
            if (block.type === "head") {
              return (
                <h3
                  key={block.key}
                  className="mb-3 mt-6 break-words text-[20px] font-bold leading-[1.5] text-[#222] first:mt-0"
                >
                  {block.text}
                </h3>
              );
            }
            if (block.type === "image") {
              return (
                <figure key={block.key} className="my-4">
                  <div className="mx-auto flex aspect-[4/3] w-[220px] items-center justify-center rounded-md bg-[#f2f4f6] text-[#b0b8c1]">
                    <Icon name="image" className="size-6" />
                  </div>
                  {block.caption && (
                    <figcaption className="mt-2 text-center text-[13px] leading-[19px] text-[#8e8e8e]">
                      {block.caption}
                    </figcaption>
                  )}
                </figure>
              );
            }
            if (block.type === "tags") {
              return (
                <p
                  key={block.key}
                  className="mt-4 flex flex-wrap gap-x-2 gap-y-1 break-words text-[14px] font-medium text-[#1b63ab]"
                >
                  {block.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </p>
              );
            }
            return (
              <p
                key={block.key}
                className="mb-4 whitespace-pre-wrap break-words text-[15.5px] leading-5.5 text-[#333] last:mb-0"
              >
                {block.text}
              </p>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-6 border-t border-[#f1f1f1] px-4 py-4 text-[#8e8e8e]">
          <span className="flex items-center gap-1.5 text-[12px]">
            <Icon name="heart" className="size-[17px]" />
            공감 —
          </span>
          <span className="flex items-center gap-1.5 text-[12px]">
            <Icon name="chat" className="size-[17px]" />
            댓글 —
          </span>
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] leading-[1.5] text-[#8b95a1]">
        네이버 블로그에서 보이는 모양을 흉내 낸 미리보기입니다. 실제 화면과는 다를 수 있어요.
      </p>
    </div>
  );
}
