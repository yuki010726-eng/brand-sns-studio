import { SUPABASE } from "../../../../lib/supabase.js";
import {
  canonicalBlogUrl,
  fetchText,
  mobileBlogUrl,
  parseArticle,
} from "../../../../api/research/_shared.mjs";

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
  const auth = await requireApprovedUser(request);
  if (!auth.ok) return fail(auth.status, auth.message);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "요청 내용을 읽지 못했습니다.");
  }

  const urls = [
    ...new Set(
      (Array.isArray(body?.urls) ? body.urls : [])
        .map(canonicalBlogUrl)
        .filter(Boolean),
    ),
  ].slice(0, 5);
  if (!urls.length) {
    return fail(400, "수집할 네이버 블로그 글 링크를 입력해 주세요.");
  }

  const items = [];
  for (const url of urls) {
    try {
      const article = parseArticle(await fetchText(mobileBlogUrl(url)));
      if (article.text.length < 100) {
        throw new Error("본문을 충분히 읽지 못했습니다.");
      }
      items.push({
        url,
        title: article.title || "제목 없음",
        author: article.author || "",
        text: article.text.slice(0, 18000),
        canMakePdf: true,
      });
    } catch (error) {
      items.push({
        url,
        error: error?.message || "블로그 글을 수집하지 못했습니다.",
      });
    }
  }

  return Response.json({ items });
}
