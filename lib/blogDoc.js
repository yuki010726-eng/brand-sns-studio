/**
 * 블로그 원문(`state.drafts.blog`) 파서 — 순수 JS, React·브라우저 전용 API 없음.
 *
 * 원래 `app/_components/text/NaverBlogPreview.jsx` 안에 있었다. 네이버 자동 발행
 * 스크립트(`scripts/naver-fill.mjs`, Node 에서 돈다)도 **같은 파서**로 원고를 읽어야
 * 화면에 보이는 것과 실제로 채워 넣는 내용이 어긋나지 않는다 — 그런데 그 컴포넌트
 * 파일은 "use client"이고 `lib/imagestore.js`(IndexedDB, 브라우저 전용)를 가져오므로
 * Node 스크립트에서 그대로 import 할 수 없다. 그래서 파싱 로직만 여기로 뽑았다.
 *
 * ⚠️ 파서를 또 새로 만들지 말 것. 이미지 자리·캡션·소제목 판정 규칙이 어긋나면
 *    화면·복사·자동 발행이 서로 다른 걸 보게 된다(8-22 와 같은 실패).
 */

export const QUOTE_RE = /^\[[^\]]*인용구\]$/;
export const SLOT_RE = /^\s*📷\s*\[이미지\s*(\d+)(?:\s*[·・-]\s*([^\]]+))?\]/;
export const CAPTION_RE = /^⤷\s*(.+?)\s*$/;
export const HEAD_RE = /^(?:#{2,6}|■)\s+(.+)$/;
export const TAGS_RE = /^(#[^#\s]+\s*)+$/;

let blockSeq = 0;
const newBlockId = () => `blk-${Date.now().toString(36)}-${(blockSeq++).toString(36)}`;

/**
 * 원고를 제목 두 줄 + 블록 목록으로 나눈다. 블록 타입: `head`(소제목) · `image`(카드뉴스
 * 자리, `no`·`role`·`caption`) · `tags`(해시태그 줄) · `para`(본문 문단, 줄바꿈 보존).
 *
 * ⚠️ 원문에 실제로 빈 줄이 있는 경계만 문단 경계로 본다 — 길이로 임의로 쪼개지 않는다.
 */
export function parseBlogDoc(raw) {
  const lines = String(raw || "").split("\n");
  let quoteLine = "";
  const title = [];
  let cursor = 0;

  if (QUOTE_RE.test(lines[0]?.trim() || "")) {
    quoteLine = lines[0].trim();
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
    blocks.push({ id: newBlockId(), type: "para", text: paraLines.join("\n") });
    paraLines = [];
  };

  for (let index = cursor; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      flushPara();
      continue;
    }

    const slot = line.match(SLOT_RE);
    if (slot) {
      flushPara();
      const captionLine = lines[index + 1]?.trim() || "";
      const captionMatch = captionLine.match(CAPTION_RE);
      const caption = captionMatch ? captionMatch[1] : "";
      if (caption) index += 1;
      blocks.push({
        id: newBlockId(),
        type: "image",
        no: Number(slot[1]),
        role: (slot[2] || "").trim(),
        caption,
      });
      continue;
    }

    const head = line.match(HEAD_RE);
    if (head) {
      flushPara();
      blocks.push({ id: newBlockId(), type: "head", text: head[1].trim() });
      continue;
    }

    if (TAGS_RE.test(line)) {
      flushPara();
      blocks.push({ id: newBlockId(), type: "tags", text: line });
      continue;
    }

    paraLines.push(line);
  }
  flushPara();

  return { quoteLine, title, blocks };
}

/** `parseBlogDoc()` 의 역연산 — 편집한 블록을 같은 원문 형식으로 되돌린다. */
export function serializeBlogDoc({ quoteLine, title, blocks }) {
  const parts = [];
  if (quoteLine) parts.push([quoteLine, ...title].join("\n"));
  for (const block of blocks) {
    if (block.type === "head") {
      parts.push(`## ${block.text}`);
    } else if (block.type === "tags") {
      parts.push(block.text);
    } else if (block.type === "image") {
      const label = block.role
        ? `📷 [이미지 ${block.no} · ${block.role}]`
        : `📷 [이미지 ${block.no}]`;
      parts.push(block.caption ? `${label}\n⤷ ${block.caption}` : label);
    } else {
      parts.push(block.text);
    }
  }
  return parts.join("\n\n");
}
