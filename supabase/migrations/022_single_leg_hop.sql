-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 022 — Single-leg hop for distance (field test) + standards.
-- Entered in cm per leg, shown in metres, standards on the weaker leg (m).
-- =====================================================================

insert into public.test_definitions (key, name, mode, sort_order, instructions, category) values
  ('single_hop', 'Single-Leg Hop (Each Leg)', 'field', 3,
   E'Stand on one leg with your toes behind a line.\nHop forward as far as you can and land on the same leg. Stick the landing for 2 seconds without the other foot touching down.\nAttempts: 2 per leg, alternating legs, 1 minute rest. Redo any attempt where you lose balance.\nMeasure: start line to the back of the heel. Record the best for each leg in centimetres.',
   'power')
on conflict (key) do nothing;

-- Keep Power tests together: shift everything from Triple Hop down by one
update public.test_definitions t set sort_order = v.sort_order
from (values
  ('med_ball_throw', 1), ('broad_jump', 2), ('single_hop', 3), ('triple_hop', 4),
  ('lateral_bound', 5), ('trap_bar_3rm', 6), ('box_squat_3rm', 7), ('bench_3rm', 8),
  ('chin_ups', 9), ('mas_5min', 10), ('mas_bike_5min', 11), ('mas_row_5min', 12),
  ('mas_ski_5min', 13), ('wingate_30s', 14)
) as v(key, sort_order)
where t.key = v.key;

insert into public.test_standards (test_key, sex, bronze, silver, gold, source) values
  ('single_hop', 'male', 1.71, 1.92, 2.18,
   'Single-leg hop for distance. Bronze = recreationally athletic men 171 ± 26 cm (Kollock et al. 2015, J Athl Train 50:14). Silver = proposed norm for collegiate basketball/soccer men, 192 cm (Myers et al. 2014, IJSPT 9:596). Gold = Silver + 1 SD of the Bronze sample (26 cm). Compared on your weaker leg; studies report either leg, so this is slightly strict.'),
  ('single_hop', 'female', 1.33, 1.49, 1.73,
   'Single-leg hop for distance. Bronze = recreationally athletic women 133 ± 24 cm (Kollock et al. 2015, J Athl Train 50:14). Silver = proposed norm for collegiate basketball/soccer women, 149 cm (Myers et al. 2014, IJSPT 9:596). Gold = Silver + 1 SD of the Bronze sample (24 cm). Compared on your weaker leg; studies report either leg, so this is slightly strict.')
on conflict (test_key, sex) do nothing;

select key, name, category, sort_order from public.test_definitions where mode = 'field' order by sort_order;
