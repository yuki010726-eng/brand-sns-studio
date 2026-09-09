/**
 * `/api/naver/fill` 을 호출하는 브라우저 클라이언트. Playwright 자동화(`lib/naverPublish.js`)는
 * Node 전용(파일 시스템·브라우저 프로세스를 다룬다)이라 화면 코드에서 직접 가져올 수 없다 —
 * 항상 이 서버 라우트를 거친다. `lib/serverapi.js` 의 `generateText()` 와 같은 구조다.
 */
import { accessToken } from "./auth.js";

const BLOG_ID_KEY = "bboggl.naver-blog-id";

/** 마지막으로 넣은 네이버 블로그 아이디를 기억해 둔다 — 매번 다시 칠 필요 없게. */
export function getSavedNaverBlogId() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(BLOG_ID_KEY) || "";
  } catch {
    return "";
  }
}

export function saveNaverBlogId(blogId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BLOG_ID_KEY, blogId);
  } catch {
    /* 저장소가 막힌 환경이면 그냥 매번 다시 입력한다 */
  }
}

export async function fillNaverDraft({ rawDraft, blogId, images, imageLayout, title }) {
  const token = await accessToken();
  if (!token) throw new Error("로그인이 필요합니다. 다시 로그인해 주세요.");

  let response;
  try {
    response = await fetch("/api/naver/fill", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rawDraft, blogId, images, imageLayout, title }),
    });
  } catch {
    throw new Error(
      "자동화 서버에 연결하지 못했습니다. 이 컴퓨터에서 `npm run dev` 를 직접 실행 중인지 확인해 주세요.",
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* 본문 없음 */
  }
  if (!response.ok) throw new Error(payload?.error || `요청에 실패했습니다 (${response.status}).`);
  return payload;
}
