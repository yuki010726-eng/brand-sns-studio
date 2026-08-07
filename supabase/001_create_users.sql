-- 001: 이메일 회원 계정과 관리자 승인 상태
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "본인 승인 상태 조회" on public.users;
create policy "본인 승인 상태 조회" on public.users
  for select to authenticated using (auth.uid() = id);

create or replace function public.create_public_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.create_public_user();

-- Dashboard > Table Editor > users에서 status를 변경합니다.
