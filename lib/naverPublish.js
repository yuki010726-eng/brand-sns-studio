/**
 * 네이버 블로그 자동 발행 — Playwright 로 스마트에디터를 채운다.
 *
 * ⚠️ **Node 전용이다.** `playwright` 는 브라우저 번들에 들어가면 안 되므로, 이 파일은
 *    반드시 서버(`app/api/.../route.jsx`)나 `scripts/*.mjs` 에서만 import 한다.
 *    React 컴포넌트에서 직접 가져오면 클라이언트 번들이 깨진다.
 *
 * ⚠️ **발행 버튼은 여기서 누르지 않는다** (요청자 결정, 2026-09-09). 제목·본문·이미지를
 *    채워 두기만 하고 멈춘다 — 사람이 눈으로 확인하고 직접 발행 버튼을 누른다.
 *
 * ⚠️ 로그인은 `.naver-profile/` 에 저장된 **브라우저 세션을 재사용**한다(요청자 결정).
 *    아이디·비밀번호를 이 코드가 다루는 일은 없다 — `npm run naver:setup` 으로
 *    사람이 직접 한 번 로그인해 두면 이후 세션이 재사용된다. 세션이 없거나 만료됐으면
 *    `headless:false` 라 뜬 창에서 다시 로그인하면 된다.
 */
import { chromium } from "playwright";
import path from "node:path";
import { parseBlogDoc } from "./blogDoc.js";

const PROFILE_DIR = path.resolve(process.cwd(), ".naver-profile");

const writeUrl = (blogId) =>
  `https://blog.naver.com/PostWriteForm.naver?blogId=${encodeURIComponent(blogId)}&Redirect=Write`;

/**
 * 원고의 인용구 다음 두 줄(검색어 · 후킹 문구, `NaverBlogPreview.jsx` 가 편집하는 그 줄)을
 * 합쳐 실제 네이버 제목으로 쓴다. 화면 미리보기와 자동 발행이 다른 제목을 보면 안 되므로
 * `parseBlogDoc` 을 그대로 재사용한다 — 여기서 따로 정규식을 만들지 않는다.
 */
export function titleFromDraft(rawDraft) {
  const { title } = parseBlogDoc(rawDraft);
  return (title || []).filter(Boolean).join(" ").trim();
}

/** 세션(쿠키)이 저장된 프로필로 브라우저를 연다. 매번 새로 로그인하지 않는다. */
export async function openBrowser() {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  // 네이버가 "작성 중인 글이 있습니다" 같은 native confirm/alert 을 띄우면 자동으로
  // 닫는다 — 안 닫으면 그 뒤 모든 동작이 멈춘다. 어떤 대화상자든 일단 확인(accept)한다.
  page.on("dialog", (dialog) => {
    dialog.accept().catch(() => {});
  });
  return { context, page };
}

/**
 * 글쓰기 화면으로 이동해 에디터가 든 iframe을 돌려준다.
 *
 * ⚠️ **`iframe[name="mainFrame"]` 로 먼저 찾다가 실패했다** (2026-09-09, 실제로 겪음).
 *    광고·위젯 로딩이 느릴 때 그 이름이 붙는 타이밍이 늦어져 30초 안에 못 잡았는데,
 *    화면 자체는 몇 초 뒤 정상적으로 다 떴다 — 이름에 기대는 대신 **프레임을 계속
 *    돌면서 실제 에디터 표식(`.se-title-text`)이 있는 프레임을 찾을 때까지 기다린다.**
 *    이름이 뭐든, 몇 번째 프레임이든 상관없다.
 * ⚠️ `.se-title-text` 는 2026-09-09 에 실제 로그인 세션으로 확인한 값이다
 *    (`summary.json` 참고, `scripts/naver-setup.mjs` 로 다시 뽑을 수 있다).
 *    네이버가 스마트에디터를 새 버전으로 바꾸면 이 선택자도 같이 깨진다 — 그때는
 *    `naver-setup.mjs` 를 다시 돌려서 새 구조를 확인해야 한다.
 */
export async function openWritePage(page, blogId, { timeoutMs = 60000 } = {}) {
  await page.goto(writeUrl(blogId), { waitUntil: "domcontentloaded" });

  // "작성 중인 글이 있습니다. 이어서 작성하시겠습니까?" — 자동저장된 이전 초안이 있으면
  // 뜨는 팝업이다(2026-09-09, 테스트 초안이 쌓이면서 실제로 겪었다). 네이티브 브라우저
  // 다이얼로그가 아니라 페이지 안 커스텀 팝업이라 `page.on("dialog", ...)` 로는 안 잡힌다.
  // 항상 "취소"(이어서 쓰지 않음 = 새 글로 시작)를 눌러 매번 빈 글에서 시작한다 —
  // 안 그러면 이전 실행의 내용이 뒤섞여 자리가 밀리거나 겹친다.
  const resumeCancel = await page.waitForSelector(".se-popup-button-cancel", { timeout: 5000 }).catch(() => null);
  if (resumeCancel) await resumeCancel.click();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const found = await frame.$(".se-title-text").catch(() => null);
      if (found) return frame;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`에디터(.se-title-text)를 ${timeoutMs}ms 동안 못 찾았습니다.`);
}

/**
 * 제목 칸을 클릭하고 타이핑한다.
 *
 * ⚠️ **디버깅용 스크린샷에서 제목이 깨져 보이는 건 실제 버그가 아니다** (2026-09-09,
 *    확인하는 데 한참 걸렸다) — "자동화 테스트"를 넣었더니 스크린샷엔 "사동와 테스트"
 *    처럼 자음이 뒤바뀐 걸로 나와서 타이핑 로직을 몇 번이나 바꿔 가며 재현했는데,
 *    매번 스크린샷은 여전히 깨졌다. `frame.evaluate(() => el.textContent)` 로
 *    **DOM에 실제로 들어간 값을 직접 읽어보니 완전히 정확했다.** 즉 이 컴퓨터의
 *    Playwright 크로미움이 제목 칸의 크고 굵은 글씨(나눔고딕 32px)를 렌더링할 때
 *    한글 글꼴을 제대로 못 그려서 `page.screenshot()` 에만 깨져 보이는 것이었다 —
 *    본문(15px)은 같은 문제가 안 나서 여태 그런 줄 몰랐다. **앞으로 제목이 스크린샷
 *    에서 이상해 보이면 먼저 DOM 텍스트를 읽어 실제로 잘못 들어갔는지부터 확인할 것**
 *    — 스크린샷만 보고 타이핑 방식을 또 바꾸는 건 헛수고다.
 */
export async function fillTitle(page, frame, title) {
  await frame.click(".se-title-text");
  await page.keyboard.type(title, { delay: 15 });
}

// 문단 서식 드롭다운("본문" 버튼)을 열었을 때 나오는 옵션들. 실제 로그인 세션에서 DOM을
// 직접 뒤져 확인한 값이다(2026-09-09) — 이름이 `sectionTitle`·`text` 인 건 네이버 내부
// 명명이고 짐작으로 지은 게 아니다.
const TEXT_FORMAT_OPTION = {
  heading: ".se-toolbar-option-text-format-sectionTitle-button",
  body: ".se-toolbar-option-text-format-text-button",
};

/**
 * 커서가 있는 줄의 문단 서식을 "소제목" 또는 "본문"으로 바꾼다.
 *
 * ⚠️ **반드시 타이핑하기 전에 불러야 한다.** 처음엔 줄을 다 쓴 다음 그 줄을 선택해서
 *    서식을 바꾸는 순서로 만들었는데, 제목 바로 다음 첫 줄에서 그렇게 하면 방금
 *    입력한 텍스트가 통째로 사라지는 걸 실제로 겪었다(2026-09-09). 빈 줄 상태에서
 *    먼저 서식을 정하고 그다음 타이핑하는 순서로 바꾸니 문제가 없었다.
 * ⚠️ **소제목 서식은 Enter 를 눌러도 다음 줄까지 그대로 이어진다.** 소제목 다음에
 *    본문 문단을 이어 쓸 거면 반드시 다시 `setParagraphFormat(page, "body")` 로
 *    되돌려야 한다 — 안 그러면 다음 문단도 소제목 크기로 나간다.
 */
async function setParagraphFormat(page, kind) {
  const dropdownBtn = await page.waitForSelector(".se-text-format-toolbar-button", { timeout: 8000 });
  await dropdownBtn.click();
  const option = await page.waitForSelector(TEXT_FORMAT_OPTION[kind], { timeout: 8000 });
  await option.click();
  await page.waitForTimeout(150); // 서식 반영 애니메이션이 짧게 있다 — 바로 타이핑하면 놓칠 때가 있었다
}

/**
 * 커서 위치에 이미지 파일을 실제로 업로드해 끼워 넣는다. `dataUrl` 은 카드뉴스 캔버스가
 * 만든 `data:image/png;base64,...` 문자열(브라우저 쪽에서 그대로 넘겨받는다)이다.
 *
 * ⚠️ **네이티브 OS 파일 선택창을 통해 넣는다** — `.se-image-toolbar-button`("사진 추가")을
 *    누르면 Playwright 의 `filechooser` 이벤트가 뜨고, `setFiles()` 에 `{name, mimeType,
 *    buffer}` 를 바로 넘길 수 있어 디스크에 임시 파일을 안 만들어도 된다.
 *    실제 로그인 세션에서 확인·검증했다(2026-09-09).
 * ⚠️ **업로드 완료를 기다려야 한다.** `setFiles()` 가 끝나도 이미지는 아직 로컬
 *    미리보기(blob:) 상태다. 네이버 CDN 으로 실제 업로드가 끝나면 `<img class=
 *    "se-image-resource">` 의 `src` 가 `https://...` 로 바뀐다 — 그때까지 기다리지
 *    않으면 다음 동작이 업로드 중인 상태를 밟고 지나간다.
 */
export async function insertImage(page, frame, dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("이미지 데이터 형식이 올바르지 않습니다(data URL이 아닙니다).");
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";

  const beforeCount = await frame
    .evaluate(() => document.querySelectorAll("img.se-image-resource").length)
    .catch(() => 0);

  const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 15000 });
  const imgBtn = await page.waitForSelector(".se-image-toolbar-button", { timeout: 15000 });
  await imgBtn.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({ name: `card.${ext}`, mimeType: mime, buffer });

  await frame.waitForFunction(
    (before) => {
      const imgs = document.querySelectorAll("img.se-image-resource");
      if (imgs.length <= before) return false;
      const last = imgs[imgs.length - 1];
      return (last.getAttribute("src") || "").startsWith("https://");
    },
    beforeCount,
    { timeout: 30000 },
  );
}

// `app/_components/text/NaverBlogPreview.jsx` 의 `IMAGE_BOX_CLASS` 와 같은 너비(px) —
// 화면 미리보기의 S/M/L이 실제로 이 값들이다. 여기서 값이 바뀌면 그쪽도 같이 봐야
// 미리보기와 실제로 올라가는 크기가 어긋나지 않는다.
const IMAGE_WIDTH_PX = { sm: 160, md: 220, lg: 320 };

const ALIGN_BUTTON_SELECTOR = {
  left: ".se-property-toolbar-group-toggle-button.se-align-left-toolbar-button",
  center: ".se-property-toolbar-group-toggle-button.se-align-center-toolbar-button",
  right: ".se-property-toolbar-group-toggle-button.se-align-right-toolbar-button",
};

/**
 * 방금 올린 이미지의 크기·정렬을 화면 미리보기(`NaverBlogPreview.jsx`)와 같게 맞춘다.
 * `size` 는 `sm`·`md`·`lg`, `align` 은 `left`·`center`·`right` — 둘 다 미리보기가 쓰는
 * 값 그대로 받는다.
 *
 * ⚠️ **너비만 입력하면 높이는 원본 비율대로 자동 계산된다** — 실제 로그인 세션에서
 *    108×135(카드뉴스와 같은 4:5 비율) 테스트 이미지로 확인했다(2026-09-09): 너비
 *    220을 넣으면 높이 입력칸이 자동으로 275(=220×135/108)가 됐다. 높이 칸을 따로
 *    채우지 않는다 — 채우면 오히려 비율이 깨질 수 있다.
 * ⚠️ **이미지를 먼저 선택(클릭)해야 크기·정렬 툴바가 뜬다.** `insertImage()` 직후에는
 *    선택이 안 돼 있을 수 있어 여기서 다시 클릭한다. 방금 올라간 이미지는 항상
 *    `img.se-image-resource` 중 마지막 것이다(이미지를 여러 장 올릴 때도 이 함수는
 *    한 장 올릴 때마다 바로 이어서 부르므로 "마지막 것 = 방금 그 이미지"가 맞다).
 * ⚠️ 실패해도(셀렉터가 안 뜨는 등) 조용히 넘어간다 — 크기·정렬은 있으면 좋은 것이지
 *    이것 때문에 이미지 삽입 자체를 실패로 만들 이유는 없다.
 */
export async function applyImageLayout(page, frame, { size, align } = {}) {
  if (!size && !align) return;
  const images = await frame.$$("img.se-image-resource");
  const target = images[images.length - 1];
  if (!target) return;

  try {
    await target.click();
    await page.waitForTimeout(200);

    if (size && IMAGE_WIDTH_PX[size]) {
      const resizeBtn = await page.waitForSelector(".se-resizing-toolbar-button", { timeout: 8000 });
      await resizeBtn.click();
      const widthInput = await page.waitForSelector(".se-custom-layer-resizing-input", { timeout: 5000 });
      await widthInput.fill(String(IMAGE_WIDTH_PX[size]));
      await page.waitForTimeout(200);
      const applyBtn = await page.waitForSelector(".se-custom-layer-resizing-apply-button", { timeout: 5000 });
      await applyBtn.click();
      await page.waitForTimeout(200);
    }

    if (align && ALIGN_BUTTON_SELECTOR[align]) {
      const alignBtn = await page.waitForSelector(ALIGN_BUTTON_SELECTOR[align], { timeout: 5000 });
      await alignBtn.click();
      await page.waitForTimeout(200);
    }
  } catch (err) {
    console.error("[naverPublish] 이미지 크기·정렬 적용 실패 — 기본값으로 둡니다:", err.message);
  }
}

/**
 * 방금 올린 이미지의 캡션을 네이버가 이미지마다 기본 제공하는 **진짜 "사진 설명" 입력란**에
 * 채운다 — 화면 미리보기(`NaverBlogPreview.jsx`)의 이미지 아래 작은 글씨(`block.caption`)와
 * 같은 자리다.
 *
 * ⚠️ **이 입력란은 이미지를 선택해야만 나타난다.** 업로드 직후 DOM 에 이미 존재하지만
 *    `display:none` 이다 — 이미지를 클릭해 선택 상태로 만들어야 `display:block` 으로
 *    바뀐다(2026-09-09, 실제 로그인 세션에서 `display`·`height` 계산값을 직접 재서 확인).
 *    `applyImageLayout()` 도 똑같이 이미지를 클릭하지만, 그 함수가 먼저 불렸든 아니든
 *    상관없게(호출 순서에 의존하지 않게) 여기서도 다시 클릭한다 — 이미 선택된 상태에서
 *    또 클릭해도 문제없다.
 * ⚠️ **캡션에서 Enter 를 누르면 캡션 밖으로 나가 본문 흐름의 새 문단으로 이동한다** —
 *    캡션 안에 줄바꿈이 생기는 게 아니다(실제로 타이핑해서 확인). `fillBody()` 가 이
 *    동작을 이용해 캡션을 다 쓴 뒤 커서를 되돌린다 — 이 함수 자체는 Enter 를 누르지
 *    않고 타이핑까지만 한다.
 * ⚠️ 실패해도 조용히 넘어간다 — 캡션이 없어도 이미지 자체는 이미 올라가 있다.
 */
export async function fillImageCaption(page, frame, caption) {
  if (!caption) return;
  try {
    const images = await frame.$$("img.se-image-resource");
    const target = images[images.length - 1];
    if (!target) return;
    await target.click();
    await page.waitForTimeout(200);

    const captionParas = await frame.$$(".se-caption .se-text-paragraph");
    const captionPara = captionParas[captionParas.length - 1];
    if (!captionPara) return;
    await captionPara.click();
    await page.waitForTimeout(150);
    await page.keyboard.type(caption);
  } catch (err) {
    console.error("[naverPublish] 이미지 설명 입력 실패 — 건너뜁니다:", err.message);
  }
}

/**
 * 본문을 채운다. `images` 는 `{ [카드 번호]: "data:image/png;base64,..." }` 형태로,
 * 원고의 `📷 [이미지 N …]` 자리마다 실제로 업로드할 카드뉴스 이미지를 담는다 — 없는
 * 번호는 예전처럼 대괄호 자리표시자로 남는다(카드를 아직 안 만들었거나 업로드가
 * 실패했을 때의 안전한 폴백). `imageLayout` 은 `{ [카드 번호]: { size, align } }` —
 * 화면 미리보기에서 고른 이미지 크기·정렬을 그대로 반영한다(`applyImageLayout` 참고).
 *
 * ⚠️ **키보드 입력은 반드시 `page.keyboard` 를 쓴다.** `frame.keyboard` 는 존재하지
 *    않는다 — Playwright 에서 키 입력은 프레임이 아니라 페이지 단위다(포커스가 어느
 *    프레임에 있든 페이지가 그리로 전달한다). 실제로 `frame.keyboard.press(...)` 로
 *    썼다가 `Cannot read properties of undefined` 로 바로 죽었다. 그래서 `page` 도 받는다.
 * ⚠️ **해시태그는 아직 일반 문단으로 들어간다** — 자동완성 토큰으로 만드는 건 다음 단계다.
 * ⚠️ **캡션은 실제 이미지가 올라갔을 때만 네이버의 "사진 설명" 입력란으로 들어간다**
 *    (`fillImageCaption` 참고). 이미지를 못 올려 대괄호 자리표시자로 대신할 때는
 *    그 캡션도 예전처럼 자리표시자 옆에 평범한 문단으로 넣는다 — 첨부할 이미지
 *    자체가 없으니 붙일 "사진 설명" 칸도 없다.
 */
export async function fillBody(page, frame, rawDraft, images = {}, imageLayout = {}) {
  const doc = parseBlogDoc(rawDraft);
  await frame.click(".se-title-text");
  await page.keyboard.press("Enter"); // 제목 → 본문 첫 줄로 이동 (스마트에디터 관례)

  for (const block of doc.blocks) {
    if (block.type === "image") {
      const dataUrl = images?.[block.no];
      let inserted = false;
      if (dataUrl) {
        try {
          await insertImage(page, frame, dataUrl);
          await applyImageLayout(page, frame, imageLayout?.[block.no] || {});
          if (block.caption) {
            await fillImageCaption(page, frame, block.caption);
          } else {
            await page.keyboard.press("End");
          }
          inserted = true;
        } catch (err) {
          console.error(`[naverPublish] 이미지 ${block.no}번 업로드 실패 — 자리 표시로 대신합니다:`, err.message);
        }
      }
      if (!inserted) {
        await page.keyboard.type(block.caption ? `[이미지 ${block.no} — ${block.caption}]` : `[이미지 ${block.no}]`);
        if (block.caption) {
          await page.keyboard.press("Enter");
          await page.keyboard.type(block.caption);
        }
      }
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter"); // 다음 블록과 붙지 않게 — 다른 블록 타입과 동일한 간격
      continue;
    }

    if (block.type === "head") {
      await setParagraphFormat(page, "heading");
      await page.keyboard.type(block.text || "");
      await page.keyboard.press("Enter");
      await setParagraphFormat(page, "body"); // 소제목 서식이 다음 줄로 새지 않게 되돌린다
      await page.keyboard.press("Enter"); // 문단 사이 한 줄 더 띄운다
      continue;
    }

    const text = block.text || "";
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i]) await page.keyboard.type(lines[i]);
      await page.keyboard.press("Enter");
    }
    // 문단 사이 한 줄 더 띄운다 — 스마트에디터 기본 문단 간격이 붙어서 빽빽해 보인다.
    await page.keyboard.press("Enter");
  }
}
