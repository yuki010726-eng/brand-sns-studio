-- 002: Change users.status from text to a selectable enum type.
do $$
begin
  create type public.user_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end
$$;

alter table public.users
  alter column status drop default;

alter table public.users
  drop constraint if exists users_status_check;

alter table public.users
  alter column status type public.user_status
  using status::public.user_status;

alter table public.users
  alter column status set default 'pending'::public.user_status;
