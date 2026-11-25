-- =====================================================================
-- Migration 081 — record more per set, yards, smart defaults.
--   * "What the client records" now allows up to 8 fields (was 4).
--   * Distance can be shown in yards (imperial) as well as m / km / miles.
--   * New or renamed exercises with no fields picked get sensible defaults:
--       Keiser … → reps, resistance, watts (peak power)
--       mini band / power band / banded … → reps, band tension
-- =====================================================================
do $$
declare t text;
  allowed text := 'array[''reps'',''weight'',''time'',''distance'',''speed'',''watts'',''calories'',''heart_rate'',''rpe'',''height'',''velocity'',''band'',''resistance'']';
begin
  foreach t in array array['program_items', 'workout_items', 'exercises'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_fields_check');
    execute format('alter table public.%I add constraint %I check (fields is null or (cardinality(fields) between 1 and 8 and fields <@ %s))', t, t || '_fields_check', allowed);
  end loop;
  execute 'alter table public.exercises drop constraint if exists exercises_distance_unit_check';
  execute 'alter table public.exercises add constraint exercises_distance_unit_check check (distance_unit in (''m'', ''km'', ''mi'', ''yd''))';
end $$;

create or replace function private.default_exercise_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fields is null then
    if new.name ~* 'keiser' then
      new.fields := array['reps', 'resistance', 'watts'];
    elsif new.name ~* '(mini ?band|power ?band|\mband(ed)?\M)' and new.name !~* '(dumbbell|barbell|kettlebell|cable)' then
      new.fields := array['reps', 'band'];
    end if;
  end if;
  return new;
end $$;

drop trigger if exists exercises_default_fields on public.exercises;
create trigger exercises_default_fields
  before insert or update of name on public.exercises
  for each row execute function private.default_exercise_fields();
