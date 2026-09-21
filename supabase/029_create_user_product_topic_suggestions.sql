-- Per-user generated topic suggestions. Source URL invalidates stale results
-- when the proposal or official site changes.
create table if not exists public.user_product_topic_suggestions (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  source_url text not null,
  topics jsonb not null check (jsonb_typeof(topics) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.user_product_topic_suggestions enable row level security;

drop policy if exists "Users manage their own topic suggestions" on public.user_product_topic_suggestions;
create policy "Users manage their own topic suggestions"
  on public.user_product_topic_suggestions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists user_product_topic_suggestions_set_updated_at on public.user_product_topic_suggestions;
create trigger user_product_topic_suggestions_set_updated_at
  before update on public.user_product_topic_suggestions
  for each row execute function public.set_updated_at();
