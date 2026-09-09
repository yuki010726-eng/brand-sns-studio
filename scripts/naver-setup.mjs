/**
 * 네이버 블로그 자동 발행 — 1단계: 로그인 세션 만들기 + 에디터 화면 구조 뽑아내기.
 *
 * 왜 이렇게 나눴나 — 실제 스마트에디터의 제목 칸·본문 칸·이미지 업로드 버튼이
 * 어떤 선택자(class·id)를 쓰는지는 로그인해서 직접 봐야 안다. 로그인 창이나
 * 실제 화면 구조를 이 환경에서는 볼 수 없으므로, 브라우저를 직접 띄워서 사람이
 * 로그인 → 글쓰기 화면까지 들어간 다음, 이 스크립트가 그 화면의 구조를
 * `.naver-profile/editor-snapshot/summary.json` 에 뽑아 저장한다. 그 파일을 읽고
 * 다음 단계(제목·본문·이미지 자동 채우기)의 진짜 선택자를 만든다.
 *
 * 실행: node scripts/naver-setup.mjs
 *
 * ⚠️ 로그인 정보(아이디·비밀번호)는 이 스크립트가 절대 다루지 않는다. 브라우저 창이
 *    뜨면 **직접** 로그인한다 — 그 세션(쿠키)만 `.naver-profile/` 에 저장되고,
 *    이 폴더는 `.gitignore` 에 있어 절대 커밋되지 않는다.
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";

const PROFILE_DIR = path.resolve(process.cwd(), ".naver-profile");
const SNAPSHOT_DIR = path.resolve(PROFILE_DIR, "editor-snapshot");

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * 화면 전체 HTML을 그대로 저장하지 않는다 — 스마트에디터는 스타일·스크립트가 많아
 * 수백 KB짜리 파일이 되고, 그 안에서 실제 필요한 요소(제목 칸·본문 칸·업로드 버튼)를
 * 사람이든 나든 눈으로 찾기 힘들다. 대신 **후보가 될 만한 요소만** 골라 요약한다.
 */
function summarizeInBrowser() {
  const pick = (el) => ({
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    class: typeof el.className === "string" ? el.className : null,
    placeholder: el.getAttribute("placeholder") || null,
    text: (el.innerText || el.value || "").trim().slice(0, 50),
  });
  const editable = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""]')].map(pick);
  const fileInputs = [...document.querySelectorAll('input[type="file"]')].map(pick);
  const buttons = [...document.querySelectorAll("button, a[role=button], [class*=btn], [class*=Btn]")]
    .filter((el) => /발행|등록|저장|완료|출간|이미지|사진/.test(el.innerText || ""))
    .map(pick);
  const titled = [...document.querySelectorAll('[class*="title" i], [placeholder*="제목"]')].map(pick);
  return { url: location.href, editable, fileInputs, buttons, titled };
}

async function main() {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  console.log("브라우저를 엽니다. 이미 로그인돼 있으면 그대로 쓰고, 아니면 직접 로그인해 주세요.");
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto("https://section.blog.naver.com/BlogHome.naver");

  await waitForEnter(
    "\n로그인하고, 자동 발행할 블로그의 '글쓰기' 화면(제목·본문 칸이 보이는 에디터)까지 " +
      "직접 들어간 다음 여기서 Enter를 눌러 주세요...\n",
  );

  const frames = page.frames();
  const results = [];
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    try {
      const summary = await frame.evaluate(summarizeInBrowser);
      results.push({ index: i, name: frame.name() || null, ...summary });
      console.log(`[frame ${i}] ${frame.name() || "(이름 없음)"} — ${summary.url}`);
    } catch (err) {
      results.push({ index: i, name: frame.name() || null, error: String(err) });
      console.log(`[frame ${i}] 읽기 실패: ${err.message}`);
    }
  }

  const outPath = path.join(SNAPSHOT_DIR, "summary.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n에디터 화면 구조를 저장했습니다: ${outPath}`);
  console.log("이 파일을 Claude에게 보여주면 다음 단계(제목·본문·이미지 자동 채우기)를 만듭니다.");

  await waitForEnter("\n확인했으면 Enter를 눌러 브라우저를 닫습니다 (로그인 세션은 유지됩니다)...\n");
  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
