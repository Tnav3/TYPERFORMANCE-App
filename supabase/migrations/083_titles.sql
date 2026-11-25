-- =====================================================================
-- Migration 083 — titles and belts, shown as badges on the player card.
--   org:    sanctioning body as typed, e.g. WBC, WBA, ISKA (text only; no logos)
--   name:   e.g. "Australian Welterweight"
--   colour: one of a fixed palette for the badge
-- The athlete and coaches can add and remove them.
-- =====================================================================
create table if not exists public.titles (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  org         text not null check (length(btrim(org)) between 2 and 20),
  name        text check (name is null or length(name) <= 60),
  colour      text not null default 'gold' check (colour in ('gold', 'green', 'red', 'blue', 'black', 'silver', 'purple')),
  won_on      date,
  created_at  timestamptz not null default now()
);
create index if not exists titles_athlete_idx on public.titles (athlete_id);

alter table public.titles enable row level security;

drop policy if exists titles_own on public.titles;
create policy titles_own on public.titles
  for all to authenticated
  using (athlete_id = auth.uid() and public.is_active_user())
  with check (athlete_id = auth.uid() and public.is_active_user());

drop policy if exists titles_coach on public.titles;
create policy titles_coach on public.titles
  for all to authenticated
  using (public.is_coach())
  with check (public.is_coach());
