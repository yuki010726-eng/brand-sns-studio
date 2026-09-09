/**
 * 제목·소제목 서식·이미지 업로드가 실제로 맞게 들어갔는지 **DOM 값을 직접 읽어** 확인한다.
 *
 * ⚠️ `naver-fill-test.mjs`(스크린샷)만 보고 판단하지 말 것 — 이 컴퓨터의 Playwright
 *    크로미움은 제목처럼 크고 굵은 한글을 스크린샷에서 깨지게 그리는 폰트 렌더링
 *    문제가 있다(`lib/naverPublish.js`의 `fillTitle` 주석 참고). 실제로 잘 들어갔는지는
 *    이 스크립트처럼 `frame.evaluate()`로 DOM 텍스트를 직접 읽어야 확실하다.
 *
 * 실행: node scripts/naver-verify.mjs [blogId]  (또는 npm run naver:verify)
 */
import zlib from "node:zlib";
import { openBrowser, openWritePage, fillTitle, fillBody } from "../lib/naverPublish.js";

const blogId = process.argv[2] || "qosuh58";
const TITLE = "[검증용] 지워도 되는 글입니다";

// 순수 Node로 108x135(4:5, 카드뉴스와 같은 비율) 단색 PNG를 만든다 — 정사각형 이미지로는
// 너비만 바꿔도 우연히 높이가 같아 보여 비율 유지가 실제로 되는지 확인할 수 없다.
function makeSolidPng(width, height, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const typeBuf = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    for (let x = 0; x < width; x += 1) {
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const TEST_IMAGE_DATA_URL = `data:image/png;base64,${makeSolidPng(108, 135, [255, 80, 80]).toString("base64")}`;

const DRAFT = `[검증용 인용구]
검증 검색어
검증 후킹 문구

## 첫 번째 소제목입니다

첫 번째 문단입니다.

📷 [이미지 1 · 표지]
⤷ 표지 캡션

## 두 번째 소제목입니다

두 번째 문단입니다.`;

async function main() {
  const { context, page } = await openBrowser();
  try {
    const frame = await openWritePage(page, blogId);
    await fillTitle(page, frame, TITLE);
    // lg(320px) · 오른쪽 정렬 — 네이버 기본값(작게 320px 아닌 원본 크기 · 왼쪽 정렬)과
    // 다른 값이라 실제로 적용됐는지(그냥 기본값이 우연히 맞는 게 아닌지) 구분할 수 있다.
    await fillBody(page, frame, DRAFT, { 1: TEST_IMAGE_DATA_URL }, { 1: { size: "lg", align: "right" } });
    await page.waitForTimeout(500);

    const result = await frame.evaluate(() => {
      const title = document.querySelector(".se-title-text")?.textContent || "";
      // 소제목 컴포넌트는 se-sectionTitle 계열 클래스를 가진 블록 안에 있다.
      const headings = Array.from(document.querySelectorAll('[class*="sectionTitle"]'))
        .map((el) => el.textContent.trim())
        .filter(Boolean);
      const images = Array.from(document.querySelectorAll("img.se-image-resource")).map((img) => ({
        src: img.getAttribute("src"),
        uploaded: (img.getAttribute("src") || "").startsWith("https://"),
        width: img.getAttribute("width"),
      }));
      // 정렬은 `.se-component`가 아니라 그 위 `.se-section`에 `se-section-align-*`로
      // 남는다(2026-09-09, 조상 체인을 하나씩 덤프해서 찾았다). 이 값은 툴바가 사라진
      // 뒤에도(선택 해제 이후에도) 남는 실제 서식 값이다.
      const section = document.querySelector("img.se-image-resource")?.closest(".se-section");
      const captionEl = document.querySelector(".se-caption");
      const bodyText = document.body.textContent;
      return {
        title,
        headings,
        images,
        sectionAlignClass: section ? [...section.classList].find((c) => c.startsWith("se-section-align-")) : null,
        hasFirstPara: bodyText.includes("첫 번째 문단입니다"),
        captionInNativeField: captionEl ? captionEl.textContent.trim() : null,
      };
    });

    console.log("=== 검증 결과 ===");
    console.log("제목 일치:", result.title === TITLE, `(실제: "${result.title}")`);
    console.log("소제목 후보:", JSON.stringify(result.headings));
    console.log("이미지:", JSON.stringify(result.images), "(width가 320이면 lg 적용 성공)");
    console.log("정렬 클래스:", result.sectionAlignClass, "(se-section-align-right 면 성공)");
    console.log("본문 문단 포함:", result.hasFirstPara);
    console.log("네이버 '사진 설명' 칸 내용:", JSON.stringify(result.captionInNativeField), '("표지 캡션"이면 성공 — 대괄호나 별도 문단이 아니라 네이티브 캡션 필드에 들어간 것)');
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
