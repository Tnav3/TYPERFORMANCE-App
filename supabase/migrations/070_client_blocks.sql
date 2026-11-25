-- =====================================================================
-- Migration 070 — build and import programs straight onto a client
--   create_client_block: a named block with empty workouts on chosen
--     weekdays, already on the client's calendar (no separate "assign").
--   copy_assignment_to: import another client's block (workouts and all
--     exercises) onto this client, starting on a new date.
-- =====================================================================
create or replace function public.create_client_block(p_athlete uuid, p_name text, p_start date, p_weeks int, p_days int[])
returns uuid language plpgsql security definer set search_path = public
as $$
declare a uuid; wk int; d int; mon date;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 16 then raise exception 'Blocks are 1 to 16 weeks'; end if;
  if p_days is null or cardinality(p_days) = 0 or not (p_days <@ array[1,2,3,4,5,6,7]) then raise exception 'Pick at least one training day'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Give the block a name'; end if;
  if not exists (select 1 from profiles where id = p_athlete and role = 'athlete') then raise exception 'Client not found'; end if;
  insert into assignments (program_id, program_name, athlete_id, start_date)
  values (null, left(btrim(p_name), 60), p_athlete, p_start) returning id into a;
  mon := p_start - ((extract(isodow from p_start)::int) - 1);
  for wk in 1..p_weeks loop
    foreach d in array (select array_agg(x order by x) from unnest(p_days) x) loop
      if mon + (wk - 1) * 7 + (d - 1) >= p_start then
        insert into workouts (athlete_id, assignment_id, workout_date, title)
        values (p_athlete, a, mon + (wk - 1) * 7 + (d - 1), left(btrim(p_name), 50) || ' · W' || wk || ' ' || (array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])[d]);
      end if;
    end loop;
  end loop;
  return a;
end;
$$;
revoke execute on function public.create_client_block(uuid, text, date, int, int[]) from public, anon;
grant execute on function public.create_client_block(uuid, text, date, int, int[]) to authenticated;

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
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields)
    select nw, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields
    from workout_items where workout_id = w.id;
  end loop;
  return a;
end;
$$;
revoke execute on function public.copy_assignment_to(uuid, uuid, date) from public, anon;
grant execute on function public.copy_assignment_to(uuid, uuid, date) to authenticated;
