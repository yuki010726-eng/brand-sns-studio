import { useState } from "react";
import { Icon } from "../Icon.jsx";
import { CopyChatPanel } from "./CopyChatPanel.jsx";
import { CompliancePanel } from "./CompliancePanel.jsx";
import { InstagramPostPreview } from "./InstagramPostPreview.jsx";
import { NaverBlogPreview } from "./NaverBlogPreview.jsx";
import { CardEditModal } from "./CardEditModal.jsx";
import { useCardDeck } from "./useCardDeck.js";
import { InstagramPublishDialog } from "../../template/_components/InstagramPublishDialog.jsx";
import { fillNaverDraft, getSavedNaverBlogId, saveNaverBlogId } from "../../../lib/naverFillClient.js";
import { parseBlogDoc } from "../../../lib/blogDoc.js";
import { publishInstagramCarousel, removeInstagramCards, uploadInstagramCards } from "../../../lib/instagram.js";
import { getActiveInstagramAccountId, getInstagramAccounts } from "../../../lib/instagram-accounts.js";
import { toast } from "../../../components/toast.js";

const QUOTE_RE = /^\[[^\]]*인용구\]$/;
const SLOT_RE = /^📷\s*\[이미지\s*(\d+)\s*·\s*([^\]]+)\]/;

/**
 * 카드뉴스 미리보기(`NaverBlogPreview.jsx`)의 이미지는 `rounded-md` CSS로 모서리를 둥글게
 * 잘라 보여주지만, 그건 화면에서만 그런 것이고 실제 PNG 파일 자체는 각진 사각형이다.
 * 네이버 에디터는 이미지마다 모서리 반경을 설정하는 기능이 없다 — 사진 편집 도구(NPE)를
 * 열어 봤지만 도형 마스크 없이 명도/채도 마스크·액자·모자이크뿐이라 자동화로 안정적으로
 * 흉내 내기 어렵다(2026-09-09). 그래서 **업로드하기 전에 이미지 자체의 네 모서리를
 * 투명하게 잘라서** 보낸다 — 결과가 항상 정확하고, 네이버 쪽 UI가 바뀌어도 안 깨진다.
 *
 * 반경은 원본 폭(1080px, `lib/cardrender.js`의 `W`)의 5% — 미리보기 뒤에 어떤 크기(S/M/L)
 * 로 축소되어 올라가든 실제 화면에 보이는 반경이 늘 비슷한 비율로 보이게 하려는 것이다.
 */
async function roundedImageDataUrl(dataUrl) {
  if (typeof window === "undefined" || !dataUrl) return dataUrl;
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    const r = Math.round(img.width * 0.05);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(canvas.width, 0, canvas.width, canvas.height, r);
    ctx.arcTo(canvas.width, canvas.height, 0, canvas.height, r);
    ctx.arcTo(0, canvas.height, 0, 0, r);
    ctx.arcTo(0, 0, canvas.width, 0, r);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    // 모서리를 못 둥글게 해도 원본 이미지는 그대로 올라가는 게 낫다.
    return dataUrl;
  }
}

const ISSUE_UNDERLINE = {
  warning: "decoration-amber-500",
  review: "decoration-orange-600",
  error: "decoration-red-500",
};

function HighlightedText({ text, issues }) {
  const ranges = issues
    .filter((issue) => issue.match)
    .flatMap((issue) => {
      const rangesForIssue = [];
      let start = 0;
      while (start < text.length) {
        const index = text.indexOf(issue.match, start);
        if (index === -1) break;
        rangesForIssue.push({
          start: index,
          end: index + issue.match.length,
          level: issue.level,
        });
        start = index + issue.match.length;
      }
      return rangesForIssue;
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  if (!ranges.length) return text;

  const nodes = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) nodes.push(text.slice(cursor, range.start));
    nodes.push(
      <span
        key={`${range.start}-${range.end}-${range.level}`}
        className={`underline decoration-2 underline-offset-4 ${ISSUE_UNDERLINE[range.level] || ISSUE_UNDERLINE.warning}`}
      >
        {text.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function Preview({ value, issues = [] }) {
  const lines = value.split("\n");
  const nodes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    if (QUOTE_RE.test(line)) {
      const title = [lines[index + 1]?.trim(), lines[index + 2]?.trim()].filter(
        Boolean,
      );
      index += title.length;
      nodes.push(
        <blockquote
          key={`quote-${index}`}
          className="relative mb-[38px] min-h-[76px] px-12 pt-2 text-center font-serif text-[15px] leading-[28px] text-[#4e5968] before:absolute before:left-2 before:top-[-4px] before:text-[44px] before:font-bold before:text-[#c7cbd1] before:content-['“'] after:absolute after:bottom-[-10px] after:left-[68%] after:text-[44px] after:font-bold after:text-[#c7cbd1] after:content-['”']"
        >
          {title.map((text) => (
            <span key={text} className="block">
              <HighlightedText text={text} issues={issues} />
            </span>
          ))}
        </blockquote>,
      );
      continue;
    }

    const slot = line.match(SLOT_RE);
    if (slot) {
      const captionLine = lines[index + 1]?.trim() || "";
      const caption = captionLine.startsWith("⤷")
        ? captionLine.slice(1).trim()
        : "";
      if (caption) index += 1;
      nodes.push(
        <div
          key={`slot-${index}`}
          className="my-[16px] flex min-h-[59px] flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-[#e5e8eb] px-4 py-3"
        >
          <span className="rounded-full bg-[#f2f4f6] px-[11px] py-1 text-xs font-bold leading-[22px] text-[#5f6b7a]">
            이미지 {slot[1]} · {slot[2]}
          </span>
          {caption && (
            <span className="text-[13px] leading-6 text-[#5f6b7a]">
              {caption}
            </span>
          )}
        </div>,
      );
      continue;
    }

    if (line.startsWith("## ")) {
      nodes.push(
        <h3
          key={`head-${index}`}
          className="mb-[24px] mt-[38px] border-l-2 border-[#191f28] pl-3 text-[18px] font-black leading-[26px] text-[#191f28]"
        >
          <HighlightedText text={line.slice(3)} issues={issues} />
        </h3>,
      );
      continue;
    }

    if (/^(#[^#\s]+\s*)+$/.test(line)) {
      nodes.push(
        <div key={`tags-${index}`} className="mt-[30px] flex flex-wrap gap-1.5">
          {line.split(/\s+/).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#f2f4f6] px-2.5 py-1 text-[13px] leading-6 text-[#5f6b7a]"
            >
              {tag}
            </span>
          ))}
        </div>,
      );
      continue;
    }

    nodes.push(
      <p
        key={`text-${index}`}
        className="mb-[16px] whitespace-pre-wrap text-[15px] leading-[28px] text-[#4e5968]"
      >
        <HighlightedText text={line} issues={issues} />
      </p>,
    );
  }
  return nodes.length ? (
    nodes
  ) : (
    <p className="py-16 text-center text-[15px] text-[#8b95a1]">
      AI 생성 버튼을 눌러 글을 만들어 보세요.
    </p>
  );
}

export function CopyEditor({
  channel,
  value,
  generatedValue,
  readMode,
  compliance,
  runSelector,
  onChange,
  onToggleMode,
  onCopy,
  showChat,
  chatContextKey,
  draftLabel,
  generation,
  onToggleGenerationPause,
  onCancelGeneration,
  instagramHandle,
  cardCount,
  blogTitle,
  productName,
  state,
  product,
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [naverBlogId, setNaverBlogId] = useState(() => getSavedNaverBlogId());
  const [naverFilling, setNaverFilling] = useState(false);
  const [instagramDialog, setInstagramDialog] = useState(null);
  const [publishingInstagram, setPublishingInstagram] = useState(false);
  // 블로그·인스타그램 미리보기가 함께 보는 카드뉴스 덱·썸네일 — 어느 채널의 이미지
  // 부분을 눌러도 같은 모달(`CardEditModal`)로 같은 카드를 편집해야 하므로 한 곳에서 만든다.
  const [editIndex, setEditIndex] = useState(null);
  const { deck, cardThumbs, previewCard } = useCardDeck(state, product, {
    suspendThumbs: editIndex != null,
  });
  const hasLimit = Number.isFinite(channel.limit) && channel.limit > 0;
  const over = hasLimit && value.length > channel.limit;
  const bodyCount = value
    .split("\n")
    .filter(
      (line) =>
        !SLOT_RE.test(line.trim()) &&
        !line.trim().startsWith("⤷") &&
        !QUOTE_RE.test(line.trim()),
    )
    .join("\n").length;

  // ⚠️ 발행 버튼은 여기서 누르지 않는다 — 제목·본문만 채워 넣고, 뜬 브라우저 창에서
  //    사람이 직접 확인하고 발행한다(요청자 결정, 2026-09-09). 로그인 세션도 사람이
  //    `npm run naver:setup` 으로 한 번 직접 로그인해 둔 걸 재사용할 뿐, 이 코드는
  //    아이디·비밀번호를 다루지 않는다.
  async function handleNaverFill() {
    const blogId = naverBlogId.trim();
    if (!blogId) {
      toast("네이버 블로그 아이디를 먼저 입력해 주세요.");
      return;
    }
    if (!value.trim()) {
      toast("채워 넣을 글이 없습니다.");
      return;
    }
    saveNaverBlogId(blogId);
    setNaverFilling(true);
    try {
      // 원고 안 이미지 자리(`📷 [이미지 N …]`)마다 실제 카드뉴스 썸네일을 붙여 보낸다.
      // `cardThumbs` 는 0-based(`no - 1`)인데 원고의 이미지 번호는 1-based — 다른 곳
      // (`NaverBlogPreview.jsx`)과 같은 규칙으로 맞춘다. 아직 안 만든 카드는 빠지고,
      // 서버 쪽(`fillBody`)이 그 자리를 대괄호 텍스트로 대신 채운다.
      // 크기·정렬도 미리보기(`NaverBlogPreview.jsx`)에서 고른 그대로 넘긴다 — 안 고른
      // 이미지는 그 컴포넌트와 똑같은 기본값(M · 가운데 정렬)을 쓴다. `state.blogImageLayout`
      // 를 그대로 보내면 사람이 안 건드린 이미지는 빠져서 네이버 쪽 기본값(왼쪽 정렬)으로
      // 나가 미리보기와 어긋난다 — 그래서 기본값까지 여기서 채워서 보낸다.
      const images = {};
      const imageLayout = {};
      for (const block of parseBlogDoc(value).blocks) {
        if (block.type !== "image") continue;
        const thumb = cardThumbs[block.no - 1];
        // 미리보기가 모서리를 둥글게 잘라 보여주는 것과 똑같이 보이도록, 업로드하기 전에
        // 이미지 자체의 모서리를 미리 둥글게 잘라 둔다(`roundedImageDataUrl` 참고) —
        // 네이버 에디터에는 이미지별 모서리 반경 설정이 없다.
        if (thumb) images[block.no] = await roundedImageDataUrl(thumb);
        const layout = state?.blogImageLayout?.[block.no];
        imageLayout[block.no] = { size: layout?.size || "md", align: layout?.align || "center" };
      }
      // 제목은 원고 안 인용구 두 줄이 아니라 "글 구조 요약"에서 고른 제목을 쓴다
      // (요청자 지시, 2026-09-09) — 그 제목이 카드뉴스 표지 문구 등 나머지 글의
      // 기준이므로, 네이버에 올라가는 제목도 같은 것이어야 한다.
      await fillNaverDraft({ rawDraft: value, blogId, images, imageLayout, title: blogTitle });
      toast("네이버 글쓰기 화면에 채워 넣었습니다. 뜬 브라우저 창에서 내용을 확인하고 직접 발행해 주세요.");
    } catch (error) {
      toast(error?.message || "네이버에 채워 넣지 못했습니다.");
    } finally {
      setNaverFilling(false);
    }
  }

  async function handleOpenInstagram() {
    if (deck.length > 10) {
      toast("Instagram 캐러셀은 최대 10장까지 게시할 수 있습니다.");
      return;
    }
    if (!deck.length || Object.keys(cardThumbs).length !== deck.length) {
      toast("게시 이미지를 준비하는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    try {
      const accounts = await getInstagramAccounts();
      if (!accounts.length) {
        toast("연결된 Instagram 계정이 없습니다. 마이페이지에서 계정을 먼저 연결해 주세요.");
        return;
      }
      const blobs = await Promise.all(deck.map(async (_, index) => {
        const response = await fetch(cardThumbs[index]);
        if (!response.ok) throw new Error("게시 이미지를 준비하지 못했습니다.");
        return response.blob();
      }));
      const activeAccountId = getActiveInstagramAccountId();
      setInstagramDialog({
        blobs,
        previews: deck.map((_, index) => cardThumbs[index]),
        caption: value,
        accounts,
        accountId: activeAccountId || (accounts.length === 1 ? accounts[0].instagram_user_id : ""),
        accountLocked: Boolean(activeAccountId),
      });
    } catch (error) {
      toast(error.message || "게시 이미지를 준비하지 못했습니다.");
    }
  }

  async function handlePublishInstagram() {
    if (!instagramDialog || publishingInstagram || !instagramDialog.accountId) return;
    setPublishingInstagram(true);
    let uploaded;
    try {
      uploaded = await uploadInstagramCards(instagramDialog.blobs, state.postId);
      const result = await publishInstagramCarousel(uploaded.urls, instagramDialog.caption, instagramDialog.accountId);
      toast(`Instagram 게시가 완료되었습니다. (${result.id})`);
      setInstagramDialog(null);
    } catch (error) {
      toast(error.message || "Instagram 게시에 실패했습니다.");
    } finally {
      if (uploaded?.paths) await removeInstagramCards(uploaded.paths);
      setPublishingInstagram(false);
    }
  }

  return (
    <section
      role="tabpanel"
      aria-labelledby={`tab-${channel.id}`}
      className="px-[21px] pb-[22px] pt-[34px]"
    >
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div>{runSelector}</div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
          <output
            className={`mr-5 text-[15px] font-bold ${over ? "text-red-200" : "text-white"}`}
          >
            본문 {bodyCount.toLocaleString()}자 · 전체 {value.length.toLocaleString()}자
            {hasLimit ? ` / ${channel.limit.toLocaleString()}자` : ""}
          </output>
          {channel.id !== "blog" && (
            <button
              type="button"
              onClick={onToggleMode}
              className="inline-flex h-[45px] items-center gap-[5px] rounded-full border border-[#e5e8eb] bg-white px-[19px] text-[15px] font-medium text-[#4e5968]"
            >
              <Icon name={readMode ? "edit" : "eye"} className="size-[18px]" />
              {readMode ? "고치기" : "미리보기"}
            </button>
          )}
          {channel.id === "instagram" && (
            <button
              type="button"
              onClick={handleOpenInstagram}
              disabled={publishingInstagram}
              className="inline-flex h-[45px] items-center gap-[5px] rounded-full border border-[#e1306c] bg-[#e1306c] px-[19px] text-[15px] font-bold text-white hover:bg-[#c82361] disabled:opacity-40"
            >
              <Icon name="instagram" className="size-[18px]" />
              {publishingInstagram ? "게시 중…" : "Instagram에 게시"}
            </button>
          )}
          {channel.id === "blog" && (
            <>
              <label className="sr-only" htmlFor="naver-blog-id">
                네이버 블로그 아이디
              </label>
              <input
                id="naver-blog-id"
                type="text"
                value={naverBlogId}
                onChange={(e) => setNaverBlogId(e.target.value)}
                placeholder="네이버 블로그 아이디"
                autoComplete="off"
                className="h-[45px] w-[160px] rounded-full border border-[#e5e8eb] bg-white px-[16px] text-[14px] text-[#333]"
              />
              <button
                type="button"
                onClick={handleNaverFill}
                disabled={naverFilling}
                title="제목·본문만 채우고 멈춥니다. 발행은 뜬 브라우저 창에서 직접 눌러야 합니다."
                className="inline-flex h-[45px] items-center gap-[5px] rounded-full border border-[#03c75a] bg-white px-[19px] text-[15px] font-bold text-[#03c75a] disabled:opacity-50"
              >
                <Icon
                  name={naverFilling ? "refresh" : "external"}
                  className={`size-[18px] ${naverFilling ? "animate-spin" : ""}`}
                />
                {naverFilling ? "채우는 중…" : "네이버에 채우기"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-[45px] items-center gap-[5px] rounded-full border border-[#287aff] bg-[#287aff] px-[19px] text-[15px] font-bold text-white hover:bg-[#1769ed]"
          >
            <Icon name="copy" className="size-[18px]" />
            복사
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <div className="rounded-xl border border-[#e5e8eb] bg-white shadow-[0_0_2px_rgba(0,30,78,0.07)]">
          {generation ? (
            <div
              className="flex min-h-[200px] flex-col justify-center px-6 py-12"
              role="status"
              aria-live="polite"
            >
              <div className="mx-auto w-full max-w-md rounded-xl border border-[#e5e8eb] bg-[#f8f9fa] px-5 py-4 text-[#4e5968]">
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <span className="font-semibold">
                    {generation.paused
                      ? "AI 생성 일시정지 중"
                      : `${generation.channelName || "AI 결과"} 생성 중…`}
                  </span>
                  <span className="text-[#8b95a1]">
                    {generation.current}/{generation.total}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-[#6b7684]">
                  조금만 기다려주세요. 다른 곳으로 이동할 경우 생성이 취소됩니다.
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e5e8eb]">
                  <div
                    className="h-full rounded-full bg-[#287aff] transition-[width] duration-300"
                    style={{
                      width: `${Math.max(8, (generation.current / generation.total) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onToggleGenerationPause}
                    className="rounded-full border border-[#d1d6db] bg-white px-3 py-1.5 text-[13px] font-semibold hover:bg-[#f2f4f6]"
                  >
                    {generation.paused ? "계속하기" : "일시정지"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelGeneration}
                    className="rounded-full border border-[#ff6b6b]/60 bg-white px-3 py-1.5 text-[13px] font-semibold text-[#e5484d] hover:bg-[#fff0f0]"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          ) : channel.id === "blog" ? (
            value.trim() ? (
              <article className="min-h-[200px] break-words px-6 py-6 sm:px-[25px] sm:py-[25px]">
                <NaverBlogPreview
                  value={value}
                  title={blogTitle}
                  authorName={productName}
                  state={state}
                  product={product}
                  deck={deck}
                  cardThumbs={cardThumbs}
                  onEditCard={setEditIndex}
                  onChange={onChange}
                />
              </article>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center px-6 py-6">
                <p className="text-[15px] text-[#8b95a1]">
                  AI 생성 버튼을 눌러 글을 만들어 보세요.
                </p>
              </div>
            )
          ) : readMode && channel.id === "instagram" ? (
            value.trim() ? (
              <article className="flex min-h-[200px] flex-col gap-8 break-words px-6 py-6 sm:px-[25px] sm:py-[25px] lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <Preview value={value} issues={compliance.issues} />
                </div>
                <div className="w-full shrink-0 lg:sticky lg:top-[calc(var(--header-h)+20px)] lg:w-[380px]">
                  <InstagramPostPreview
                    value={value}
                    handle={instagramHandle}
                    cardCount={cardCount}
                    deck={deck}
                    cardThumbs={cardThumbs}
                    onEditCard={setEditIndex}
                  />
                </div>
              </article>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center px-6 py-6">
                <p className="text-[15px] text-[#8b95a1]">
                  AI 생성 버튼을 눌러 글을 만들어 보세요.
                </p>
              </div>
            )
          ) : readMode ? (
            <article className="min-h-[200px] break-words px-6 py-6 sm:px-[25px] sm:py-[25px]">
              <Preview value={value} issues={compliance.issues} />
            </article>
          ) : (
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              spellCheck="false"
              aria-label={`${channel.name} 글 편집`}
              className="min-h-[760px] w-full resize-y rounded-xl border-0 bg-white p-6 text-[15px] leading-[28px] text-[#4e5968] outline-none focus:ring-2 focus:ring-inset focus:ring-[#287aff]"
            />
          )}
        </div>

        {generatedValue.trim() && !generation ? (
          <CompliancePanel report={compliance} />
        ) : null}
      </div>

      {showChat && (
        <>
          <button
            type="button"
            onClick={() => setChatOpen((open) => !open)}
            aria-label={chatOpen ? "글쓰기 도우미 닫기" : "글쓰기 도우미 열기"}
            aria-expanded={chatOpen}
            className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-[#287aff] text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-colors hover:bg-[#1769ed]"
          >
            <Icon name={chatOpen ? "close" : "chat"} className="size-6" />
          </button>

          {chatOpen && (
            <div className="fixed bottom-24 right-6 z-40 flex h-[min(70vh,640px)] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-[#e5e8eb] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
              <CopyChatPanel
                key={chatContextKey}
                channelId={channel.id}
                channelName={channel.name}
                contextKey={chatContextKey}
                draftLabel={draftLabel}
                draftValue={value}
                onApplyToDraft={onChange}
                onClose={() => setChatOpen(false)}
              />
            </div>
          )}
        </>
      )}

      <InstagramPublishDialog
        open={Boolean(instagramDialog)}
        images={instagramDialog?.previews || []}
        caption={instagramDialog?.caption || ""}
        accounts={instagramDialog?.accounts || []}
        accountId={instagramDialog?.accountId || ""}
        accountLocked={Boolean(instagramDialog?.accountLocked)}
        busy={publishingInstagram}
        onAccountChange={(accountId) => setInstagramDialog((current) => current ? { ...current, accountId } : current)}
        onCaptionChange={(caption) => setInstagramDialog((current) => current ? { ...current, caption } : current)}
        onClose={() => !publishingInstagram && setInstagramDialog(null)}
        onPublish={handlePublishInstagram}
      />
      <CardEditModal
        product={product}
        deck={deck}
        previewCard={previewCard}
        cardIndex={editIndex}
        onClose={() => setEditIndex(null)}
      />
    </section>
  );
}
