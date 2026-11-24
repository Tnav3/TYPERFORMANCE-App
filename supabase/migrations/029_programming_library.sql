-- =====================================================================
-- TYPERFORMANCE App
-- Migration 029 — Programming module, Segment A: feature toggles + exercise library
-- Spec: docs/PROGRAMMING_SPEC.md
-- =====================================================================

-- ---------- New per-client feature switches ----------
alter table public.profiles
  add column if not exists feat_program     boolean not null default true,
  add column if not exists feat_chat        boolean not null default true,
  add column if not exists feat_leaderboard boolean not null default false,
  add column if not exists feat_habits      boolean not null default false,
  add column if not exists feat_macros      boolean not null default false,
  add column if not exists feat_photos      boolean not null default false,
  add column if not exists feat_bodyweight  boolean not null default true;

create or replace function public.guard_profile_features()
returns trigger language plpgsql
as $$
begin
  if current_user = 'authenticated' and not public.is_coach() and (
       new.feat_checkin     is distinct from old.feat_checkin
    or new.feat_testing     is distinct from old.feat_testing
    or new.feat_1rm         is distinct from old.feat_1rm
    or new.feat_mas         is distinct from old.feat_mas
    or new.feat_rpe         is distinct from old.feat_rpe
    or new.feat_hr          is distinct from old.feat_hr
    or new.feat_fights      is distinct from old.feat_fights
    or new.feat_mobility    is distinct from old.feat_mobility
    or new.feat_nutrition   is distinct from old.feat_nutrition
    or new.feat_program     is distinct from old.feat_program
    or new.feat_chat        is distinct from old.feat_chat
    or new.feat_leaderboard is distinct from old.feat_leaderboard
    or new.feat_habits      is distinct from old.feat_habits
    or new.feat_macros      is distinct from old.feat_macros
    or new.feat_photos      is distinct from old.feat_photos
    or new.feat_bodyweight  is distinct from old.feat_bodyweight) then
    raise exception 'Only the coach can change which features you have';
  end if;
  return new;
end;
$$;

-- ---------- Exercise library ----------
create table public.exercises (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 80),
  category    text not null check (category in
                ('strength', 'power', 'plyometric', 'conditioning', 'mobility', 'core', 'accessory')),
  measure     text not null default 'load' check (measure in
                ('load', 'bodyweight', 'time', 'distance', 'calories')),
  lift_key    text references public.lifts(key),   -- links to the calculator for %1RM loads
  video_url   text check (video_url is null or (length(video_url) <= 300 and video_url ~ '^https://')),
  cues        text check (cues is null or length(cues) <= 1000),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index exercises_name_key on public.exercises (lower(name));
create trigger exercises_touch before update on public.exercises
  for each row execute function public.touch_updated_at();

alter table public.exercises enable row level security;
create policy "exercises_read" on public.exercises
  for select to authenticated using (public.is_active_user());
create policy "exercises_coach_insert" on public.exercises
  for insert to authenticated with check (public.is_coach());
create policy "exercises_coach_update" on public.exercises
  for update to authenticated using (public.is_coach()) with check (public.is_coach());
-- No delete: archive with active = false so old workouts keep their exercise.

-- Seed: every calculator lift (linked, so %1RM works) …
insert into public.exercises (name, category, measure, lift_key)
select l.name,
       case when l.kind in ('olympic', 'jump') then 'power' else 'strength' end,
       case when l.kind = 'bodyweight' then 'bodyweight' else 'load' end,
       l.key
from public.lifts l
where not exists (select 1 from public.exercises e where lower(e.name) = lower(l.name));

-- … plus common accessories, plyos, core and conditioning
insert into public.exercises (name, category, measure)
select v.name, v.category, v.measure
from (values
  ('Dumbbell Bench Press', 'accessory', 'load'),
  ('Dumbbell Row', 'accessory', 'load'),
  ('Dumbbell Split Squat', 'accessory', 'load'),
  ('Rear Foot Elevated Split Squat', 'accessory', 'load'),
  ('Goblet Squat', 'accessory', 'load'),
  ('Walking Lunge', 'accessory', 'load'),
  ('Single Leg RDL', 'accessory', 'load'),
  ('Nordic Hamstring Curl', 'accessory', 'bodyweight'),
  ('Copenhagen Plank', 'core', 'time'),
  ('Push-Up', 'accessory', 'bodyweight'),
  ('Chin-Up', 'accessory', 'bodyweight'),
  ('Pull-Up', 'accessory', 'bodyweight'),
  ('Inverted Row', 'accessory', 'bodyweight'),
  ('Face Pull', 'accessory', 'load'),
  ('Lat Pulldown', 'accessory', 'load'),
  ('Seated Cable Row', 'accessory', 'load'),
  ('Dumbbell Shoulder Press', 'accessory', 'load'),
  ('Neck Flexion', 'accessory', 'load'),
  ('Neck Extension', 'accessory', 'load'),
  ('Calf Raise', 'accessory', 'load'),
  ('Tibialis Raise', 'accessory', 'load'),
  ('Farmer Carry', 'accessory', 'distance'),
  ('Sled Push', 'conditioning', 'distance'),
  ('Pallof Press', 'core', 'load'),
  ('Dead Bug', 'core', 'bodyweight'),
  ('Front Plank', 'core', 'time'),
  ('Side Plank', 'core', 'time'),
  ('Hanging Knee Raise', 'core', 'bodyweight'),
  ('Med Ball Rotational Throw', 'power', 'load'),
  ('Med Ball Chest Pass', 'power', 'load'),
  ('Med Ball Slam', 'power', 'load'),
  ('Box Jump', 'plyometric', 'bodyweight'),
  ('Broad Jump', 'plyometric', 'bodyweight'),
  ('Pogo Jumps', 'plyometric', 'bodyweight'),
  ('Lateral Bound', 'plyometric', 'bodyweight'),
  ('Depth Jump', 'plyometric', 'bodyweight'),
  ('Assault Bike', 'conditioning', 'calories'),
  ('SkiErg', 'conditioning', 'calories'),
  ('Rower', 'conditioning', 'calories'),
  ('Run', 'conditioning', 'distance'),
  ('Treadmill Run', 'conditioning', 'time'),
  ('Skipping', 'conditioning', 'time'),
  ('Shadow Boxing', 'conditioning', 'time'),
  ('Walk', 'conditioning', 'time'),
  ('Hip 90/90', 'mobility', 'time'),
  ('Couch Stretch', 'mobility', 'time'),
  ('World''s Greatest Stretch', 'mobility', 'bodyweight'),
  ('Thoracic Rotation', 'mobility', 'bodyweight')
) as v(name, category, measure)
where not exists (select 1 from public.exercises e where lower(e.name) = lower(v.name));
