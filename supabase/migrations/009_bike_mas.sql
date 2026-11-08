-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 009 — 5-minute Assault Bike MAS test
-- Bike MAS = console distance ÷ 300 s (same maths as the run test).
-- Only comparable with other bike tests on the same bike model.
-- =====================================================================

-- make room right after the run test
update public.test_definitions set sort_order = sort_order + 1
  where mode = 'field' and sort_order >= 7;

-- name the run test clearly (only if the coach hasn't renamed it)
update public.test_definitions set name = '5-minute MAS test (run)'
  where key = 'mas_5min' and name = '5-minute MAS test';

insert into public.test_definitions (key, name, mode, sort_order, instructions) values
  ('mas_bike_5min', '5-minute MAS test (Assault Bike)', 'field', 7,
   E'Use the same Assault Bike model every time you test. Set the console to km.\nWarm up for 10 minutes including 2–3 short hard efforts.\nReset the console, then cover as much distance as you can in exactly 5 minutes at a hard, even pace.\nRecord the distance on the console at 5:00 in km (for example 2.45).\nBike MAS = distance ÷ 300 seconds. Compare it only with your other bike tests, not your run.')
on conflict (key) do nothing;
