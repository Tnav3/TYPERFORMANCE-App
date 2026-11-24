-- =====================================================================
-- Migration 064 — "goal reached" automations
--   new_pb: a new best estimated 1RM on any exercise, logged yesterday
--   target_weight: bodyweight reached the target the coach set (cutting or gaining)
-- =====================================================================
alter table public.profiles add column if not exists target_weight_kg numeric(5,1) check (target_weight_kg is null or target_weight_kg between 30 and 250);

-- Clients can't set their own target (it's the coach's call)
create or replace function public.guard_profile_target()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and not public.is_coach() and new.target_weight_kg is distinct from old.target_weight_kg then
    raise exception 'Only the coach can set a target weight';
  end if;
  return new;
end;
$$;
create trigger guard_profile_target before update on public.profiles
  for each row execute function public.guard_profile_target();

-- Same estimate the app uses: average of Epley and Brzycki, to the nearest 0.5 kg, 1–12 reps
create or replace function public.e1rm(load numeric, reps int)
returns numeric language sql immutable as $$
  select case when reps is null or load is null or load <= 0 or reps < 1 or reps > 12 then null
              when reps = 1 then round(load * 2) / 2
              else round(((load * (1 + reps / 30.0) + (load * 36) / (37 - reps)) / 2) * 2) / 2 end
$$;

do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.automations'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%missed_sessions%' loop
    execute format('alter table public.automations drop constraint %I', c);
  end loop;
end $$;
alter table public.automations add constraint automations_trigger_check check (trigger in
  ('missed_sessions', 'inactive_days', 'low_readiness', 'program_ending', 'bodyweight_gap', 'birthday', 'fight_done', 'program_complete', 'new_pb', 'target_weight'));

-- Extra matches for the two new triggers; run_automations unions them in.
create or replace function private.automation_goal_matches(a public.automations, today date)
returns table (athlete_id uuid, detail text) language sql stable set search_path = public
as $$
  with day_best as (
    select l.athlete_id, s.exercise_id, max(public.e1rm(s.load_kg, s.reps)) best
    from set_logs s join workout_logs l on l.id = s.log_id
    where a.trigger = 'new_pb' and s.done and s.exercise_id is not null and l.workout_date = today - 1
    group by 1, 2
  ), before as (
    select l.athlete_id, s.exercise_id, max(public.e1rm(s.load_kg, s.reps)) best
    from set_logs s join workout_logs l on l.id = s.log_id
    where a.trigger = 'new_pb' and s.done and l.workout_date < today - 1
      and (l.athlete_id, s.exercise_id) in (select athlete_id, exercise_id from day_best)
    group by 1, 2
  )
  select d.athlete_id, string_agg(e.name || ' ' || d.best || ' kg', ', ' order by d.best desc)
  from day_best d
  join before b on b.athlete_id = d.athlete_id and b.exercise_id = d.exercise_id
  join exercises e on e.id = d.exercise_id
  join profiles p on p.id = d.athlete_id and p.status = 'active'
  where d.best > b.best
  group by d.athlete_id
  union all
  -- target weight: latest weigh-in reached the target, coming from the other side
  select p.id, 'weighed ' || w.weight_kg || ' kg (target ' || p.target_weight_kg || ')'
  from profiles p
  cross join lateral (select weight_kg from body_metrics b where b.athlete_id = p.id and b.weight_kg is not null order by measured_on desc limit 1) w
  cross join lateral (select weight_kg from body_metrics b where b.athlete_id = p.id and b.weight_kg is not null order by measured_on asc limit 1) f
  where a.trigger = 'target_weight' and p.status = 'active' and p.target_weight_kg is not null
    and ((f.weight_kg > p.target_weight_kg and w.weight_kg <= p.target_weight_kg)
      or (f.weight_kg < p.target_weight_kg and w.weight_kg >= p.target_weight_kg))
$$;
revoke all on function private.automation_goal_matches(public.automations, date) from public;

-- Fold the new matches into the existing matcher
alter function private.automation_matches(public.automations, date) rename to automation_base_matches;
create or replace function private.automation_matches(a public.automations, today date)
returns table (athlete_id uuid, detail text) language sql stable set search_path = public, private
as $$
  select * from private.automation_base_matches(a, today)
  union all
  select * from private.automation_goal_matches(a, today)
$$;
