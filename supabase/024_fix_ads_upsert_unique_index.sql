-- 024: Supabase upsert가 사용할 수 있도록 ads 외부 ID 유니크 인덱스를 교체합니다.
-- PostgreSQL의 일반 unique 인덱스는 NULL을 서로 다른 값으로 취급하므로,
-- external_ad_id가 없는 광고도 여러 건 저장할 수 있습니다.

drop index if exists public.ads_source_external_ad_id_key;

create unique index ads_source_external_ad_id_key
  on public.ads (source, external_ad_id);
