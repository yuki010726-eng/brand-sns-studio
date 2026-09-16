-- 023: 외부 광고 라이브러리에서 수집한 광고 소재
-- 전제: public.advertisers(id uuid)가 먼저 생성되어 있어야 합니다.

create table public.ads (
  id uuid primary key default gen_random_uuid(),

  -- 수집 출처 (예: meta_ad_library, google_ads_transparency)
  source text not null,
  -- 내부 광고주 레코드. 광고주를 삭제해도 수집 광고는 보존합니다.
  advertiser_id uuid references public.advertisers(id) on delete set null,
  -- 출처 플랫폼에서 광고를 식별하는 ID
  external_ad_id text,

  advertiser_name text,
  -- 광고 소재 형식 (예: image, video, text)
  format text,
  -- 광고가 노출된 플랫폼 (예: facebook, instagram, youtube)
  platform text,
  headline text,
  description text,
  thumbnail_url text,
  -- 광고를 클릭하거나 상세를 볼 때 이동할 원본 주소
  source_url text not null,

  -- 수집기가 이 광고를 처음/마지막으로 발견한 시각
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- 수집 당시 원본 응답 전체
  raw_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint ads_raw_data_object check (jsonb_typeof(raw_data) = 'object')
);

-- 동일 출처에서 외부 광고 ID가 중복 저장되는 것을 방지합니다.
-- external_ad_id를 제공하지 않는 출처의 광고는 source_url 등을 기준으로 별도 처리합니다.
create unique index ads_source_external_ad_id_key
  on public.ads (source, external_ad_id);

create index ads_advertiser_id_idx on public.ads (advertiser_id);
create index ads_source_last_seen_at_idx on public.ads (source, last_seen_at desc);
create index ads_platform_last_seen_at_idx on public.ads (platform, last_seen_at desc);

alter table public.ads enable row level security;

-- 수집 및 갱신은 service_role(수집기)로 수행하고, 승인된 사용자만 읽을 수 있습니다.
create policy "승인 사용자는 광고 조회" on public.ads
  for select to authenticated
  using (
    exists (
      select 1
      from public.users
      where users.id = auth.uid()
        and users.status = 'approved'
    )
  );
