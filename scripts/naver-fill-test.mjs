/**
 * 네이버 자동 발행 — 2단계 테스트: 제목·본문 채우기가 실제로 되는지 확인한다.
 *
 * 샘플 제목·본문을 채워 넣고 스크린샷을 찍어 `.naver-profile/test-fill.png` 에 저장한다.
 * **발행 버튼은 누르지 않는다.** 네이버가 자동저장을 하므로 초안(저장) 목록에 이
 * 테스트 글이 하나 남을 수 있다 — 확인 후 블로그 관리 화면에서 지워도 된다.
 *
 * 실행: node scripts/naver-fill-test.mjs [blogId]
 *   blogId 를 안 주면 `npm run naver:setup` 때 확인된 qosuh58 을 기본값으로 쓴다.
 */
import path from "node:path";
import { openBrowser, openWritePage, fillTitle, fillBody } from "../lib/naverPublish.js";

const blogId = process.argv[2] || "qosuh58";

// 1x1 빨간 픽셀 PNG — 실제 카드뉴스 이미지 대신 쓰는 테스트용. 업로드 파이프라인
// (filechooser → setFiles → CDN 업로드 대기)이 맞는지만 확인하면 되므로 크기는 상관없다.
const TEST_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const SAMPLE_DRAFT = `[테스트 인용구]
자동화 테스트 검색어
자동화 테스트 후킹 문구

## 첫 번째 소제목입니다

여기는 첫 번째 문단이에요. 자동으로 채워지는지 확인하는 테스트 글입니다.
두 번째 줄도 같은 문단 안에 있어요.

📷 [이미지 1 · 표지]
⤷ 표지 캡션 자리

## 두 번째 소제목입니다

두 번째 문단입니다. 여기까지 잘 채워지면 성공입니다.`;

async function main() {
  console.log(`blogId=${blogId} 로 글쓰기 화면을 엽니다...`);
  const { context, page } = await openBrowser();

  // ⚠️ 여기서부터는 무슨 일이 있어도 finally 에서 context.close() 를 부른다.
  //    안 그러면 실패했을 때 브라우저 프로세스가 살아남아 `.naver-profile/` 를
  //    계속 잠그고, 다음 실행이 전부 "다른 프로그램이 이 프로필을 쓰고 있다"로
  //    막힌다 — 실제로 두 번 겪고서야 알았다. 죽은 프로세스는
  //    `Get-Process chrome | Where Path -like *ms-playwright*` 로 찾아 정리한다.
  try {
    let frame;
    try {
      frame = await openWritePage(page, blogId);
    } catch (err) {
      console.error("에디터를 못 찾았습니다. 지금 화면을 찍어서 남깁니다.");
      const shotPath = path.resolve(process.cwd(), ".naver-profile", "fail.png");
      await page.screenshot({ path: shotPath, fullPage: true });
      console.error(`현재 URL: ${page.url()}`);
      console.error(`실패 스크린샷: ${shotPath}`);
      console.error(`프레임 목록: ${page.frames().map((f) => f.name() || "(이름 없음)").join(", ")}`);
      throw err;
    }

    console.log("제목을 채웁니다...");
    await fillTitle(page, frame, "[자동화 테스트] 지워도 되는 글입니다");

    console.log("본문을 채웁니다...");
    await fillBody(page, frame, SAMPLE_DRAFT, { 1: TEST_IMAGE_DATA_URL });

    const shotPath = path.resolve(process.cwd(), ".naver-profile", "test-fill.png");
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`스크린샷 저장: ${shotPath}`);
  } finally {
    await context.close();
    console.log("브라우저를 닫았습니다.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
