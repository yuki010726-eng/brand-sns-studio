-- 017: Drop unused copy preference/edit learning tables.
--
-- These tables were scaffolded for future copy-learning features, but the app
-- does not currently read or write them. Keep copy_selections untouched because
-- it has a separate RPC wrapper and may still be used for final-copy history.

drop function if exists public.record_copy_paragraph_edit(
  text,
  uuid,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  jsonb
);

drop table if exists public.copy_paragraph_edits;
drop table if exists public.user_copy_preferences;
