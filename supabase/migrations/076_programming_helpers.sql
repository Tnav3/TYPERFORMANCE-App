-- =====================================================================
-- Migration 076 — programming helpers
--   client_flags: injuries, competitions and notes the coach keeps in view
--     while programming (coach-only).
--   loading_schemes: preset set/rep/intensity schemes by week (coach editable).
--   set_plan on program_items/workout_items: optional per-set targets,
--     e.g. [{"r":"5","p":75},{"r":"4","p":80},{"r":"3","p":85}]. Copied
--     everywhere items are copied.
-- =====================================================================
create table public.client_flags (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('injury', 'competition', 'note')),
  title       text not null check (length(btrim(title)) between 2 and 80),
  detail      text check (detail is null or length(detail) <= 600),
  event_date  date,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index client_flags_athlete_idx on public.client_flags (athlete_id, active);
alter table public.client_flags enable row level security;
create policy "client_flags_coach" on public.client_flags for all to authenticated using (public.is_coach()) with check (public.is_coach());

create table public.loading_schemes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(btrim(name)) between 2 and 60),
  description text check (description is null or length(description) <= 300),
  load_type   text not null default 'percent' check (load_type in ('percent', 'rpe', 'none')),
  weeks       jsonb not null check (jsonb_typeof(weeks) = 'array' and jsonb_array_length(weeks) between 1 and 12),
  sort        int not null default 100,
  created_at  timestamptz not null default now()
);
alter table public.loading_schemes enable row level security;
create policy "loading_schemes_coach" on public.loading_schemes for all to authenticated using (public.is_coach()) with check (public.is_coach());

do $$ begin
  execute 'alter table public.program_items add column if not exists set_plan jsonb check (set_plan is null or (jsonb_typeof(set_plan) = ''array'' and jsonb_array_length(set_plan) between 1 and 20))';
  execute 'alter table public.workout_items add column if not exists set_plan jsonb check (set_plan is null or (jsonb_typeof(set_plan) = ''array'' and jsonb_array_length(set_plan) between 1 and 20))';
end $$;

-- Starting points only. Edit the numbers to suit; add your own.
insert into public.loading_schemes (name, description, load_type, weeks, sort) values
  ('Step-down 5/5/5 > 5/4/4 > 5/4/3', 'Reps drop each week while intensity climbs. Edit the RPEs to suit.', 'rpe',
   '[[{"r":"5","e":7},{"r":"5","e":7},{"r":"5","e":7}],[{"r":"5","e":7.5},{"r":"4","e":8},{"r":"4","e":8}],[{"r":"5","e":8},{"r":"4","e":8.5},{"r":"3","e":9}]]', 10),
  ('5/3/1 (Wendler)', 'Classic 4-week wave off a training max. Last set is AMRAP (+). Week 4 deload.', 'percent',
   '[[{"r":"5","p":65},{"r":"5","p":75},{"r":"5+","p":85}],[{"r":"3","p":70},{"r":"3","p":80},{"r":"3+","p":90}],[{"r":"5","p":75},{"r":"3","p":85},{"r":"1+","p":95}],[{"r":"5","p":40},{"r":"5","p":50},{"r":"5","p":60}]]', 20),
  ('Ascending pyramid 10/8/6/4', 'Load goes up as reps come down. Same every week; progress the RPE or load yourself.', 'rpe',
   '[[{"r":"10","e":6},{"r":"8","e":7},{"r":"6","e":8},{"r":"4","e":8.5}]]', 30),
  ('Wave 3/2/1 x 2', 'Two waves; second wave slightly heavier than the first.', 'rpe',
   '[[{"r":"3","e":7.5},{"r":"2","e":8},{"r":"1","e":8.5},{"r":"3","e":8},{"r":"2","e":8.5},{"r":"1","e":9}]]', 40),
  ('Straight sets 3x8 building', 'Same sets and reps; RPE builds weekly.', 'rpe',
   '[[{"r":"8","e":7},{"r":"8","e":7},{"r":"8","e":7}],[{"r":"8","e":7.5},{"r":"8","e":7.5},{"r":"8","e":7.5}],[{"r":"8","e":8},{"r":"8","e":8},{"r":"8","e":8}]]', 50);

create or replace function public.copy_program_week(p_program uuid, p_from int, p_to int)
returns void language plpgsql
set search_path = public
as $$
declare d record; new_day uuid;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  if p_from = p_to then return; end if;
  delete from program_days where program_id = p_program and week_no = p_to;
  for d in select * from program_days where program_id = p_program and week_no = p_from loop
    insert into program_days (program_id, week_no, day_no, title, notes)
    values (p_program, p_to, d.day_no, d.title, d.notes) returning id into new_day;
    insert into program_items (day_id, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan)
    select new_day, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan
    from program_items where day_id = d.id;
  end loop;
end;
$$;

create or replace function public.duplicate_program(p_program uuid, p_name text)
returns uuid language plpgsql
set search_path = public
as $$
declare new_prog uuid; d record; new_day uuid;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  insert into programs (name, description, tag, weeks, instructions, reveal_weekly)
  select p_name, description, tag, weeks, instructions, reveal_weekly from programs where id = p_program
  returning id into new_prog;
  if new_prog is null then raise exception 'Program not found'; end if;
  for d in select * from program_days where program_id = p_program loop
    insert into program_days (program_id, week_no, day_no, title, notes)
    values (new_prog, d.week_no, d.day_no, d.title, d.notes) returning id into new_day;
    insert into program_items (day_id, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan)
    select new_day, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan
    from program_items where day_id = d.id;
  end loop;
  return new_prog;
end;
$$;

create or replace function public.assign_program(
  p_program uuid, p_athlete uuid, p_group uuid, p_start date)
returns uuid language plpgsql
set search_path = public
as $$
declare a uuid; d record; w uuid; pname text; pinstr text; preveal boolean;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  if num_nonnulls(p_athlete, p_group) <> 1 then raise exception 'Pick one client or one group'; end if;
  select name, instructions, reveal_weekly into pname, pinstr, preveal from programs where id = p_program;
  if pname is null then raise exception 'Program not found'; end if;
  insert into assignments (program_id, program_name, instructions, reveal_weekly, athlete_id, group_id, start_date)
  values (p_program, pname, pinstr, preveal, p_athlete, p_group, p_start) returning id into a;
  for d in select * from program_days where program_id = p_program order by week_no, day_no loop
    insert into workouts (athlete_id, group_id, assignment_id, workout_date, title, notes)
    values (p_athlete, p_group, a, p_start + (d.week_no - 1) * 7 + (d.day_no - 1),
            coalesce(nullif(btrim(d.title), ''), pname || ' · W' || d.week_no || 'D' || d.day_no), d.notes)
    returning id into w;
    insert into workout_items (workout_id, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan)
    select w, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan
    from program_items where day_id = d.id;
  end loop;
  return a;
end;
$$;

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
    load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan)
  select w, position, kind, exercise_id, block, slot, sets, reps,
    load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan
  from workout_items where workout_id = p_workout;
  return w;
end;
$$;

create or replace function public.move_my_workout(p_workout uuid, p_date date)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); src workouts; w uuid; today date := public.sydney_today();
begin
  if me is null or not public.is_active_user() then raise exception 'permission denied'; end if;
  if p_date is null or p_date < today - 7 or p_date > today + 28 then raise exception 'Pick a day from last week to 4 weeks ahead'; end if;
  select * into src from workouts where id = p_workout;
  if src.id is null then raise exception 'Workout not found'; end if;
  if not (coalesce(src.athlete_id = me, false) or (src.group_id is not null and exists (select 1 from group_members where group_id = src.group_id and athlete_id = me))) then
    raise exception 'Workout not found';
  end if;
  if exists (select 1 from workout_logs where workout_id = p_workout and athlete_id = me and completed_at is not null) then
    raise exception 'That workout is already finished';
  end if;
  if src.group_id is not null and src.athlete_id is null then
    -- personal copy for this client on the new day
    select id into w from workouts where overrides_id = p_workout and athlete_id = me;
    if w is null then
      insert into workouts (athlete_id, overrides_id, assignment_id, workout_date, position, title, notes, created_by)
      values (me, p_workout, src.assignment_id, p_date, src.position, src.title, src.notes, null)
      returning id into w;
      insert into workout_items (workout_id, position, kind, exercise_id, block, slot, sets, reps,
        load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan)
      select w, position, kind, exercise_id, block, slot, sets, reps,
        load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan
      from workout_items where workout_id = p_workout;
    else
      update workouts set workout_date = p_date where id = w;
    end if;
  else
    w := src.id;
    update workouts set workout_date = p_date where id = w;
  end if;
  insert into notifications (user_id, kind, title, body, url)
  select c.id, 'workout', left(coalesce((select full_name from profiles where id = me), 'A client') || ' moved a workout', 80),
         left(src.title || ': ' || to_char(src.workout_date, 'Dy DD Mon') || ' → ' || to_char(p_date, 'Dy DD Mon'), 200),
         '/coach/athlete/' || me || '/program'
  from profiles c where c.role = 'coach' and c.status = 'active';
  return w;
end;
$$;

create or replace function public.copy_assignment_to(p_assignment uuid, p_athlete uuid, p_start date)
returns uuid language plpgsql security definer set search_path = public
as $$
declare src assignments; a uuid; w record; nw uuid; shift int;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  select * into src from assignments where id = p_assignment;
  if src.id is null then raise exception 'Block not found'; end if;
  if not exists (select 1 from profiles where id = p_athlete and role = 'athlete') then raise exception 'Client not found'; end if;
  shift := p_start - src.start_date;
  insert into assignments (program_id, program_name, instructions, reveal_weekly, athlete_id, start_date)
  values (src.program_id, src.program_name, src.instructions, src.reveal_weekly, p_athlete, p_start) returning id into a;
  for w in select * from workouts where assignment_id = p_assignment and overrides_id is null order by workout_date, position loop
    insert into workouts (athlete_id, assignment_id, workout_date, position, title, notes)
    values (p_athlete, a, w.workout_date + shift, w.position, w.title, w.notes) returning id into nw;
    insert into workout_items (workout_id, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan)
    select nw, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan
    from workout_items where workout_id = w.id;
  end loop;
  return a;
end;
$$;
