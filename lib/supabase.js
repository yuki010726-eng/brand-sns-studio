/**
 * Supabase 연결 — 이메일/비밀번호 로그인과 작업 내용 동기화의 토대
 *
 * 왜 필요한가
 * 이 앱은 여태 브라우저에만 데이터를 뒀다. 그래서 기기를 옮기면 작업 내용이 따라오지 않았다
 * (코드만 git 으로 오갔다). 요청자 요구: **여러 기기에서 이어서 작업.**
 *
 * 왜 Supabase 인가
 * 이 프로젝트에는 node/npm 이 없다. Supabase 는 CDN 에서 ES 모듈로 바로 가져올 수 있어서
 * 빌드 도구 없이 지금 구조에 그대로 붙는다.
 *
 * 현재 앱은 승인된 계정 로그인을 접근 관문으로 사용하므로 Supabase 설정이 필수다.
 */

/** CDN 에서 그대로 가져온다 — 번들러가 없으므로 이 방식뿐이다 */
const SDK_URL = 'https://esm.sh/@supabase/supabase-js@2';

/**
 * 프로젝트 설정.
 *
 * ⚠️ anon 키는 **비밀이 아니다.** Supabase 가 클라이언트에 심으라고 만든 공개 키이고,
 *    실제 보호는 테이블의 RLS(행 수준 보안) 정책이 한다. 그래서 파일에 둬도 된다.
 *    ⚠️ 단, `service_role` 키는 절대 여기에 넣지 말 것 — 그건 모든 권한을 가진 진짜 비밀키다.
 *
 * 값이 비어 있으면 로그인할 수 없으므로 보호된 화면에 접근할 수 없다.
 */
export const SUPABASE = {
  url: 'https://zinwsmsrngiapthrbkme.supabase.co',       // 예: https://xxxxxxxxxxxx.supabase.co
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppbndzbXNybmdpYXB0aHJia21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTI0MjMsImV4cCI6MjEwMTM2ODQyM30.kInI7PYm5pqVu9_vYLJyJoDRsFk_c8aRbI3crY6AHts',   // 예: eyJhbGciOi... (Project Settings → API → anon public)
};

export const isConfigured = () => Boolean(SUPABASE.url && SUPABASE.anonKey);

let clientPromise = null;

/**
 * 클라이언트를 한 번만 만들어 재사용한다.
 * @returns {Promise<object|null>} 설정이 없으면 null
 */
export async function getClient() {
  if (!isConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import(/* @vite-ignore */ SDK_URL)
      .then(({ createClient }) => createClient(SUPABASE.url, SUPABASE.anonKey, {
        auth: {
          persistSession: true,       // 새로고침해도 로그인 유지
          autoRefreshToken: true,
          detectSessionInUrl: true,   // 인증 확인/복구 링크의 세션을 주소에서 회수한다
        },
      }))
      .catch((e) => {
        console.warn('[supabase] SDK 로드 실패 — 로그인할 수 없습니다.', e);
        clientPromise = null;
        return null;
      });
  }
  return clientPromise;
}
