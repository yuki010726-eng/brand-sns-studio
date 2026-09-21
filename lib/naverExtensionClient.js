/**
 * 「네이버 채우기」 확장 프로그램(`extension/naver-filler/`)과 대화하는 브라우저 클라이언트.
 * 확장 프로그램의 bridge.js 가 이 페이지에 주입돼 window.postMessage 로만 대화한다.
 * 배포 서버가 아니라 사용자 브라우저 안에서 채우므로 배포 환경에서도 동작한다.
 */

function request(type, extra, timeoutMs) {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
    const onMessage = (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== "bss-ext" || data.id !== id) return;
      cleanup();
      resolve(data);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "bss-app", id, type, ...extra }, window.location.origin);
  });
}

/** 확장 프로그램이 설치돼 있고 이 페이지에서 켜져 있는지. */
export async function detectNaverExtension() {
  const reply = await request("ping", {}, 800);
  return !!reply?.ok;
}

/** 새 탭으로 네이버 글쓰기를 열고 채우기를 시작시킨다. 채우는 진행은 그 탭에서 보인다. */
export async function fillNaverViaExtension({ blogId, title, doc, images, imageLayout }) {
  const reply = await request("naver-fill", { blogId, job: { title, doc, images, imageLayout } }, 20000);
  if (!reply) throw new Error("확장 프로그램이 응답하지 않습니다. 확장 프로그램을 새로 고침한 뒤 이 페이지를 새로고침해 주세요.");
  if (!reply.ok) throw new Error(reply.error || "네이버 채우기를 시작하지 못했습니다.");
  return reply;
}
