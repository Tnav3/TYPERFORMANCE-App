-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 021 — Horizontal jump standards in metres (were cm).
-- Results are still entered in cm; the app shows metres.
-- Safe to re-run: only converts values still in cm (> 20).
-- =====================================================================
update public.test_standards set
  bronze = case when bronze > 20 then round(bronze / 100, 2) else bronze end,
  silver = case when silver > 20 then round(silver / 100, 2) else silver end,
  gold   = case when gold   > 20 then round(gold   / 100, 2) else gold   end,
  updated_at = now()
where test_key in ('broad_jump', 'triple_hop', 'lateral_bound')
  and greatest(coalesce(bronze, 0), coalesce(silver, 0), coalesce(gold, 0)) > 20;

select test_key, sex, bronze, silver, gold from public.test_standards
where test_key in ('broad_jump', 'triple_hop', 'lateral_bound') order by test_key, sex;
