-- =====================================================================
-- Migration 079 — two more "what the client records" fields:
--   band (tension 1 Light … 4 X-Heavy) and resistance (Keiser display value).
-- Peak power on the Keiser uses the existing "watts" field.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['program_items', 'workout_items'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_fields_check');
    execute format('alter table public.%I add constraint %I check (fields is null or (cardinality(fields) between 1 and 4 and fields <@ array[''reps'',''weight'',''time'',''distance'',''speed'',''watts'',''calories'',''heart_rate'',''rpe'',''height'',''velocity'',''band'',''resistance'']))', t, t || '_fields_check');
  end loop;
  execute 'alter table public.exercises drop constraint if exists exercises_fields_check';
  execute 'alter table public.exercises add constraint exercises_fields_check check (fields is null or (cardinality(fields) between 1 and 4 and fields <@ array[''reps'',''weight'',''time'',''distance'',''speed'',''watts'',''calories'',''heart_rate'',''rpe'',''height'',''velocity'',''band'',''resistance'']))';
end $$;

-- Sensible defaults: band exercises record reps + band; Keiser exercises record reps, resistance and peak watts.
update public.exercises set fields = array['reps','band']
where fields is null and name ~* '(mini ?band|power ?band|\mband(ed)?\M)' and name !~* '(dumbbell|barbell|kettlebell|cable)';
update public.exercises set fields = array['reps','resistance','watts'] where fields is null and name ~* 'keiser';
