// 글쓰기 탭을 열고, 채우는 동안만 chrome.debugger 로 "진짜 키보드·마우스 입력"을 대신 넣어 준다.
// (스마트에디터는 스크립트가 만든 가짜 입력을 무시하는 경우가 많아 신뢰된 입력이 필요하다.)
const BLOG_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const jobKey = (tabId) => `job:${tabId}`;
const attached = new Set();

const KEYS = {
  Enter: { code: "Enter", vk: 13, text: "\r" },
  End: { code: "End", vk: 35 },
};

const send = (tabId, method, params) => chrome.debugger.sendCommand({ tabId }, method, params);

async function ensureAttached(tabId) {
  if (attached.has(tabId)) return;
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
  } catch (error) {
    if (!/already attached/i.test(error?.message || "")) {
      throw new Error(
        `브라우저 제어를 시작하지 못했습니다. 이 탭의 개발자 도구(F12)가 열려 있다면 닫고 다시 시도해 주세요. (${error?.message || error})`,
      );
    }
  }
  attached.add(tabId);
}

async function detach(tabId) {
  attached.delete(tabId);
  await chrome.debugger.detach({ tabId }).catch(() => {});
}

async function startFill({ blogId, job }) {
  if (!BLOG_ID_RE.test(blogId || "")) throw new Error("네이버 블로그 아이디 형식이 올바르지 않습니다.");
  if (!job || !Array.isArray(job.doc?.blocks)) throw new Error("채워 넣을 글이 비어 있습니다.");
  // about:blank 로 먼저 열고 작업을 저장한 뒤 이동한다 — 페이지가 뜨기 전에 작업이 저장돼 있어야 한다.
  const tab = await chrome.tabs.create({ url: "about:blank", active: true });
  await chrome.storage.local.set({ [jobKey(tab.id)]: { ...job, createdAt: Date.now() } });
  await chrome.tabs.update(tab.id, {
    url: `https://blog.naver.com/PostWriteForm.naver?blogId=${encodeURIComponent(blogId)}&Redirect=Write`,
  });
  return { ok: true, tabId: tab.id };
}

async function handle(message, sender) {
  const tabId = sender.tab?.id;

  if (message.type === "start-fill") return startFill(message);

  if (tabId == null) throw new Error("탭 정보가 없습니다.");

  if (message.type === "peek-job") {
    const stored = (await chrome.storage.local.get(jobKey(tabId)))[jobKey(tabId)];
    return { has: !!stored && Date.now() - stored.createdAt < 10 * 60 * 1000 };
  }

  if (message.type === "claim-job") {
    const stored = (await chrome.storage.local.get(jobKey(tabId)))[jobKey(tabId)];
    if (!stored) return { job: null };
    await chrome.storage.local.remove(jobKey(tabId));
    await ensureAttached(tabId);
    return { job: stored };
  }

  if (message.type === "discard-job") {
    await chrome.storage.local.remove(jobKey(tabId));
    return { ok: true };
  }

  if (message.type === "finish") {
    await detach(tabId);
    return { ok: true };
  }

  await ensureAttached(tabId);

  if (message.type === "type") {
    if (message.text) await send(tabId, "Input.insertText", { text: message.text });
    return { ok: true };
  }

  if (message.type === "key") {
    const def = KEYS[message.key];
    if (!def) throw new Error(`지원하지 않는 키입니다: ${message.key}`);
    await send(tabId, "Input.dispatchKeyEvent", {
      type: "keyDown",
      key: message.key,
      code: def.code,
      windowsVirtualKeyCode: def.vk,
      ...(def.text ? { text: def.text, unmodifiedText: def.text } : {}),
    });
    await send(tabId, "Input.dispatchKeyEvent", {
      type: "keyUp",
      key: message.key,
      code: def.code,
      windowsVirtualKeyCode: def.vk,
    });
    return { ok: true };
  }

  if (message.type === "click") {
    const { x, y } = message;
    await send(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await send(tabId, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await send(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
    return { ok: true };
  }

  throw new Error(`알 수 없는 요청입니다: ${message.type}`);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message, sender).then(sendResponse, (error) =>
    sendResponse({ ok: false, error: error?.message || String(error) }),
  );
  return true;
});

chrome.debugger.onDetach.addListener((source) => attached.delete(source.tabId));
chrome.tabs.onRemoved.addListener((tabId) => {
  attached.delete(tabId);
  chrome.storage.local.remove(jobKey(tabId));
});
