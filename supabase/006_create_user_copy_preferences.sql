-- 006: 생성 원문과 최종 복사문에서 추출한 사용자별·채널별 글쓰기 선호
create table if not exists public.user_copy_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('blog', 'instagram', 'threads', '*')),
  sentence_style text not null default 'balanced'
    check (sentence_style in ('short', 'balanced', 'detailed')),
  frequently_removed_phrases text[] not null default '{}',
  frequently_added_phrases text[] not null default '{}',
  preferred_endings text[] not null default '{}',
  evidence_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel)
);

alter table public.user_copy_preferences enable row level security;

drop policy if exists "본인 카피 선호 조회" on public.user_copy_preferences;
create policy "본인 카피 선호 조회" on public.user_copy_preferences
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "본인 카피 선호 추가" on public.user_copy_preferences;
create policy "본인 카피 선호 추가" on public.user_copy_preferences
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "본인 카피 선호 수정" on public.user_copy_preferences;
create policy "본인 카피 선호 수정" on public.user_copy_preferences
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
