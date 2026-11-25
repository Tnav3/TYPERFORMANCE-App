-- Exercise instructions now hold numbered steps plus the coach's own notes,
-- so the 1000-character cap is too tight.
alter table public.exercises drop constraint if exists exercises_cues_check;
alter table public.exercises add constraint exercises_cues_check
  check (cues is null or length(cues) <= 2000);
