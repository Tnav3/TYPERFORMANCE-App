-- =====================================================================
-- TYPERFORMANCE App
-- Migration 042 — VBT and per-line metrics
--   velocity: target bar speed (m/s) on a line; load_type 'velocity' when it's the only target
--   fields:   per-line choice of what to record (overrides the exercise default)
--   'velocity' is also a recordable metric (m/s).
--   Copy functions redefined to carry the new columns; duplicate_program now
--   also copies instructions and the one-week-at-a-time setting.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['program_items', 'workout_items'] loop
    execute format('alter table public.%I add column if not exists velocity numeric(3,2) check (velocity is null or velocity between 0.1 and 3)', t);
    execute format('alter table public.%I add column if not exists fields text[] check (fields is null or (cardinality(fields) between 1 and 4 and fields <@ array[''reps'',''weight'',''time'',''distance'',''speed'',''watts'',''calories'',''heart_rate'',''rpe'',''height'',''velocity'']))', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_load_type_check');
    execute format('alter table public.%I add constraint %I check (load_type in (''percent'', ''rpe'', ''kg'', ''bodyweight'', ''velocity'', ''none''))', t, t || '_load_type_check');
    execute format('alter table public.%I add constraint %I check (load_type <> ''velocity'' or velocity is not null)', t, t || '_velocity_needed');
  end loop;
end $$;
alter table public.exercises drop constraint if exists exercises_fields_check;
alter table public.exercises add constraint exercises_fields_check check (
  fields is null or (cardinality(fields) between 1 and 4
    and fields <@ array['reps','weight','time','distance','speed','watts','calories','heart_rate','rpe','height','velocity']));

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
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields)
    select new_day, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields
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
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields)
    select new_day, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields
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
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields)
    select w, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields
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
    load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields)
  select w, position, kind, exercise_id, block, slot, sets, reps,
    load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields
  from workout_items where workout_id = p_workout;
  return w;
end;
$$;
