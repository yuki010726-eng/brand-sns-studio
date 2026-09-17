-- 027: Classify saved posts by the creation flow.
-- Existing saved posts were created through the original 글 + 이미지 flow.

alter table public.studio_state
  add column if not exists type text not null default 'text_image';

update public.studio_state
set type = 'text_image'
where type is null or type not in ('text_image', 'image');

alter table public.studio_state
  drop constraint if exists studio_state_type_check;

alter table public.studio_state
  add constraint studio_state_type_check
  check (type in ('text_image', 'image'));

create index if not exists studio_state_user_type_updated_at_idx
  on public.studio_state (user_id, type, updated_at desc);

comment on column public.studio_state.type is
  'Creation flow: text_image (글 + 이미지) or image (이미지).';
