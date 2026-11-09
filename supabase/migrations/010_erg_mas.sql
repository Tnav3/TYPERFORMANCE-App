-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 010 — 5-minute MAS tests on the Rower and SkiErg
-- MAS = monitor distance ÷ 300 s. Each machine is only comparable with itself.
-- =====================================================================

-- make room after the Assault Bike test (sort 7)
update public.test_definitions set sort_order = sort_order + 2
  where mode = 'field' and sort_order >= 8;

insert into public.test_definitions (key, name, mode, sort_order, instructions) values
  ('mas_row_5min', '5-minute MAS test (Rower)', 'field', 8,
   E'Use a Concept2 RowErg (or the same rower model every time). Note your damper setting and use the same one every test.\nWarm up for 10 minutes including 2–3 short hard efforts.\nReset the monitor (Just Row), then cover as much distance as you can in exactly 5 minutes at a hard, even pace.\nRecord the metres on the monitor at 5:00.\nRow MAS = distance ÷ 300 seconds. Compare it only with your other rower tests.'),
  ('mas_ski_5min', '5-minute MAS test (SkiErg)', 'field', 9,
   E'Use a Concept2 SkiErg (or the same ski machine every time). Note your damper setting and use the same one every test.\nWarm up for 10 minutes including 2–3 short hard efforts.\nReset the monitor (Just Row), then cover as much distance as you can in exactly 5 minutes at a hard, even pace.\nRecord the metres on the monitor at 5:00.\nSkiErg MAS = distance ÷ 300 seconds. Compare it only with your other SkiErg tests.')
on conflict (key) do nothing;
