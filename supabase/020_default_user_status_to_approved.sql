-- 020: 신규 가입자의 기본 승인 상태를 pending → approved 로 바꾼다.
--
-- 배경: 지금까지는 회원가입하면 `public.users.status` 가 'pending' 으로 들어가서,
-- 관리자가 Table Editor 에서 하나씩 'approved' 로 바꿔줘야 AI 글귀 생성(`/api/text`)·
-- 네이버 자동 채우기(`/api/naver/fill`) 같은 서버 라우트를 쓸 수 있었다(001·11절 참고).
-- 요청자 결정(2026-09-11): 가입하면 바로 쓸 수 있게 기본값을 'approved' 로 바꾼다.
--
-- ⚠️ 이미 만들어진 계정의 상태는 이 마이그레이션이 건드리지 않는다 — 컬럼 기본값은
--    "앞으로 새로 들어오는 행"에만 적용된다. 이미 'pending' 인 계정은 Table Editor 에서
--    직접 'approved' 로 바꿔야 한다.
-- ⚠️ 되돌리려면 이 파일의 'approved' 를 'pending' 으로 바꿔 다시 실행하면 된다.
alter table public.users
  alter column status set default 'approved'::public.user_status;
