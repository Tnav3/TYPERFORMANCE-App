-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 027 — "last opened the app" for the coach dashboard, and the
-- first-use tutorial rolled out to every athlete.
-- =====================================================================
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- Start from each person's last sign-in (the app stamps it from here on)
update public.profiles p set last_seen_at = u.last_sign_in_at
from auth.users u
where u.id = p.id and p.last_seen_at is null and u.last_sign_in_at is not null;

-- Roll the tutorial out to all athletes (tour + tips on next open)
update public.profiles set tutorial_done_at = null, tips_seen = '{}'
where role = 'athlete';

select count(*) filter (where role = 'athlete') as athletes,
       count(*) filter (where role = 'athlete' and tutorial_done_at is null) as will_see_tour,
       count(*) filter (where last_seen_at is not null) as with_last_seen
from public.profiles;
