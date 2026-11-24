-- =====================================================================
-- TYPERFORMANCE App
-- Migration 031 — Programming module, Segment C: groups, assignment, dated workouts
-- A workout belongs to ONE client or ONE group. Group workouts show for every
-- member unless that member has a personal override of it.
-- =====================================================================

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 60),
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index groups_name_key on public.groups (lower(name));

create table public.group_members (
  group_id    uuid not null references public.groups(id) on delete cascade,
  athlete_id  uuid not null references public.profiles(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (group_id, athlete_id)
);
create index group_members_athlete_idx on public.group_members (athlete_id);

create or replace function public.is_group_member(g uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.group_members where group_id = g and athlete_id = auth.uid())
$$;

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
create policy "groups_select" on public.groups
  for select to authenticated using (public.is_coach() or public.is_group_member(id));
create policy "groups_coach_write" on public.groups
  for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "group_members_select" on public.group_members
  for select to authenticated using (public.is_coach() or athlete_id = auth.uid());
create policy "group_members_coach_write" on public.group_members
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- ---------- Assignments ----------
create table public.assignments (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid references public.programs(id) on delete set null,
  program_name text not null,                       -- kept if the template is deleted
  athlete_id  uuid references public.profiles(id) on delete cascade,
  group_id    uuid references public.groups(id) on delete cascade,
  start_date  date not null,
  created_at  timestamptz not null default now(),
  check (num_nonnulls(athlete_id, group_id) = 1)
);
alter table public.assignments enable row level security;
create policy "assignments_coach" on public.assignments
  for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "assignments_own_select" on public.assignments
  for select to authenticated using (athlete_id = auth.uid() or (group_id is not null and public.is_group_member(group_id)));

-- ---------- Dated workouts ----------
create table public.workouts (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid references public.profiles(id) on delete cascade,
  group_id       uuid references public.groups(id) on delete cascade,
  assignment_id  uuid references public.assignments(id) on delete set null,
  overrides_id   uuid references public.workouts(id) on delete set null,
  workout_date   date not null,
  position       int  not null default 0,
  title          text not null check (length(btrim(title)) between 1 and 80),
  notes          text check (notes is null or length(notes) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (num_nonnulls(athlete_id, group_id) = 1),
  check (overrides_id is null or athlete_id is not null)
);
create index workouts_athlete_date_idx on public.workouts (athlete_id, workout_date);
create index workouts_group_date_idx on public.workouts (group_id, workout_date);
create unique index workouts_one_override on public.workouts (athlete_id, overrides_id) where overrides_id is not null;
create trigger workouts_touch before update on public.workouts
  for each row execute function public.touch_updated_at();

create table public.workout_items (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  position     int  not null default 0,
  kind         text not null default 'exercise' check (kind in ('exercise', 'text')),
  exercise_id  uuid references public.exercises(id),
  block        text not null default 'A' check (block ~ '^[A-Z]$'),
  slot         int  not null default 1 check (slot between 1 and 9),
  sets         int  check (sets is null or sets between 1 and 20),
  reps         text check (reps is null or length(reps) between 1 and 20),
  load_type    text not null default 'none' check (load_type in ('percent', 'rpe', 'kg', 'bodyweight', 'none')),
  percent      numeric(5,2) check (percent is null or percent between 1 and 120),
  rpe          numeric(3,1) check (rpe is null or rpe between 1 and 10),
  load_kg      numeric(6,2) check (load_kg is null or load_kg between 0 and 600),
  tempo        text check (tempo is null or length(tempo) <= 10),
  rest_sec     int  check (rest_sec is null or rest_sec between 0 and 1800),
  title        text check (title is null or length(title) <= 80),
  notes        text check (notes is null or length(notes) <= 2000),
  check ((kind = 'exercise') = (exercise_id is not null)),
  check (kind = 'exercise' or coalesce(title, notes) is not null),
  check (load_type <> 'percent' or percent is not null),
  check (load_type <> 'rpe' or rpe is not null),
  check (load_type <> 'kg' or load_kg is not null)
);
create index workout_items_workout_idx on public.workout_items (workout_id, position);

-- Can the signed-in user see this workout?
create or replace function public.can_see_workout(w uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_coach() or exists (
    select 1 from public.workouts x
    where x.id = w and public.is_active_user()
      and (x.athlete_id = auth.uid() or (x.group_id is not null and public.is_group_member(x.group_id)))
  )
$$;

alter table public.workouts      enable row level security;
alter table public.workout_items enable row level security;
create policy "workouts_select" on public.workouts
  for select to authenticated using (public.can_see_workout(id));
create policy "workouts_coach_write" on public.workouts
  for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "workout_items_select" on public.workout_items
  for select to authenticated using (public.can_see_workout(workout_id));
create policy "workout_items_coach_write" on public.workout_items
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- The signed-in client's workouts between two dates: their own plus their
-- groups', minus any group workout they have a personal override of.
create or replace function public.my_workouts(p_from date, p_to date)
returns setof public.workouts language sql stable
set search_path = public
as $$
  select w.* from workouts w
  where w.workout_date between p_from and p_to
    and (w.athlete_id = auth.uid()
         or (w.group_id is not null and is_group_member(w.group_id)
             and not exists (select 1 from workouts o where o.overrides_id = w.id and o.athlete_id = auth.uid())))
  order by w.workout_date, w.position, w.created_at
$$;

-- Same, for the coach looking at one client.
create or replace function public.client_workouts(p_athlete uuid, p_from date, p_to date)
returns setof public.workouts language sql stable
set search_path = public
as $$
  select w.* from workouts w
  where public.is_coach()
    and w.workout_date between p_from and p_to
    and (w.athlete_id = p_athlete
         or (w.group_id in (select group_id from group_members where athlete_id = p_athlete)
             and not exists (select 1 from workouts o where o.overrides_id = w.id and o.athlete_id = p_athlete)))
  order by w.workout_date, w.position, w.created_at
$$;

-- Assign a program to a client or a group from a start date (day 1 = start date).
create or replace function public.assign_program(
  p_program uuid, p_athlete uuid, p_group uuid, p_start date)
returns uuid language plpgsql
set search_path = public
as $$
declare a uuid; d record; w uuid; pname text;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  if num_nonnulls(p_athlete, p_group) <> 1 then raise exception 'Pick one client or one group'; end if;
  select name into pname from programs where id = p_program;
  if pname is null then raise exception 'Program not found'; end if;
  insert into assignments (program_id, program_name, athlete_id, group_id, start_date)
  values (p_program, pname, p_athlete, p_group, p_start) returning id into a;
  for d in select * from program_days where program_id = p_program order by week_no, day_no loop
    insert into workouts (athlete_id, group_id, assignment_id, workout_date, title, notes)
    values (p_athlete, p_group, a, p_start + (d.week_no - 1) * 7 + (d.day_no - 1),
            coalesce(nullif(btrim(d.title), ''), pname || ' · W' || d.week_no || 'D' || d.day_no), d.notes)
    returning id into w;
    insert into workout_items (workout_id, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes)
    select w, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes
    from program_items where day_id = d.id;
  end loop;
  return a;
end;
$$;

-- Personalise one group workout for one member. Returns the personal copy.
create or replace function public.override_workout(p_workout uuid, p_athlete uuid)
returns uuid language plpgsql
set search_path = public
as $$
declare w uuid; src workouts;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  select * into src from workouts where id = p_workout;
  if src.id is null or src.group_id is null then raise exception 'Only group workouts can be personalised'; end if;
  if not exists (select 1 from group_members where group_id = src.group_id and athlete_id = p_athlete) then
    raise exception 'That client is not in this group';
  end if;
  select id into w from workouts where overrides_id = p_workout and athlete_id = p_athlete;
  if w is not null then return w; end if;
  insert into workouts (athlete_id, overrides_id, assignment_id, workout_date, position, title, notes)
  values (p_athlete, p_workout, src.assignment_id, src.workout_date, src.position, src.title, src.notes)
  returning id into w;
  insert into workout_items (workout_id, position, kind, exercise_id, block, slot, sets, reps,
    load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes)
  select w, position, kind, exercise_id, block, slot, sets, reps,
    load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes
  from workout_items where workout_id = p_workout;
  return w;
end;
$$;
