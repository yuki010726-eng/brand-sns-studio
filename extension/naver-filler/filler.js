// lib/naverPublish.js(Playwright 판)를 확장 프로그램 안으로 옮긴 것. 같은 셀렉터·같은 순서다.
// 셀렉터가 깨지면 두 파일을 같이 고칠 것. 발행 버튼은 누르지 않는다 — 사람이 확인하고 직접 누른다.
(() => {
  if (window.__bssFiller) return;
  window.__bssFiller = true;

  const rpc = (message) => chrome.runtime.sendMessage(message);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };

  async function waitUntil(check, timeout, label) {
    const deadline = Date.now() + timeout;
    for (;;) {
      const value = check();
      if (value) return value;
      if (Date.now() > deadline) throw new Error(`시간 초과: ${label}`);
      await sleep(100);
    }
  }

  const waitFor = (selector, timeout = 10000) =>
    waitUntil(() => [...document.querySelectorAll(selector)].find(isVisible), timeout, selector);

  // 이 프레임 기준 좌표를 최상위 창 기준으로 바꿔 진짜 마우스 클릭을 보낸다.
  async function mouseClick(el) {
    el.scrollIntoView({ block: "center" });
    const rect = el.getBoundingClientRect();
    let x = rect.left + rect.width / 2;
    let y = rect.top + rect.height / 2;
    let win = window;
    while (win !== win.parent) {
      const frame = win.frameElement;
      if (!frame) break;
      const frameRect = frame.getBoundingClientRect();
      x += frameRect.left;
      y += frameRect.top;
      win = win.parent;
    }
    await check(await rpc({ type: "click", x, y }));
  }

  async function check(result) {
    if (result && result.ok === false) throw new Error(result.error || "브라우저 제어에 실패했습니다.");
    return result;
  }

  const typeText = async (text) => check(await rpc({ type: "type", text }));
  const pressKey = async (key) => check(await rpc({ type: "key", key }));

  async function fillInput(el, value) {
    el.focus();
    el.select();
    await typeText(value);
  }

  function banner(text, tone) {
    let host = document.body;
    try {
      host = window.top.document.body;
    } catch {
      /* 다른 origin 이면 이 프레임에 띄운다 */
    }
    let el = host.querySelector("#bss-naver-banner");
    if (!el) {
      el = document.createElement("div");
      el.id = "bss-naver-banner";
      el.style.cssText =
        "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:10px 18px;border-radius:999px;font:700 14px/1.4 'Noto Sans KR',sans-serif;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.25);pointer-events:none;max-width:90vw;text-align:center";
      host.appendChild(el);
    }
    el.textContent = text;
    el.style.background = tone === "error" ? "#c62828" : tone === "ok" ? "#03c75a" : "#191f28";
  }

  const TEXT_FORMAT_OPTION = {
    heading: ".se-toolbar-option-text-format-sectionTitle-button",
    body: ".se-toolbar-option-text-format-text-button",
  };

  async function setParagraphFormat(kind) {
    try {
      const dropdown = await waitFor(".se-text-format-toolbar-button", 15000);
      await mouseClick(dropdown);
      const option = await waitFor(TEXT_FORMAT_OPTION[kind], 8000);
      await mouseClick(option);
      await sleep(150);
    } catch (error) {
      console.error(`[네이버 채우기] 문단 서식(${kind}) 전환 실패 — 서식 없이 계속합니다:`, error.message);
    }
  }

  function decodeDataUrl(dataUrl) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
    if (!match) throw new Error("이미지 데이터 형식이 올바르지 않습니다.");
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const mime = match[1];
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    return { mime, bytes, name: `card.${ext}` };
  }

  function nextMainMessage(tag, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("사진 파일 선택창을 가로채지 못했습니다."));
      }, timeout);
      function onMessage(event) {
        if (event.source !== window || event.data?.__bss !== tag) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve();
      }
      window.addEventListener("message", onMessage);
    });
  }

  const imageCount = () => document.querySelectorAll("img.se-image-resource").length;
  const lastImage = () => [...document.querySelectorAll("img.se-image-resource")].pop();

  async function insertImage(dataUrl) {
    const { mime, bytes, name } = decodeDataUrl(dataUrl);
    const before = imageCount();
    const picked = nextMainMessage("file-set", 20000);
    picked.catch(() => {});
    window.postMessage({ __bss: "arm-file", name, mime, buffer: bytes.buffer }, "*", [bytes.buffer]);
    await mouseClick(await waitFor(".se-image-toolbar-button", 20000));
    await picked;
    await waitUntil(
      () => imageCount() > before && (lastImage().getAttribute("src") || "").startsWith("https://"),
      30000,
      "이미지 업로드 완료",
    );
  }

  const IMAGE_WIDTH_PX = { sm: 160, md: 220, lg: 320 };
  const ALIGN_BUTTON_SELECTOR = {
    left: ".se-property-toolbar-group-toggle-button.se-align-left-toolbar-button",
    center: ".se-property-toolbar-group-toggle-button.se-align-center-toolbar-button",
    right: ".se-property-toolbar-group-toggle-button.se-align-right-toolbar-button",
  };

  async function applyImageLayout({ size, align } = {}) {
    if (!size && !align) return;
    const target = lastImage();
    if (!target) return;
    try {
      await mouseClick(target);
      await sleep(200);
      if (size && IMAGE_WIDTH_PX[size]) {
        await mouseClick(await waitFor(".se-resizing-toolbar-button", 8000));
        const widthInput = await waitFor(".se-custom-layer-resizing-input", 5000);
        await fillInput(widthInput, String(IMAGE_WIDTH_PX[size]));
        await sleep(200);
        await mouseClick(await waitFor(".se-custom-layer-resizing-apply-button", 5000));
        await sleep(200);
      }
      if (align && ALIGN_BUTTON_SELECTOR[align]) {
        await mouseClick(await waitFor(ALIGN_BUTTON_SELECTOR[align], 5000));
        await sleep(200);
      }
    } catch (error) {
      console.error("[네이버 채우기] 이미지 크기·정렬 적용 실패 — 기본값으로 둡니다:", error.message);
    }
  }

  async function fillImageCaption(caption) {
    if (!caption) return;
    try {
      const target = lastImage();
      if (!target) return;
      await mouseClick(target);
      await sleep(200);
      const paragraphs = [...document.querySelectorAll(".se-caption .se-text-paragraph")];
      const paragraph = paragraphs[paragraphs.length - 1];
      if (!paragraph) return;
      await mouseClick(paragraph);
      await sleep(150);
      await typeText(caption);
    } catch (error) {
      console.error("[네이버 채우기] 이미지 설명 입력 실패 — 건너뜁니다:", error.message);
    }
  }

  async function fillOneBlock(block, images, imageLayout) {
    if (block.type === "image") {
      const dataUrl = images?.[block.no];
      let inserted = false;
      if (dataUrl) {
        try {
          await insertImage(dataUrl);
          await applyImageLayout(imageLayout?.[block.no] || {});
          if (block.caption) await fillImageCaption(block.caption);
          else await pressKey("End");
          inserted = true;
        } catch (error) {
          console.error(`[네이버 채우기] 이미지 ${block.no}번 업로드 실패 — 자리 표시로 대신합니다:`, error.message);
        }
      }
      if (!inserted) {
        await typeText(block.caption ? `[이미지 ${block.no} — ${block.caption}]` : `[이미지 ${block.no}]`);
        if (block.caption) {
          await pressKey("Enter");
          await typeText(block.caption);
        }
      }
      await pressKey("Enter");
      await pressKey("Enter");
      return;
    }

    if (block.type === "head") {
      await setParagraphFormat("heading");
      await typeText(block.text || "");
      await pressKey("Enter");
      await setParagraphFormat("body");
      await pressKey("Enter");
      return;
    }

    const lines = (block.text || "").split("\n");
    for (const line of lines) {
      if (line) await typeText(line);
      await pressKey("Enter");
    }
    await pressKey("Enter");
  }

  // 에디터가 막 뜬 직후에는 클릭만으로 포커스가 안 잡혀 첫 입력이 사라지는 일이 있다 — 들어갔는지 확인하고 다시 한다.
  async function fillTitle(title) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const el = await waitFor(".se-title-text", 10000);
      await mouseClick(el);
      await sleep(500);
      await typeText(title);
      await sleep(400);
      if (!el.classList.contains("se-is-empty") && el.textContent.trim()) return;
    }
    throw new Error("제목을 입력하지 못했습니다.");
  }

  async function fillBody(doc, images, imageLayout) {
    await mouseClick(document.querySelector(".se-title-text"));
    await pressKey("Enter");
    let done = 0;
    for (const [index, block] of doc.blocks.entries()) {
      banner(`네이버에 채우는 중… (${index + 1}/${doc.blocks.length}) 창을 건드리지 말고 기다려 주세요.`);
      try {
        await fillOneBlock(block, images, imageLayout);
        done += 1;
      } catch (error) {
        console.error(`[네이버 채우기] 블록 ${index}번(${block.type}) 처리 실패 — 건너뛰고 계속합니다:`, error.message);
      }
    }
    return done;
  }

  async function run() {
    const { has } = (await rpc({ type: "peek-job" })) || {};
    if (!has) return;

    const isTop = window === window.top;
    const deadline = Date.now() + 60000;
    while (!document.querySelector(".se-title-text")) {
      if (Date.now() > deadline) {
        if (isTop && ((await rpc({ type: "peek-job" })) || {}).has) {
          await rpc({ type: "discard-job" });
          banner(
            "글쓰기 에디터를 찾지 못했습니다. 이 브라우저에서 네이버에 로그인돼 있는지, 블로그 아이디가 맞는지 확인해 주세요.",
            "error",
          );
        }
        return;
      }
      await sleep(500);
    }

    const claimed = await rpc({ type: "claim-job" });
    if (claimed?.ok === false) {
      banner(claimed.error, "error");
      return;
    }
    const job = claimed?.job;
    if (!job) return;

    document.documentElement.setAttribute("data-bss-filling", "1");
    banner("네이버에 채우는 중… 창을 건드리지 말고 기다려 주세요.");
    try {
      // "작성 중인 글이 있습니다" 팝업 — 매번 새 글로 시작한다.
      const cancel = await waitUntil(() => document.querySelector(".se-popup-button-cancel"), 3000, "").catch(() => null);
      if (cancel) {
        await mouseClick(cancel);
        await sleep(400);
      }
      await fillTitle(job.title || "(제목 없음)");
      await fillBody(job.doc, job.images || {}, job.imageLayout || {});
      banner("채우기 완료 — 내용을 확인하고 직접 발행해 주세요.", "ok");
    } catch (error) {
      banner(`채우기 실패: ${error.message}`, "error");
    } finally {
      document.documentElement.removeAttribute("data-bss-filling");
      await rpc({ type: "finish" });
    }
  }

  run().catch((error) => console.error("[네이버 채우기]", error));
})();
