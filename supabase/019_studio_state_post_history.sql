-- Convert the already-applied compact studio_state table from one row per user
-- to one compact row per saved post.
-- Run this after 018_compact_studio_state.sql.

alter table public.studio_state
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists post_id text not null default '';

-- The prior schema has one row per user. Preserve it as a history entry using
-- its original postId, with a stable fallback for records created before postId.
update public.studio_state
set id = coalesce(id, gen_random_uuid()),
    post_id = coalesce(nullif(post_id, ''), nullif(state->>'postId', ''), 'legacy-' || user_id::text);

alter table public.studio_state alter column id set not null;
alter table public.studio_state drop constraint if exists studio_state_pkey;
alter table public.studio_state add primary key (id);

create unique index if not exists studio_state_user_post_unique
  on public.studio_state (user_id, post_id);
create index if not exists studio_state_user_updated_at_idx
  on public.studio_state (user_id, updated_at desc);

comment on table public.studio_state is
  'Compact saved-post history. Full drafts/cards, AI runs, and image layout are not stored here.';
