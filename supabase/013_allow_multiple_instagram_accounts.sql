-- 한 서비스 사용자에게 여러 Instagram 계정을 연결할 수 있도록 기본 키를 분리한다.
alter table public.insta_users drop constraint if exists insta_users_pkey;
alter table public.insta_users add column if not exists id uuid default gen_random_uuid();
update public.insta_users set id = gen_random_uuid() where id is null;
alter table public.insta_users alter column id set not null;
alter table public.insta_users add primary key (id);
create unique index if not exists insta_users_user_instagram_unique
  on public.insta_users (user_id, instagram_user_id);
