-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 016 — Title Case lift names (only rows that differ by case,
-- so a lift the coach renamed to something else is left alone)
-- =====================================================================
update public.lifts l set name = v.name
from (values
  ('back_squat',        'Back Squat'),
  ('front_squat',       'Front Squat'),
  ('zercher_squat',     'Zercher Squat'),
  ('box_squat',         'Box Squat'),
  ('split_squat',       'Barbell Split Squat'),
  ('hip_thrust',        'Hip Thrust'),
  ('trap_bar_dl',       'Trap Bar Deadlift'),
  ('deadlift',          'Barbell Deadlift'),
  ('rdl',               'Barbell RDL'),
  ('bench',             'Bench Press'),
  ('incline_bench',     'Incline Bench Press'),
  ('ohp',               'Barbell Overhead Press'),
  ('landmine_press',    'Landmine Press'),
  ('bent_over_row',     'Barbell Bent-Over Row'),
  ('weighted_chin_up',  'Weighted Chin-Up'),
  ('weighted_pull_up',  'Weighted Pull-Up'),
  ('power_clean',       'Power Clean (Floor)'),
  ('hang_power_clean',  'Hang Power Clean'),
  ('hang_clean_pull',   'Hang Clean Pull'),
  ('hang_snatch',       'Hang Snatch'),
  ('hang_power_snatch', 'Hang Power Snatch'),
  ('trap_bar_jump',     'Trap Bar Jump'),
  ('squat_jump',        'Barbell Squat Jump'),
  ('split_squat_jump',  'Barbell Split Squat Jump'),
  ('smith_bench_throw', 'Smith Machine Bench Throw')
) as v(key, name)
where l.key = v.key and lower(l.name) = lower(v.name);
