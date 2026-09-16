-- 022: 광고 수집 대상 광고주

create table public.advertisers (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  domain text,
  google_transparency_url text,
  category text,

  last_collected_at timestamptz,
  created_at timestamptz not null default now(),

  constraint advertisers_domain_not_blank
    check (domain is null or btrim(domain) <> '')
);

-- 도메인이 있는 광고주는 대소문자와 관계없이 하나만 등록합니다.
create unique index advertisers_domain_key
  on public.advertisers (lower(domain))
  where domain is not null;

create index advertisers_name_idx on public.advertisers (name);

alter table public.advertisers enable row level security;

-- 수집 대상 관리는 service_role 또는 Dashboard에서 수행합니다.
create policy "승인 사용자는 광고주 조회" on public.advertisers
  for select to authenticated
  using (
    exists (
      select 1
      from public.users
      where users.id = auth.uid()
        and users.status = 'approved'
    )
  );
