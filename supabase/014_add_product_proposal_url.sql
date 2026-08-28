-- 014: 상품별 제안서 파일의 공개 URL을 저장한다.
-- Supabase Storage 또는 외부 저장소의 다운로드 가능한 URL을 입력한다.
alter table public.products
  add column if not exists proposal_url text;

comment on column public.products.proposal_url is
  '상품 제안서 파일의 공개 URL (Supabase Storage 또는 외부 파일 URL)';
