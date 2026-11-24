-- =====================================================================
-- TYPERFORMANCE App
-- Migration 039 — master templates + exercise substitution
-- =====================================================================
alter table public.programs add column if not exists is_master boolean not null default false;

-- Swap one exercise for another, keeping every prescription (sets, reps, %, progression).
--   p_scope 'program'    → every week/day of a program template (p_target = program id)
--   p_scope 'assignment' → a client/group's assigned workouts from p_from on (p_target = assignment id)
--   p_scope 'workout'    → one dated workout (p_target = workout id)
create or replace function public.substitute_exercise(
  p_scope text, p_target uuid, p_from uuid, p_to uuid, p_from_date date default null)
returns int language plpgsql
set search_path = public
as $$
declare n int;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  if p_from = p_to then return 0; end if;
  if not exists (select 1 from exercises where id = p_to) then raise exception 'Pick an exercise to swap in'; end if;
  if p_scope = 'program' then
    update program_items i set exercise_id = p_to
    from program_days d
    where i.day_id = d.id and d.program_id = p_target and i.exercise_id = p_from;
  elsif p_scope = 'assignment' then
    update workout_items i set exercise_id = p_to
    from workouts w
    where i.workout_id = w.id and w.assignment_id = p_target and i.exercise_id = p_from
      and w.workout_date >= coalesce(p_from_date, public.sydney_today())
      and not exists (select 1 from workout_logs l where l.workout_id = w.id);
  elsif p_scope = 'workout' then
    update workout_items set exercise_id = p_to where workout_id = p_target and exercise_id = p_from;
  else
    raise exception 'Unknown scope';
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;
