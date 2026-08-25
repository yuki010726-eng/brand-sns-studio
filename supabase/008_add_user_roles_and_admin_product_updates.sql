-- 008: 승인 상태와 별개로 앱 권한을 normal/admin 으로 구분한다.
do $$
begin
  create type public.user_role as enum ('normal', 'admin');
exception
  when duplicate_object then null;
end $$;

alter table public.users
  add column if not exists role public.user_role not null default 'normal'::public.user_role;

-- 관리자는 활성 여부와 관계없이 상품/근거/출처를 읽고 수정할 수 있다.
drop policy if exists "관리자는 전체 상품 조회" on public.products;
create policy "관리자는 전체 상품 조회" on public.products
  for select to authenticated
  using (exists (
    select 1 from public.users
    where users.id = auth.uid() and users.status = 'approved' and users.role = 'admin'
  ));

drop policy if exists "관리자는 상품 수정" on public.products;
create policy "관리자는 상품 수정" on public.products
  for update to authenticated
  using (exists (
    select 1 from public.users
    where users.id = auth.uid() and users.status = 'approved' and users.role = 'admin'
  ))
  with check (exists (
    select 1 from public.users
    where users.id = auth.uid() and users.status = 'approved' and users.role = 'admin'
  ));

drop policy if exists "관리자는 상품 근거 추가" on public.product_proofs;
create policy "관리자는 상품 근거 추가" on public.product_proofs
  for insert to authenticated with check (exists (
    select 1 from public.users
    where users.id = auth.uid() and users.status = 'approved' and users.role = 'admin'
  ));
drop policy if exists "관리자는 상품 근거 수정" on public.product_proofs;
create policy "관리자는 상품 근거 수정" on public.product_proofs
  for update to authenticated using (exists (
    select 1 from public.users
    where users.id = auth.uid() and users.status = 'approved' and users.role = 'admin'
  )) with check (exists (
    select 1 from public.users
    where users.id = auth.uid() and users.status = 'approved' and users.role = 'admin'
  ));

drop policy if exists "관리자는 상품 출처 추가" on public.product_sources;
create policy "관리자는 상품 출처 추가" on public.product_sources
  for insert to authenticated with check (exists (
    select 1 from public.users
    where users.id = auth.uid() and users.status = 'approved' and users.role = 'admin'
  ));
drop policy if exists "관리자는 상품 출처 수정" on public.product_sources;
create policy "관리자는 상품 출처 수정" on public.product_sources
  for update to authenticated using (exists (
    select 1 from public.users
    where users.id = auth.uid() and users.status = 'approved' and users.role = 'admin'
  )) with check (exists (
    select 1 from public.users
    where users.id = auth.uid() and users.status = 'approved' and users.role = 'admin'
  ));

-- Dashboard > Table Editor > users > role 에서 normal/admin 을 선택한다.
