-- 025: Keep each saved-post's full editable snapshot in studio_state.
-- Images remain browser-local (IndexedDB); their blobs are intentionally not
-- written to this JSON document.

alter table public.studio_state enable row level security;

drop policy if exists "Users can read their saved posts" on public.studio_state;
create policy "Users can read their saved posts" on public.studio_state
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their saved posts" on public.studio_state;
create policy "Users can create their saved posts" on public.studio_state
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their saved posts" on public.studio_state;
create policy "Users can update their saved posts" on public.studio_state
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their saved posts" on public.studio_state;
create policy "Users can delete their saved posts" on public.studio_state
  for delete to authenticated
  using (auth.uid() = user_id);

comment on table public.studio_state is
  'Per-user saved-post history. state.library_item contains the editable post snapshot; image blobs stay in browser IndexedDB.';
