-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 012 — consistent Title Case test names
-- =====================================================================
update public.test_definitions t set name = v.name
from (values
  ('med_ball_throw', 'Seated Med Ball Throw'),
  ('broad_jump',     'Max Broad Jump'),
  ('triple_hop',     'Triple Hop (Each Leg)'),
  ('lateral_bound',  'Single-Leg Lateral Bound (Each Leg)'),
  ('trap_bar_3rm',   '3RM Trap Bar Deadlift'),
  ('box_squat_3rm',  '3RM Box Squat'),
  ('bench_3rm',      '3RM Bench Press'),
  ('chin_ups',       'Max Chin-Ups'),
  ('mas_5min',       '5-Minute MAS Test (Run)'),
  ('mas_bike_5min',  '5-Minute MAS Test (Assault Bike)'),
  ('mas_row_5min',   '5-Minute MAS Test (Rower)'),
  ('mas_ski_5min',   '5-Minute MAS Test (SkiErg)'),
  ('wingate_30s',    'Adapted Wingate (30 s, Assault Bike)'),
  ('cmj',            'Countermovement Jump (CMJ)'),
  ('slj',            'Single-Leg Jump'),
  ('sl_iso_squat',   'Single-Leg Isometric Squat'),
  ('imtp',           'IMTP'),
  ('plyo_pushup',    'Plyometric Push-Up'),
  ('rj_10_5',        '10-5 Repeated Jump Test')
) as v(key, name)
where t.key = v.key;
