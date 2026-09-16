-- 026: 사용자별 네이버 블로그 계정
--
-- 블로그마다 완전히 다른 네이버 로그인 계정이라는 전제라, 여기에 저장하는 건
-- "이 사용자가 어떤 블로그에 쓸 수 있는가"라는 메타데이터뿐이다. 실제 로그인
-- 세션(쿠키)은 이 표와 무관하게 로컬 파일(`.naver-profile/{id}/`)로 따로 있고,
-- 그 세션은 `npm run naver:setup -- {id}` 로 사람이 직접 로그인해야 생긴다
-- (lib/naverPublish.js 머리말 참고 — 이 프로젝트는 비밀번호를 코드로 다루지 않는다).
--
-- `id`(uuid)를 그대로 로컬 프로필 폴더 이름으로 쓴다. label·blog_id는 사용자가
-- 자유롭게 입력하는 값이라 경로 조작 위험이 있어 폴더 이름으로 쓰지 않는다.

create table public.naver_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  blog_id text not null,
  label text not null default '',

  created_at timestamptz not null default now()
);

-- 같은 사용자가 같은 블로그를 두 번 등록하지 않는다.
create unique index naver_accounts_user_blog_unique
  on public.naver_accounts (user_id, blog_id);

alter table public.naver_accounts enable row level security;

-- 정책을 만들지 않아 anon/authenticated 클라이언트의 직접 조회·수정을 모두 차단합니다.
-- /api/naver/accounts, /api/naver/fill 만 서버의 service_role로 접근합니다
-- (insta_users와 같은 패턴 — 012_create_insta_users.sql 참고).
