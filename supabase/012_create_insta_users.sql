create table if not exists public.insta_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instagram_user_id text not null unique,
  username text not null default '',
  account_type text not null default '',
  profile_picture_url text not null default '',
  access_token text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.insta_users enable row level security;

-- 정책을 만들지 않아 anon/authenticated 클라이언트의 직접 조회·수정을 모두 차단합니다.
-- OAuth 콜백과 게시 API만 서버의 service_role로 접근합니다.
