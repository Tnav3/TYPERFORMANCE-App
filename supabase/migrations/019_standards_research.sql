-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 019 — Research-based standards: deadlift, chin-ups, broad jump;
-- CMJ rebased on UFC PI benchmarks.
-- New rows only fill blanks (a coach's own numbers are kept). The CMJ rows
-- are replaced only while they still hold the original 018 seed.
-- =====================================================================

insert into public.test_standards (test_key, sex, bronze, silver, gold, source) values
  ('trap_bar_3rm', 'male', 1.96, 2.43, 2.90,
   'Deadlift 1RM ÷ BW, NCAA Div I wrestlers: 191.7 ± 37.2 kg at 78.9 ± 10.6 kg (Gillingham et al. 2023, JSCR 37:909). Silver = mean ratio, Bronze/Gold = mean ∓ 1 SD of the lift ÷ mean BW. Conventional deadlift data; a trap bar usually allows a little more load, so trap bar results read slightly generous.'),
  ('trap_bar_3rm', 'female', null, null, 2.19,
   'Deadlift 1RM ÷ BW: top 30% (P70) of elite Chinese national-team female wrestlers = 2.19 (He 2013, icSPORTS). No published Bronze/Silver data for female combat athletes. Coach to set.'),
  ('chin_ups', 'male', 10, 16, 24,
   'Strict pull-ups (overhand, chin over bar): elite Japanese freestyle wrestlers 125 kg class 10.0 ± 5.4, 61 kg class 23.8 ± 1.5 (JHPS 6:33-43); cadet wrestlers 16.3 ± 8.1. Pull-up data applied to chin-ups, which are usually slightly easier.'),
  ('broad_jump', 'male', 219, 249, 279,
   'NSCA normative table for elite male athletes, 10th / 30th / 50th percentile (NSCA Essentials of S&C; original source not verified). Combat-sport means sit near Bronze: elite Colombian wrestlers 217 ± 12 cm, national MMA 219 ± 31 cm, cadet wrestlers 227 ± 21 cm.'),
  ('broad_jump', 'female', 189, 219, 249,
   'NSCA normative table for elite female athletes, 10th / 30th / 50th percentile (NSCA Essentials of S&C; original source not verified). No published broad jump data for female combat athletes found.')
on conflict (test_key, sex) do nothing;

update public.test_standards s set
  bronze = v.bronze, silver = v.silver, gold = v.gold, source = v.source, updated_at = now()
from (values
  ('male',   51.4, 55.55, 60.1,
   'UFC PI CMJ benchmarks (Cross-Sectional Analysis Vol. 2, 2021, Table 11.1): median across the 8 men''s divisions of Good / Very Good / World Class. Clients with a weight class get their own division''s tiers. Force-plate jump height.'),
  ('female', 41.45, 43.85, 47.05,
   'UFC PI CMJ benchmarks (Cross-Sectional Analysis Vol. 2, 2021, Table 11.1): median across the 4 women''s divisions of Good / Very Good / World Class. Clients with a weight class get their own division''s tiers. Force-plate jump height.')
) as v(sex, bronze, silver, gold, source)
where s.test_key = 'cmj' and s.sex = v.sex
  and ((v.sex = 'male' and s.bronze = 31 and s.silver = 36 and s.gold = 41)
    or (v.sex = 'female' and s.bronze = 22 and s.silver = 25 and s.gold = 28));

select test_key, sex, bronze, silver, gold, left(source, 50) as source
from public.test_standards order by test_key, sex;
