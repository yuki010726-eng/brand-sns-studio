"use client";

/**
 * 네이버 블로그 게시글 미리보기 — 실제로 올렸을 때 어떻게 보이는지 흉내 낸다.
 * **이 화면 자체가 편집기다** (2026-09-08, 요청자 지시) — 예전에는 "미리보기"와
 * "고치기"(생 텍스트 textarea)가 따로 있었는데, `##`·`📷 [이미지 N · 역할]`·인용구
 * 표식 같은 원문 그대로를 textarea에서 고치는 게 불편하다는 지적이었다. 지금은
 * 이 미리보기의 제목·소제목·문단·이미지 캡션을 **직접 눌러 고친다** — 서식은
 * 그대로 두고 텍스트만 바꾸는 것이라 `state.drafts.blog` 원문 형식은 안 깨진다.
 *
 * 구조(`parseBlogDoc`) — 인용구 표식 다음 두 줄(제목: 검색어 / 후킹), `## 소제목`,
 * `📷 [이미지 N · 역할]` + `⤷ 캡션`, 끝의 `#해시태그` 줄, 그 사이 문단들.
 * 고치면 `serializeBlogDoc` 이 같은 형식으로 다시 합쳐 `onChange(text)` 로 올려보낸다
 * — 이후 컴플라이언스 검사·카드뉴스 연동(`blogCardSource` 등)은 예전과 똑같이 이
 * 원문 문자열만 본다. **편집 UI가 바뀐 것이지 저장되는 형식은 그대로다.**
 *
 * ⚠️ **글과 이미지는 한 번에 복사되지 않는다 — 세 번 시도하고 전부 되돌렸다** (2026-09-09).
 *    1차: 카드 이미지를 `<img src="data:...">` 로 본문 HTML 안에 끼워 「복사」 한 번으로
 *         텍스트+이미지를 같이 붙여넣게 했다 → **본문 붙여넣기 5MB 상한**(카드 원본이
 *         장당 1~3MB)에 걸려 네이버가 거절했다.
 *    2차: 이미지를 줄여서(JPEG 640px) 다시 → 이번엔 **"허용되지 않는 형식의 이미지가
 *         있어 해당 이미지는 제외됩니다"** — 네이버가 data URL 이미지 자체를 형식으로
 *         막는다는 게 드러났다. 크기와 무관한 오류라 더 줄여도 소용없었다.
 *    3차: data URL 을 버리고 `navigator.clipboard.write()` 에 텍스트 아이템 하나 +
 *         카드 이미지(진짜 PNG 파일) 아이템을 여러 개 배열로 같이 넣어 봤다 → **브라우저가
 *         자체적으로 거절했다**("Support for multiple ClipboardItems is not implemented"
 *         류 오류로 추정 — 크롬은 `write()` 에 아이템을 하나만 받는다). Naver 문제가
 *         아니라 **Clipboard API 자체의 한계**다.
 *    → 결론: 텍스트와 카드 이미지 여러 장을 한 번의 복사·붙여넣기로 합칠 방법이
 *      브라우저 쪽에도 네이버 쪽에도 없다. 그래서 「복사」는 텍스트만 복사하고,
 *      이미지는 카드마다 있는 **「이미지 복사」** 버튼(`ImageBlock` 아래)으로 한 장씩
 *      따로 복사한다 — data URL 이 아니라 **진짜 PNG 바이트**를 클립보드에 올리는
 *      것이라 스크린샷·사진을 복사해 붙여넣을 때와 같은 경로를 타서 네이버가 정상
 *      업로드한다. 붙여넣을 위치를 클릭한 다음 Ctrl+V 해야 한다.
 *    ⚠️ **다시 "한 번에 합치기"를 시도하기 전에 이 세 실패를 먼저 읽을 것** — 같은
 *       실패를 반복하지 않으려면 HTML+data URL 도, 여러 ClipboardItem 배열도 답이
 *       아니라는 걸 기억해야 한다.
 *
 * ⚠️ **캔버스로 그릴 수 있는 컨셉(매거진형·카드형·노트형)만 실제 카드뉴스 미리보기를
 *    그린다.** 직관형(광고, promptOnly)은 캔버스 자체가 없어 여전히 자리표시자만
 *    보여준다 — `canGenerateImage()` 참고. `state.concept` 이 그 셋 중 하나면 3단계(템플릿)와
 *    같은 함수(`buildPreviewDeck`·`baseOf`)로 덱을 다시 세우고 `renderCard()` 로 캔버스에 그려
 *    데이터 URL 로 바꿔 끼운다 — 3단계에 아직 안 들어갔어도 지금 상품·주제·톤으로
 *    무엇이 나올지 미리 보여준다. 사람이 3단계에서 문구를 직접 고쳤으면(`state.card`)
 *    그 값을 우선한다.
 * ⚠️ 좋아요·댓글 수처럼 지어낼 수 없는 값은 `—` 로 비운다.
 *
 * ⚠️ 이 카드뉴스 미리보기를 누르면 **모달**(`CardEditModal.jsx`)이 뜬다 (2026-09-08,
 *    요청자 지시) — "한 페이지에서 최대한 끝내고 싶다"는 요구에 맞춰, 3단계(카드뉴스
 *    제작) 페이지로 옮기지 않고도 그 카드 한 장을 여기서 바로 고칠 수 있다. 모달은
 *    `CopyEditor`가 인스타그램 미리보기와 공유해서 하나만 띄운다 — `deck`·`cardThumbs`
 *    는 `useCardDeck()` 훅으로 부모가 만들어 그대로 내려주고, 이 컴포넌트는 이미지
 *    자리를 눌렀을 때 `onEditCard(카드 번호)`만 불러 준다.
 */
import { useEffect, useRef, useState } from "react";
import { AVATAR_KEY, getImage, objectUrl } from "../../../lib/imagestore.js";
import { Icon } from "../Icon.jsx";
import { getState, setState } from "../../../store.js";
import { toast } from "../../../components/toast.js";
import { parseBlogDoc, serializeBlogDoc } from "../../../lib/blogDoc.js";

/** 복사용으로 줄일 때 맞출 가로 폭. 네이버 블로그 본문 폭(약 700~850px)보다 넉넉히 크게 잡아
 *  실제로 안 작아 보이면서도 원본(1080px)보다는 확실히 줄어들게 한다. */
const COPY_IMAGE_MAX_WIDTH = 720;

/**
 * 카드 썸네일(canvas → PNG data URL, 1080×1350 원본)을 더 작은 **진짜 PNG 바이트**로
 * 다시 그려 클립보드에 올린다. HTML 안에 data URL 로 끼워 넣는 것과는 다른 경로다 —
 * 위 주석 참고. 이 경로는 실제 이미지 파일을 복사·붙여넣기하는 것과 같아서 네이버가
 * 정상적으로 받아 준다.
 *
 * ⚠️ **JPEG 로 바꾸지 않고 PNG 그대로 해상도만 줄인다.** 카드뉴스는 사진이 아니라
 *    단색 배경 위 굵은 텍스트라 JPEG 압축을 걸면 글자 가장자리가 뭉개진다(8절의
 *    "제목은 900(Black)" 처럼 이 프로젝트가 텍스트 선명도에 민감한 것과 같은 이유).
 *    PNG 는 이런 평면 그래픽에 원래 압축이 잘 먹으므로, 해상도만 줄여도 용량이
 *    꽤 줄어든다(1080→720 이면 픽셀 수가 약 1/2.25).
 */
function shrinkToBlob(dataUrl, maxWidth) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(blob), "image/png");
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function copyCardImage(dataUrl, cardNo) {
  if (!dataUrl) {
    toast(`카드뉴스 ${cardNo}번 이미지가 아직 만들어지지 않았습니다.`);
    return;
  }
  if (typeof window === "undefined" || !window.ClipboardItem) {
    toast("이 브라우저는 이미지 복사를 지원하지 않습니다.");
    return;
  }
  try {
    const blob = await shrinkToBlob(dataUrl, COPY_IMAGE_MAX_WIDTH);
    if (!blob) throw new Error("resize failed");
    await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
    toast(`카드뉴스 ${cardNo}번 이미지를 복사했습니다. 붙여넣을 위치를 클릭하고 Ctrl+V 하세요.`);
  } catch {
    // 줄이는 데 실패해도 이미지 복사 자체는 되던 기능이다 — 원본 그대로라도 복사한다.
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
      toast(`카드뉴스 ${cardNo}번 이미지를 원본 크기로 복사했습니다.`);
    } catch {
      toast("이미지를 복사하지 못했습니다.");
    }
  }
}

let blockSeq = 0;
const newBlockId = () => `blk-${Date.now().toString(36)}-${(blockSeq++).toString(36)}`;

// ⚠️ 원고 파싱 규칙(`parseBlogDoc`·`serializeBlogDoc`)은 `lib/blogDoc.js` 로 옮겼다
//    (2026-09-09) — 네이버 자동 발행 스크립트(Node, React·브라우저 API 없음)도
//    같은 파서를 써야 화면·복사·자동 발행이 서로 다른 걸 보지 않는다. `blockSeq` 는
//    이 파일 안에서 새 블록을 만들 때(문단 추가·블록 나누기)만 따로 쓰는 지역 카운터다.

const IMAGE_SIZES = [
  { id: "sm", label: "S" },
  { id: "md", label: "M" },
  { id: "lg", label: "L" },
];
const IMAGE_ALIGNS = [
  { id: "left", label: "왼쪽 정렬", icon: "alignLeft" },
  { id: "center", label: "가운데 정렬", icon: "alignCenter" },
  { id: "right", label: "오른쪽 정렬", icon: "alignRight" },
];
const IMAGE_BOX_CLASS = {
  "sm-left": "w-[160px] mr-auto ml-0",
  "sm-center": "w-[160px] mx-auto",
  "sm-right": "w-[160px] ml-auto mr-0",
  "md-left": "w-[220px] mr-auto ml-0",
  "md-center": "w-[220px] mx-auto",
  "md-right": "w-[220px] ml-auto mr-0",
  "lg-left": "w-[320px] mr-auto ml-0",
  "lg-center": "w-[320px] mx-auto",
  "lg-right": "w-[320px] ml-auto mr-0",
};

/**
 * 텍스트 한 덩어리를 자리에서 바로 고치는 손잡이. 통제(controlled) 컴포넌트로 만들면
 * 키 입력마다 DOM 을 다시 그려 커서가 튀고 한글 조합(IME)이 깨진다 — 그래서 포커스가
 * 가 있는 동안은 절대 `.textContent` 를 다시 쓰지 않는다(비제어 패턴). 바깥에서 값이
 * 바뀌었을 때만(포커스가 없을 때) 화면을 맞춘다.
 */
function EditableText({
  as: Tag = "p",
  text,
  className = "",
  ariaLabel,
  placeholder,
  onChangeText,
  onEnter,
  autoFocus,
}) {
  const ref = useRef(null);
  const composing = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if ((el.textContent || "") !== (text || "")) el.textContent = text || "";
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!autoFocus || !el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 한 번만, autoFocus 는 그 순간의 값을 본다
  }, []);

  function commit(el) {
    if (composing.current) return;
    onChangeText(el.textContent || "");
  }

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      className={`${className} outline-none empty:before:pointer-events-none empty:before:text-[#b0b8c1] empty:before:content-[attr(data-placeholder)]`}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(e) => {
        composing.current = false;
        commit(e.currentTarget);
      }}
      onInput={(e) => commit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.shiftKey) return;
        e.preventDefault();
        if (!onEnter) return;
        const el = ref.current;
        const selection = window.getSelection();
        if (!el || !selection || selection.rangeCount === 0) return;
        const caret = selection.getRangeAt(0);
        const measure = document.createRange();
        measure.selectNodeContents(el);
        measure.setEnd(caret.endContainer, caret.endOffset);
        const splitAt = measure.toString().length;
        const full = el.textContent || "";
        onEnter(full.slice(0, splitAt), full.slice(splitAt));
      }}
    />
  );
}

function BlockShell({ blockId, onDelete, deleteLabel, children }) {
  return (
    <div
      data-blog-block={blockId}
      className="group/block relative"
    >
      {children}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          className="absolute -right-2 -top-2 hidden size-6 items-center justify-center rounded-full border border-[#e5e8eb] bg-white text-[#8b95a1] shadow-sm transition hover:border-[#e5484d] hover:text-[#e5484d] group-hover/block:flex group-focus-within/block:flex"
        >
          <Icon name="close" className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function ImageBlock({
  block,
  thumb,
  layout,
  onCaptionChange,
  onLayoutChange,
  onDelete,
  onEdit,
  isPromptOnly = false,
  dragging,
  onPointerDown,
}) {
  const size = layout?.size || "md";
  const align = layout?.align || "center";
  const boxClass = IMAGE_BOX_CLASS[`${size}-${align}`] || IMAGE_BOX_CLASS["md-center"];

  return (
    <figure
      data-blog-image-block={block.id}
      data-blog-block={block.id}
      className={`group/block relative my-4 transition-opacity ${dragging ? "opacity-35" : ""}`}
    >
      <div className={`${boxClass} group/card relative`}>
        <button
          type="button"
          onPointerDown={(event) => onPointerDown?.(event, block.id)}
          aria-label={`카드뉴스 ${block.no}번 이미지 위치 변경`}
          title="드래그해서 이미지 위치 변경"
          className="absolute -left-8 top-1/2 z-10 grid size-6 -translate-y-1/2 touch-none grid-cols-2 place-content-center gap-[3px] rounded text-[#8b95a1] opacity-0 transition hover:bg-[#f2f4f6] hover:text-[#4e5968] focus-visible:opacity-100 group-hover/card:opacity-100 cursor-grab active:cursor-grabbing"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <i key={index} className="size-[3px] rounded-full bg-current" />
          ))}
        </button>
        {thumb ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`카드뉴스 ${block.no}번 편집하기`}
            className="group/thumb relative block w-full overflow-hidden rounded-md border border-[#ededed] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#287aff]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 캔버스로 그린 data URL */}
            <img
              src={thumb}
              alt={block.caption ? `카드뉴스 ${block.no}번 · ${block.caption}` : `카드뉴스 ${block.no}번 미리보기`}
              className="block aspect-[4/5] w-full object-cover"
            />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 text-[13px] font-bold text-white opacity-0 transition group-hover/thumb:bg-black/40 group-hover/thumb:opacity-100 group-focus-visible/thumb:bg-black/40 group-focus-visible/thumb:opacity-100">
              <Icon name="edit" className="size-4" />
              카드 편집
            </span>
          </button>
        ) : isPromptOnly && onEdit ? (
          <button type="button" onClick={onEdit} className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-[#f2f4f6] text-[#8b95a1] transition hover:bg-[#e9edf2]">
            <span className="flex items-center gap-2 text-[13px] font-bold"><Icon name="image" className="size-6" />광고 이미지 프롬프트 보기</span>
          </button>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-[#f2f4f6] text-[#b0b8c1]">
            <Icon name="image" className="size-6" />
          </div>
        )}
      </div>

      <EditableText
        as="figcaption"
        text={block.caption}
        onChangeText={onCaptionChange}
        ariaLabel={`카드뉴스 ${block.no}번 이미지 설명`}
        placeholder="이미지 설명을 입력하세요"
        className="mt-2 text-center text-[13px] leading-[19px] text-[#8e8e8e]"
      />

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 opacity-0 transition group-hover/block:opacity-100 group-focus-within/block:opacity-100">
        <div className="flex items-center gap-0.5 rounded-full border border-[#e5e8eb] bg-white p-0.5">
          {IMAGE_SIZES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onLayoutChange({ size: opt.id })}
              aria-label={`이미지 크기 ${opt.label}`}
              aria-pressed={size === opt.id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${size === opt.id ? "bg-[#191f28] text-white" : "text-[#8b95a1] hover:bg-[#f2f4f6]"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-full border border-[#e5e8eb] bg-white p-0.5">
          {IMAGE_ALIGNS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onLayoutChange({ align: opt.id })}
              aria-label={opt.label}
              aria-pressed={align === opt.id}
              className={`rounded-full p-1.5 transition ${align === opt.id ? "bg-[#191f28] text-white" : "text-[#8b95a1] hover:bg-[#f2f4f6]"}`}
            >
              <Icon name={opt.icon} className="size-3.5" />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => copyCardImage(thumb, block.no)}
          aria-label={`카드뉴스 ${block.no}번 이미지 복사`}
          title="복사한 뒤 네이버 에디터에서 붙여넣을 위치를 클릭하고 Ctrl+V 하세요"
          className="rounded-full border border-[#e5e8eb] bg-white p-1.5 text-[#8b95a1] transition hover:border-[#287aff] hover:text-[#287aff]"
        >
          <Icon name="copy" className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`카드뉴스 ${block.no}번 이미지 자리 삭제`}
          className="rounded-full border border-[#e5e8eb] bg-white p-1.5 text-[#8b95a1] transition hover:border-[#e5484d] hover:text-[#e5484d]"
        >
          <Icon name="trash" className="size-3.5" />
        </button>
      </div>
    </figure>
  );
}

export function NaverBlogPreview({
  value,
  title: titleHint,
  authorName,
  state,
  deck = [],
  cardThumbs = {},
  onEditCard,
  onChange,
}) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const avatarLoaded = useRef(false);

  const emittedRef = useRef(value);
  const [doc, setDoc] = useState(() => parseBlogDoc(value));
  const docRef = useRef(doc);
  const [focusBlockId, setFocusBlockId] = useState(null);
  const [draggingImageId, setDraggingImageId] = useState(null);
  const dragPointerY = useRef(null);
  const pendingImageDropRef = useRef(null);
  const pointerDragRef = useRef(null);

  // 이 컴포넌트가 방금 스스로 올려보낸 값이 그대로 되돌아온 것이면 다시 파싱하지
  // 않는다 — 다시 파싱하면 블록마다 새 id 가 생겨 그 블록에 가 있던 포커스·조합 중인
  // 한글 입력이 날아간다. 다른 곳(AI 재생성, 시안 선택 등)에서 값이 바뀌었을 때만
  // 새로 읽는다.
  useEffect(() => {
    if (value === emittedRef.current) return;
    emittedRef.current = value;
    const nextDoc = parseBlogDoc(value);
    docRef.current = nextDoc;
    setDoc(nextDoc);
  }, [value]);

  function commitDoc(nextDoc) {
    docRef.current = nextDoc;
    setDoc(nextDoc);
    const text = serializeBlogDoc(nextDoc);
    emittedRef.current = text;
    onChange?.(text);
  }

  function updateTitleLine(index, text) {
    const title = [doc.title[0] || "", doc.title[1] || ""];
    title[index] = text;
    commitDoc({ ...doc, title });
  }

  function updateBlockText(id, text) {
    commitDoc({
      ...doc,
      blocks: doc.blocks.map((b) => (b.id === id ? { ...b, text } : b)),
    });
  }

  function updateImageCaption(id, caption) {
    commitDoc({
      ...doc,
      blocks: doc.blocks.map((b) => (b.id === id ? { ...b, caption } : b)),
    });
  }

  function deleteBlock(id) {
    commitDoc({ ...doc, blocks: doc.blocks.filter((b) => b.id !== id) });
  }

  function splitBlock(id, beforeText, afterText, tailType = "para") {
    const index = doc.blocks.findIndex((b) => b.id === id);
    if (index === -1) return;
    const newBlock = { id: newBlockId(), type: tailType, text: afterText };
    const blocks = doc.blocks.slice();
    blocks[index] = { ...blocks[index], text: beforeText };
    blocks.splice(index + 1, 0, newBlock);
    setFocusBlockId(newBlock.id);
    commitDoc({ ...doc, blocks });
  }

  function appendParagraph() {
    const newBlock = { id: newBlockId(), type: "para", text: "" };
    setFocusBlockId(newBlock.id);
    commitDoc({ ...doc, blocks: [...doc.blocks, newBlock] });
  }

  // 카드 파일/번호는 바꾸지 않고, 블로그 원문 안의 이미지 블록 자리만 옮긴다.
  // 따라서 카드 편집 모달과 인스타그램 캐러셀은 기존 카드 순서를 그대로 유지한다.
  function startImageDrag(event, id) {
    if (event.button !== 0) return;
    event.preventDefault();
    const session = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
    pointerDragRef.current = session;
    pendingImageDropRef.current = null;

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== session.pointerId) return;
      const distance = Math.hypot(
        moveEvent.clientX - session.startX,
        moveEvent.clientY - session.startY,
      );
      if (!session.active && distance < 5) return;
      if (!session.active) {
        session.active = true;
        setDraggingImageId(id);
      }
      dragPointerY.current = moveEvent.clientY;
      const target = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest("[data-blog-block]");
      const targetId = target?.dataset.blogBlock;
      if (!targetId || targetId === id) return;
      const rect = target.getBoundingClientRect();
      pendingImageDropRef.current = {
        sourceId: id,
        targetId,
        insertAfter: moveEvent.clientY > rect.top + rect.height / 2,
      };
    };
    const onEnd = (endEvent) => {
      if (endEvent.pointerId !== session.pointerId) return;
      const pending = pendingImageDropRef.current;
      if (session.active && pending?.sourceId === id) {
        moveImageBlock(id, pending.targetId, pending.insertAfter);
      }
      finishImageDrag();
      pointerDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }

  // `dragover` 는 포인터 이동마다 매우 자주 발생한다. 여기서 원문을 저장하면 상위
  // 편집기와 카드 미리보기가 매번 다시 그려져 드래그가 끊긴다. 후보 위치만 기억하고
  // 실제 순서 변경은 drop 시 한 번만 반영한다.
  function previewImageMove(event, targetId) {
    event.preventDefault();
    const sourceId = draggingImageId || event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) return;

    const targetRect = event.currentTarget.getBoundingClientRect();
    pendingImageDropRef.current = {
      sourceId,
      targetId,
      insertAfter: event.clientY > targetRect.top + targetRect.height / 2,
    };
  }

  function commitImageMove(event, fallbackTargetId) {
    event.preventDefault();
    const sourceId = draggingImageId || event.dataTransfer.getData("text/plain");
    const pending = pendingImageDropRef.current;
    const targetId = pending?.sourceId === sourceId ? pending.targetId : fallbackTargetId;
    if (!sourceId || !targetId || sourceId === targetId) return;

    const currentDoc = docRef.current;
    const from = currentDoc.blocks.findIndex((block) => block.id === sourceId);
    const target = currentDoc.blocks.findIndex((block) => block.id === targetId);
    if (from < 0 || target < 0) return;

    const targetRect = event.currentTarget.getBoundingClientRect();
    const insertAfter =
      pending?.sourceId === sourceId && pending.targetId === targetId
        ? pending.insertAfter
        : event.clientY > targetRect.top + targetRect.height / 2;
    const blocks = [...currentDoc.blocks];
    const [moved] = blocks.splice(from, 1);
    const destination = blocks.findIndex((block) => block.id === targetId);
    blocks.splice(destination + (insertAfter ? 1 : 0), 0, moved);

    if (blocks.every((block, index) => block.id === currentDoc.blocks[index]?.id)) return;
    commitDoc({ ...currentDoc, blocks });
  }

  function moveImageBlock(sourceId, targetId, insertAfter) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const currentDoc = docRef.current;
    const from = currentDoc.blocks.findIndex((block) => block.id === sourceId);
    const target = currentDoc.blocks.findIndex((block) => block.id === targetId);
    if (from < 0 || target < 0) return;
    const blocks = [...currentDoc.blocks];
    const [moved] = blocks.splice(from, 1);
    const destination = blocks.findIndex((block) => block.id === targetId);
    blocks.splice(destination + (insertAfter ? 1 : 0), 0, moved);
    if (blocks.every((block, index) => block.id === currentDoc.blocks[index]?.id)) return;
    commitDoc({ ...currentDoc, blocks });
  }

  function finishImageDrag() {
    dragPointerY.current = null;
    pendingImageDropRef.current = null;
    setDraggingImageId(null);
  }

  // HTML5 DnD는 포인터가 화면 가장자리에 멈추면 dragover 이벤트가 더 이상 오지
  // 않을 수 있다. 마지막 포인터 위치를 기준으로 프레임마다 스크롤해 긴 글 끝까지
  // 자연스럽게 이동할 수 있게 한다.
  useEffect(() => {
    if (!draggingImageId) return undefined;
    let frameId = null;
    const edge = 100;

    const scrollNearEdge = () => {
      const y = dragPointerY.current;
      if (y === null) {
        frameId = null;
        return;
      }
      const distanceFromBottom = window.innerHeight - y;
      const distanceFromTop = y;
      let amount = 0;
      if (distanceFromBottom < edge) amount = Math.ceil((edge - distanceFromBottom) * 0.22);
      if (distanceFromTop < edge) amount = -Math.ceil((edge - distanceFromTop) * 0.22);
      if (amount) {
        window.scrollBy({ top: amount, behavior: "auto" });
        frameId = window.requestAnimationFrame(scrollNearEdge);
      } else {
        frameId = null;
      }
    };

    const trackDrag = (event) => {
      dragPointerY.current = event.clientY;
      if (frameId === null) frameId = window.requestAnimationFrame(scrollNearEdge);
    };

    document.addEventListener("pointermove", trackDrag);
    // 첫 dragover가 state 반영보다 먼저 발생해도, 드래그 시작 시 기록한 위치로
    // 가장자리 스크롤을 바로 시작한다.
    frameId = window.requestAnimationFrame(scrollNearEdge);
    return () => {
      document.removeEventListener("pointermove", trackDrag);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [draggingImageId]);

  // 이미지 크기·정렬은 글 원문이 아니라 게시물별 상태(`state.blogImageLayout`)에 둔다
  // — 카드뉴스와 공유하는 이미지 파일·문구는 그대로 두고, "이 글 안에서 얼마나
  // 크게·어느 쪽에 놓을지"만 따로 기억한다.
  function updateImageLayout(imageNo, patch) {
    const current = getState();
    const items = { ...(current.blogImageLayout || {}) };
    items[imageNo] = { ...(items[imageNo] || {}), ...patch };
    setState({ blogImageLayout: items });
  }

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

  const name = authorName || "블로그";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dateLabel = (() => {
    const now = new Date();
    return `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`;
  })();
  const hasTitle = Boolean(doc.quoteLine);

  return (
    <div>
      <div className="mx-auto w-full max-w-[1046px] overflow-hidden rounded-[12px] border border-[#e3e3e3] bg-white text-[#333]">
        <div className="flex items-center gap-1.5 border-b border-[#ededed] bg-[#f7f8f7] px-3.5 py-2 text-[11px] text-[#8e8e8e]">
          <span className="text-[13px] font-black text-[#03c75a]">N</span>
          <span className="min-w-0 truncate">blog.naver.com</span>
        </div>

        <div className="px-4 pt-4">
          <p className="text-[12px] text-[#8e8e8e]">전체보기 · 이야기</p>
          {hasTitle ? (
            <h2 className="mt-2 flex flex-wrap gap-x-1.5 break-words text-[19px] font-bold leading-[1.4] text-[#222]">
              <EditableText
                as="span"
                text={doc.title[0] || ""}
                onChangeText={(t) => updateTitleLine(0, t)}
                ariaLabel="블로그 제목 첫째 줄 (검색어)"
                placeholder="검색어가 들어갈 제목"
              />
              <EditableText
                as="span"
                text={doc.title[1] || ""}
                onChangeText={(t) => updateTitleLine(1, t)}
                ariaLabel="블로그 제목 둘째 줄 (후킹 문구)"
                placeholder="눈길을 끌 한마디"
              />
            </h2>
          ) : (
            <h2 className="mt-2 break-words text-[19px] font-bold leading-[1.4] text-[#222]">
              {titleHint?.trim() || "제목을 입력해 주세요"}
            </h2>
          )}

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
          {doc.blocks.map((block) => {
            if (block.type === "head") {
              return (
                <BlockShell
                  key={block.id}
                  blockId={block.id}
                  onDelete={() => deleteBlock(block.id)}
                  onDragOver={(event) => previewImageMove(event, block.id)}
                  onDrop={(event) => {
                    commitImageMove(event, block.id);
                    finishImageDrag();
                  }}
                  deleteLabel="이 소제목 삭제"
                >
                  <EditableText
                    as="h3"
                    text={block.text}
                    onChangeText={(t) => updateBlockText(block.id, t)}
                    onEnter={(before, after) => {
                      updateBlockText(block.id, before);
                      splitBlock(block.id, before, after, "para");
                    }}
                    autoFocus={block.id === focusBlockId}
                    ariaLabel="소제목"
                    placeholder="소제목을 입력하세요"
                    className="mb-3 mt-6 break-words rounded-sm text-[20px] font-bold leading-[1.5] text-[#222] first:mt-0 focus:ring-2 focus:ring-inset focus:ring-[#287aff]/50"
                  />
                </BlockShell>
              );
            }
            if (block.type === "image") {
              return (
                <ImageBlock
                  key={block.id}
                  block={block}
                  thumb={cardThumbs[block.no - 1]}
                  layout={state?.blogImageLayout?.[block.no]}
                  onCaptionChange={(caption) => updateImageCaption(block.id, caption)}
                  onLayoutChange={(patch) => updateImageLayout(block.no, patch)}
                  onDelete={() => deleteBlock(block.id)}
                  onEdit={() => onEditCard?.(block.no - 1)}
                  isPromptOnly={state?.concept === "intuitive"}
                  dragging={draggingImageId === block.id}
                  onPointerDown={startImageDrag}
                />
              );
            }
            if (block.type === "tags") {
              return (
                <BlockShell
                  key={block.id}
                  blockId={block.id}
                  onDelete={() => deleteBlock(block.id)}
                  onDragOver={(event) => previewImageMove(event, block.id)}
                  onDrop={(event) => {
                    commitImageMove(event, block.id);
                    finishImageDrag();
                  }}
                  deleteLabel="해시태그 줄 삭제"
                >
                  <EditableText
                    as="p"
                    text={block.text}
                    onChangeText={(t) => updateBlockText(block.id, t)}
                    ariaLabel="해시태그"
                    placeholder="#해시태그"
                    className="mt-4 break-words rounded-sm text-[14px] font-medium leading-6 text-[#1b63ab] focus:ring-2 focus:ring-inset focus:ring-[#287aff]/50"
                  />
                </BlockShell>
              );
            }
            return (
              <BlockShell
                key={block.id}
                blockId={block.id}
                onDelete={() => deleteBlock(block.id)}
                onDragOver={(event) => previewImageMove(event, block.id)}
                onDrop={(event) => {
                  commitImageMove(event, block.id);
                  finishImageDrag();
                }}
                deleteLabel="이 문단 삭제"
              >
                <EditableText
                  as="p"
                  text={block.text}
                  onChangeText={(t) => updateBlockText(block.id, t)}
                  onEnter={(before, after) => {
                    updateBlockText(block.id, before);
                    splitBlock(block.id, before, after, "para");
                  }}
                  autoFocus={block.id === focusBlockId}
                  ariaLabel="본문 문단"
                  placeholder="내용을 입력하세요"
                  className="mb-4 whitespace-pre-wrap break-words rounded-sm text-[15.5px] leading-5.5 text-[#333] last:mb-0 focus:ring-2 focus:ring-inset focus:ring-[#287aff]/50"
                />
              </BlockShell>
            );
          })}

          <button
            type="button"
            onClick={appendParagraph}
            className="mt-2 inline-flex items-center gap-1 rounded-full border border-dashed border-[#d1d6db] px-3 py-1.5 text-[13px] font-semibold text-[#8b95a1] transition hover:border-[#287aff] hover:text-[#287aff]"
          >
            <span aria-hidden="true" className="text-[15px] leading-none">+</span>
            문단 추가
          </button>
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
        네이버 블로그에서 보이는 모양을 흉내 낸 미리보기입니다. 제목·소제목·문단·이미지
        설명을 클릭해 바로 고칠 수 있어요. 카드뉴스 미리보기를 누르면 그 카드를 바로
        편집할 수 있습니다. 실제 화면과는 다를 수 있습니다.
      </p>
    </div>
  );
}
