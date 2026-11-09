-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 011 — test categories (Power / Strength / Conditioning)
--                 + adapted Wingate (30 s, Assault Bike)
-- =====================================================================

alter table public.test_definitions
  add column if not exists category text
  check (category in ('power', 'strength', 'conditioning'));

insert into public.test_definitions (key, name, mode, sort_order, instructions) values
  ('wingate_30s', 'Adapted Wingate (30 s, Assault Bike)', 'field', 13,
   E'Use the same Assault Bike model every time you test. Set the console to km.\nWarm up for 10 minutes including 2–3 short hard efforts, then rest 2–3 minutes.\nStart from a slow roll. On "go", sprint all-out for 30 seconds. Don''t pace it: go as hard as you can from the first second to the last.\nAt 30 seconds, read the console and record: peak watts, average watts and distance (km).\nCool down with easy spinning for 5 minutes.\nCompare it only with your other Assault Bike Wingate tests.')
on conflict (key) do nothing;

-- Field tests grouped: Power → Strength → Conditioning
update public.test_definitions t set category = v.category, sort_order = v.sort_order
from (values
  ('med_ball_throw', 'power',        1),
  ('broad_jump',     'power',        2),
  ('triple_hop',     'power',        3),
  ('lateral_bound',  'power',        4),
  ('trap_bar_3rm',   'strength',     5),
  ('box_squat_3rm',  'strength',     6),
  ('bench_3rm',      'strength',     7),
  ('chin_ups',       'strength',     8),
  ('mas_5min',       'conditioning', 9),
  ('mas_bike_5min',  'conditioning', 10),
  ('mas_row_5min',   'conditioning', 11),
  ('mas_ski_5min',   'conditioning', 12),
  ('wingate_30s',    'conditioning', 13)
) as v(key, category, sort_order)
where t.key = v.key;
