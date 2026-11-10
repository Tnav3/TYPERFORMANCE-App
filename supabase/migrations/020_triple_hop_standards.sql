-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 020 — Triple hop standards (weaker leg, cm). Fills blanks only.
-- Lateral bound: no published data for this protocol (land on the opposite
-- leg), so it stays blank for the coach to set.
-- =====================================================================

insert into public.test_standards (test_key, sex, bronze, silver, gold, source) values
  ('triple_hop', 'male', 540, 630, 718,
   'Single-leg triple hop for distance. Bronze = recreationally athletic men 541 ± 86 cm (Kollock et al. 2015, J Athl Train 50:14). Silver = proposed norm for collegiate basketball/soccer men, 632 cm (Myers et al. 2014, IJSPT 9:596). Gold = Silver + 1 SD of that sample (86 cm). Compared on your weaker leg; studies report either leg, so this is slightly strict.'),
  ('triple_hop', 'female', 420, 470, 559,
   'Single-leg triple hop for distance. Bronze = recreationally athletic women 418 ± 89 cm (Kollock et al. 2015, J Athl Train 50:14). Silver = proposed norm for collegiate basketball/soccer women, 470 cm (Myers et al. 2014, IJSPT 9:596). Gold = Silver + 1 SD of that sample (89 cm). Compared on your weaker leg; studies report either leg, so this is slightly strict.')
on conflict (test_key, sex) do nothing;

select test_key, sex, bronze, silver, gold from public.test_standards
where test_key in ('triple_hop', 'lateral_bound') order by test_key, sex;
