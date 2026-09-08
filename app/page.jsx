"use client";

/**
 * `/` 는 더 이상 별도 단계(페이지)가 아니다 (2026-09-08, 요청자 지시).
 * 상품·주제 선택은 `/text` 페이지 위쪽 「글 생성 조건 요약」 바를 펼쳐서 그 자리에서
 * 한다 — 3단계였던 흐름을 "한 페이지에서 최대한 끝내고 싶다"는 요청에 맞춰 옮겼다.
 *
 * 이 파일은 옛 "/" 경로로 오는 링크(북마크·헤더의 「새 게시물」 등)를 위한 통로로만
 * 남는다. 실제 헤더·보관함·프로필의 "새 게시물" 링크는 `/text` 로 바로 보내도록
 * 고쳤지만, 어딘가 이 주소가 그대로 남아 있어도 페이지가 없어 보이지 않도록
 * 안전망 삼아 둔다.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "./_components/LoadingScreen.jsx";

export default function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/text");
  }, [router]);

  return <LoadingScreen />;
}
