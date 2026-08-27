-- OpenAI 호출별 사용자/기능/토큰 사용량 로그

create table if not exists public.openai_usage_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text,
  type text not null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  cached_tokens integer not null default 0 check (cached_tokens >= 0),
  reasoning_tokens integer not null default 0 check (reasoning_tokens >= 0),
  openai_response_id text,
  created_at timestamptz not null default now()
);

-- 테이블이 이미 있던 환경(이 컬럼이 추가되기 전)에도 반영되도록 별도로 추가한다.
alter table public.openai_usage_logs add column if not exists user_name text;

create index if not exists openai_usage_logs_user_created_idx
  on public.openai_usage_logs(user_id, created_at desc);

create index if not exists openai_usage_logs_type_created_idx
  on public.openai_usage_logs(type, created_at desc);

alter table public.openai_usage_logs enable row level security;

-- user_name은 프론트/API가 값을 실어 보내지 않는다 — user_id로 public.users를 직접 찾아 채운다.
create or replace function public.set_openai_usage_log_user_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select name into new.user_name from public.users where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists set_openai_usage_log_user_name on public.openai_usage_logs;
create trigger set_openai_usage_log_user_name before insert on public.openai_usage_logs
  for each row execute procedure public.set_openai_usage_log_user_name();

drop policy if exists "본인 OpenAI 사용량 추가" on public.openai_usage_logs;
create policy "본인 OpenAI 사용량 추가" on public.openai_usage_logs
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "본인 또는 관리자 OpenAI 사용량 조회" on public.openai_usage_logs;
create policy "본인 또는 관리자 OpenAI 사용량 조회" on public.openai_usage_logs
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.users
      where users.id = auth.uid() and users.role = 'admin'
    )
  );

comment on table public.openai_usage_logs is 'OpenAI 호출별 사용자 및 기능 단위 토큰 사용량';
comment on column public.openai_usage_logs.type is 'topic_recommendation, blog_generation 등 호출 기능 구분';
comment on column public.openai_usage_logs.user_name is '트리거가 삽입 시점에 public.users.name 에서 채운다 — 앱이 값을 보내지 않는다 (이후 이름이 바뀌어도 소급 반영되지 않는다)';
