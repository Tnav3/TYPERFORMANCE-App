-- =====================================================================
-- TYPERFORMANCE App
-- Migration 034 — Segment J: periodisation (season → phases)
-- =====================================================================

create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid references public.profiles(id) on delete cascade,
  group_id    uuid references public.groups(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 80),
  goal        text check (goal is null or length(goal) <= 500),
  notes       text check (notes is null or length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (num_nonnulls(athlete_id, group_id) = 1)
);
create trigger seasons_touch before update on public.seasons
  for each row execute function public.touch_updated_at();

create table public.phases (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references public.seasons(id) on delete cascade,
  name              text not null check (length(btrim(name)) between 1 and 60),
  start_date        date not null,
  end_date          date not null,
  emphasis          text[] not null default '{}' check (emphasis <@ array['strength','power','hypertrophy','conditioning','speed','skill','recovery','weight_cut']),
  goal              text check (goal is null or length(goal) <= 500),
  sessions_per_week int check (sessions_per_week is null or sessions_per_week between 0 and 21),
  sets_per_week     int check (sets_per_week is null or sets_per_week between 0 and 300),
  intensity_lo      int check (intensity_lo is null or intensity_lo between 20 and 110),
  intensity_hi      int check (intensity_hi is null or intensity_hi between 20 and 110),
  conditioning_min  int check (conditioning_min is null or conditioning_min between 0 and 1200),
  load_pattern      text not null default '3:1' check (load_pattern ~ '^[1-8]:[0-2]$'),
  program_id        uuid references public.programs(id) on delete set null,
  notes             text check (notes is null or length(notes) <= 2000),
  check (end_date >= start_date),
  check (end_date - start_date <= 7 * 26),
  check (intensity_lo is null or intensity_hi is null or intensity_lo <= intensity_hi)
);
create index phases_season_idx on public.phases (season_id, start_date);

create or replace function public.can_see_season(s uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_coach() or exists (
    select 1 from public.seasons x
    where x.id = s and public.is_active_user()
      and (x.athlete_id = auth.uid() or (x.group_id is not null and public.is_group_member(x.group_id)))
  )
$$;

alter table public.seasons enable row level security;
alter table public.phases  enable row level security;
create policy "seasons_select" on public.seasons for select to authenticated using (public.can_see_season(id));
create policy "seasons_coach"  on public.seasons for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "phases_select"  on public.phases  for select to authenticated using (public.can_see_season(season_id));
create policy "phases_coach"   on public.phases  for all to authenticated using (public.is_coach()) with check (public.is_coach());
