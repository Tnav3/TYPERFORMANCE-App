-- =====================================================================
-- TYPERFORMANCE App
-- Migration 036 — program instructions shown to clients, and
--   "one week at a time" (clients only see the current Mon–Sun week ahead)
-- =====================================================================
alter table public.programs
  add column if not exists instructions text check (instructions is null or length(instructions) <= 5000);
alter table public.assignments
  add column if not exists instructions text check (instructions is null or length(instructions) <= 5000);
alter table public.programs    add column if not exists reveal_weekly boolean not null default false;
alter table public.assignments add column if not exists reveal_weekly boolean not null default false;

-- assign_program now copies the instructions onto the assignment
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
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes)
    select w, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes
    from program_items where day_id = d.id;
  end loop;
  return a;
end;
$$;

-- Is this workout hidden from clients because its program shows one week at a time
-- and it falls after the current Monday–Sunday week (Sydney)?
create or replace function public.is_hidden_ahead(w public.workouts)
returns boolean language sql stable security definer set search_path = public
as $$
  select w.assignment_id is not null
     and w.workout_date > public.week_monday(public.sydney_today()) + 6
     and coalesce((select reveal_weekly from assignments where id = w.assignment_id), false)
$$;

create or replace function public.can_see_workout(w uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_coach() or exists (
    select 1 from public.workouts x
    where x.id = w and public.is_active_user()
      and (x.athlete_id = auth.uid() or (x.group_id is not null and public.is_group_member(x.group_id)))
      and not public.is_hidden_ahead(x)
  )
$$;

create or replace function public.my_workouts(p_from date, p_to date)
returns setof public.workouts language sql stable
set search_path = public
as $$
  select w.* from workouts w
  where w.workout_date between p_from and p_to
    and not public.is_hidden_ahead(w)
    and (w.athlete_id = auth.uid()
         or (w.group_id is not null and is_group_member(w.group_id)
             and not exists (select 1 from workouts o where o.overrides_id = w.id and o.athlete_id = auth.uid())))
  order by w.workout_date, w.position, w.created_at
$$;
