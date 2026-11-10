-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 026 — first-use tutorial
--   tutorial_done_at: welcome tour finished or skipped (null = show it)
--   tips_seen:        feature tips already dismissed
-- Existing accounts are marked done so current clients aren't interrupted;
-- the coach resets an account (or everyone) to show it. New sign-ups see it.
-- =====================================================================
alter table public.profiles
  add column if not exists tutorial_done_at timestamptz,
  add column if not exists tips_seen text[] not null default '{}'
    check (cardinality(tips_seen) <= 50);

update public.profiles set tutorial_done_at = now() where tutorial_done_at is null;

select count(*) filter (where tutorial_done_at is null) as will_see_tour,
       count(*) as accounts
from public.profiles;
