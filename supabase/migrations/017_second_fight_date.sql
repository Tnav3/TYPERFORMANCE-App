-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 017 — up to two planned fights (next + the one after)
-- =====================================================================
alter table public.profiles
  add column if not exists second_fight_date date;

alter table public.profiles
  add constraint profiles_second_fight_after_next
  check (second_fight_date is null or (next_fight_date is not null and second_fight_date > next_fight_date));
