-- =====================================================================
-- TYPERFORMANCE App
-- Migration 035 — Segment L: readiness check + reward badges
-- =====================================================================

create table public.readiness (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  checked_on   date not null default public.sydney_today(),
  sleep        int not null check (sleep between 1 and 5),       -- 5 = great
  energy       int not null check (energy between 1 and 5),      -- 5 = high
  soreness     int not null check (soreness between 1 and 5),    -- 5 = very sore
  stress       int not null check (stress between 1 and 5),      -- 5 = very stressed
  motivation   int not null check (motivation between 1 and 5),  -- 5 = fired up
  sleep_hours  numeric(3,1) check (sleep_hours is null or sleep_hours between 0 and 16),
  -- 0–100: each answer scored so higher = more ready
  score        int generated always as (
                 round(((sleep + energy + (6 - soreness) + (6 - stress) + motivation) - 5) * 100.0 / 20)
               ) stored,
  created_at   timestamptz not null default now(),
  unique (athlete_id, checked_on)
);
create or replace function public.guard_readiness()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and not public.is_coach() then
    new.checked_on := public.sydney_today();   -- always today's check
  end if;
  return new;
end;
$$;
create trigger readiness_guard before insert or update on public.readiness
  for each row execute function public.guard_readiness();
create trigger readiness_feature before insert or update on public.readiness
  for each row execute function public.require_feature('feat_program');
alter table public.readiness enable row level security;
create policy "readiness_select" on public.readiness
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "readiness_write" on public.readiness
  for all to authenticated
  using (athlete_id = auth.uid() and public.is_active_user())
  with check (athlete_id = auth.uid() and public.is_active_user());

-- Badges: one row per badge earned (e.g. 'workouts_10', 'streak_4', 'pb_first')
create table public.badges (
  athlete_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  earned_on   date not null default public.sydney_today(),
  detail      text check (detail is null or length(detail) <= 200),
  primary key (athlete_id, key)
);
alter table public.badges enable row level security;
create policy "badges_select" on public.badges
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "badges_insert" on public.badges
  for insert to authenticated with check (athlete_id = auth.uid() and public.is_active_user());
