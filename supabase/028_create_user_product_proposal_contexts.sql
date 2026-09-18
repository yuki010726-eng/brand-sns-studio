-- Reusable proposal fact sheets. One signed-in user's summary per product.
-- The proposal URL is retained to invalidate the summary automatically when an
-- administrator replaces the source file.
create table if not exists public.user_product_proposal_contexts (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  proposal_url text not null,
  context text not null check (length(trim(context)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists user_product_proposal_contexts_user_product_idx
  on public.user_product_proposal_contexts(user_id, product_id);

alter table public.user_product_proposal_contexts enable row level security;

drop policy if exists "Users manage their own proposal contexts" on public.user_product_proposal_contexts;
create policy "Users manage their own proposal contexts"
  on public.user_product_proposal_contexts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists user_product_proposal_contexts_set_updated_at on public.user_product_proposal_contexts;
create trigger user_product_proposal_contexts_set_updated_at
  before update on public.user_product_proposal_contexts
  for each row execute function public.set_updated_at();

comment on table public.user_product_proposal_contexts is
  'Per-user reusable factual summaries extracted from product proposals.';
