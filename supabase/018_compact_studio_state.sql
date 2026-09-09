-- studio_state is a per-user saved-post index, not a working-document backup.
-- Run once in the Supabase SQL Editor.
alter table public.studio_state
  add column if not exists user_name text not null default '',
  add column if not exists insta_user_name text not null default '';

-- Keep the first saved time when the same user's compact state is upserted.
create or replace function public.normalize_studio_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_name text;
begin
  select name into saved_name from public.users where id = new.user_id;
  new.user_name := coalesce(saved_name, new.user_name, '');

  if tg_op = 'UPDATE' then
    new.state := jsonb_set(
      new.state,
      '{created_at}',
      coalesce(old.state->'created_at', to_jsonb(old.updated_at)),
      true
    );
  end if;
  new.state := jsonb_set(new.state, '{edit_at}', to_jsonb(now()), true);
  return new;
end;
$$;

drop trigger if exists normalize_studio_state on public.studio_state;
create trigger normalize_studio_state
  before insert or update on public.studio_state
  for each row execute procedure public.normalize_studio_state();

-- Compact rows that were written by the former full-state synchronizer.
update public.studio_state as studio
set state = jsonb_build_object(
  'product_id', nullif(studio.state->>'productId', ''),
  'product_name', coalesce((
    select product.name from public.products as product
    where product.id::text = studio.state->>'productId'
  ), ''),
  'topic', coalesce(studio.state->>'topic', ''),
  'created_at', coalesce(studio.state->'created_at', to_jsonb(studio.updated_at)),
  'edit_at', to_jsonb(now())
);

comment on table public.studio_state is
  'Latest saved-post metadata per user. Full drafts/cards are intentionally not stored here.';
