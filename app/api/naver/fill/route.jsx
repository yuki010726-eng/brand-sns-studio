/**
 * 네이버 블로그 글쓰기 화면에 제목·본문을 자동으로 채운다. 실제 자동화(Playwright)는
 * `lib/naverPublish.js` 가 다 하고, 이 라우트는 그걸 부르는 얇은 통로다.
 *
 * ⚠️ **이 기능은 이 서버(= `npm run dev` 를 지금 돌리고 있는 그 컴퓨터)에서만 뜻이 있다.**
 *    로그인 세션은 이 컴퓨터의 `.naver-profile/` 에 있고, 채운 결과를 보고 「발행」을
 *    누르는 사람도 이 컴퓨터 화면 앞에 있다. Vercel 같은 배포 서버에서 이 라우트가
 *    돌면 아무도 안 보는 화면에 브라우저 창을 띄우려다 그대로 죽는다 — 그래서 배포
 *    환경(`VERCEL` 환경 변수가 있는 곳)에서는 아예 시작하지 않고 안내만 돌려준다
 *    (요청자 결정: 앱 안 버튼으로 만들되 로컬 실행 전제, 2026-09-09).
 * ⚠️ **발행 버튼은 여기서도 누르지 않는다** — `lib/naverPublish.js` 의 규칙 그대로다.
 * ⚠️ **성공해도 브라우저 창을 닫지 않는다.** 사람이 결과를 보고 직접 발행할 때까지
 *    열려 있어야 하므로, 다른 라우트와 달리 여기서 `context.close()` 를 안 부르는 게
 *    실수가 아니라 의도다.
 */
import { SUPABASE } from "../../../../lib/supabase.js";
import {
  openBrowser,
  openWritePage,
  fillTitle,
  fillBody,
  titleFromDraft,
} from "../../../../lib/naverPublish.js";

export const runtime = "nodejs";

const fail = (status, message) => Response.json({ error: message }, { status });

async function requireApprovedUser(request) {
  const supabaseUrl = process.env.SUPABASE_URL || SUPABASE.url || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || SUPABASE.anonKey || "";
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, message: "서버의 Supabase 설정이 없습니다." };
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token) {
    return { ok: false, status: 401, message: "로그인이 필요합니다." };
  }

  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
    if (!userResponse.ok) {
      return { ok: false, status: 401, message: "로그인이 만료되었습니다. 다시 로그인해 주세요." };
    }
    const user = await userResponse.json();
    if (!user?.id) {
      return { ok: false, status: 401, message: "로그인 정보를 확인하지 못했습니다." };
    }

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=status`,
      { headers },
    );
    if (!profileResponse.ok) {
      return { ok: false, status: 403, message: "승인 상태를 확인하지 못했습니다." };
    }
    const [profile] = await profileResponse.json();
    if (profile?.status !== "approved") {
      return { ok: false, status: 403, message: "관리자 승인이 완료된 계정만 사용할 수 있습니다." };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 503, message: "로그인 확인 서버에 연결하지 못했습니다." };
  }
}

export async function POST(request) {
  if (process.env.VERCEL) {
    return fail(
      503,
      "이 기능은 배포된 서버에서 쓸 수 없습니다. 이 컴퓨터에서 `npm run dev` 로 직접 실행해 주세요.",
    );
  }

  const auth = await requireApprovedUser(request);
  if (!auth.ok) return fail(auth.status, auth.message);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "요청 내용을 읽지 못했습니다.");
  }

  const rawDraft = typeof body?.rawDraft === "string" ? body.rawDraft : "";
  const blogId = typeof body?.blogId === "string" ? body.blogId.trim() : "";
  // { [카드 번호]: "data:image/png;base64,..." } — 값이 data URL 문자열인 항목만 받는다.
  // 형식이 이상한 항목은 조용히 버린다(그 자리는 fillBody 가 텍스트 자리표시자로 대신한다).
  const images = {};
  if (body?.images && typeof body.images === "object") {
    for (const [no, dataUrl] of Object.entries(body.images)) {
      if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
        images[no] = dataUrl;
      }
    }
  }
  // { [카드 번호]: { size: "sm"|"md"|"lg", align: "left"|"center"|"right" } } — 화면
  // 미리보기(NaverBlogPreview.jsx)에서 고른 이미지 크기·정렬을 그대로 반영한다.
  const SIZES = new Set(["sm", "md", "lg"]);
  const ALIGNS = new Set(["left", "center", "right"]);
  const imageLayout = {};
  if (body?.imageLayout && typeof body.imageLayout === "object") {
    for (const [no, layout] of Object.entries(body.imageLayout)) {
      if (!layout || typeof layout !== "object") continue;
      imageLayout[no] = {
        size: SIZES.has(layout.size) ? layout.size : undefined,
        align: ALIGNS.has(layout.align) ? layout.align : undefined,
      };
    }
  }
  if (!rawDraft.trim()) return fail(400, "채워 넣을 글이 비어 있습니다.");
  if (!blogId) return fail(400, "네이버 블로그 아이디를 입력해 주세요.");

  // "글 구조 요약"에서 고른 제목을 우선 쓴다(요청자 결정, 2026-09-09) — 블로그 미리보기
  // 안 인용구 두 줄(검색어·후킹 문구)에서 뽑은 제목은 그 값이 없을 때만 대신 쓴다.
  const pickedTitle = typeof body?.title === "string" ? body.title.trim() : "";
  const title = pickedTitle || titleFromDraft(rawDraft) || "(제목 없음)";

  try {
    const { page } = await openBrowser();
    const frame = await openWritePage(page, blogId);
    await fillTitle(page, frame, title);
    await fillBody(page, frame, rawDraft, images, imageLayout);
    return Response.json({ ok: true, title });
  } catch (error) {
    return fail(500, error?.message || "네이버 글쓰기 화면을 채우지 못했습니다.");
  }
}
