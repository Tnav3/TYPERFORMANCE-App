-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 024 — MAS (run) standards for men. Fills blanks only.
-- No published 5-minute MAS norms found for women, or for the Assault Bike,
-- rower or SkiErg; those stay blank for the coach to set.
-- =====================================================================
insert into public.test_standards (test_key, sex, bronze, silver, gold, source) values
  ('mas_5min', 'male', 4.40, 4.60, 4.80,
   'Field-sport athletes typically reach 4.4–4.8 m/s and elite field-sport athletes 4.8 m/s or more (Baker & Heaney 2015, J Aust Strength Cond 23:60, as summarised by Topend Sports). Silver = midpoint. A 5-minute run reads about 0.45 m/s lower than a lab treadmill test (Bennett et al. 2024, PLoS One), so these are slightly harsh.')
on conflict (test_key, sex) do nothing;

select test_key, sex, bronze, silver, gold from public.test_standards where test_key like 'mas%';
