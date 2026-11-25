-- =====================================================================
-- Migration 091 — payment hold.
--   A failed or cancelled payment puts the client on hold: they can still
--   message the coach, everything else is paused until the payment goes through.
--   Only the coach (or the server, via the GHL webhook) can change it.
-- =====================================================================
alter table public.profiles add column if not exists payment_hold boolean not null default false;

create or replace function public.guard_profile_payment_hold()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user = 'authenticated' and new.payment_hold is distinct from old.payment_hold and not public.is_coach() then
    raise exception 'Only the coach can change a payment hold';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_payment_hold on public.profiles;
create trigger profiles_guard_payment_hold
  before update of payment_hold on public.profiles
  for each row execute function public.guard_profile_payment_hold();
