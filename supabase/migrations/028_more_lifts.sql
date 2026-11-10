-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 028 — more lifts for the e1RM calculator; Hip Thrust → Hinge
--   Strength lifts (own 1RM from reps): staggered-stance deadlifts,
--     block pull, leg press
--   Clean pulls (Olympic rules, 1–3 reps): trap bar clean pull floor/elevated
--   Ballistic pulls (% of a parent lift's 1RM, like the loaded jumps):
--     trap bar high pull → trap bar deadlift; jump shrug → barbell deadlift
-- Skips any name the coach already added in the app.
-- =====================================================================
insert into public.lifts (key, name, category, kind, per_leg, sort_order)
select v.* from (values
  ('trap_bar_dl_staggered', 'Trap Bar Deadlift - Staggered Stance', 'hinge',   'barbell', false, 21),
  ('deadlift_staggered',    'Barbell Deadlift - Staggered Stance',  'hinge',   'barbell', false, 23),
  ('block_pull',            'Block Pull',                           'hinge',   'barbell', false, 24),
  ('leg_press',             'Leg Press',                            'squat',   'barbell', false, 16),
  ('trap_bar_clean_pull',   'Trap Bar Clean Pull (Floor)',          'olympic', 'olympic', false, 55),
  ('trap_bar_clean_pull_el','Trap Bar Clean Pull (Elevated)',       'olympic', 'olympic', false, 56)
) as v(key, name, category, kind, per_leg, sort_order)
where not exists (select 1 from public.lifts l where l.key = v.key or lower(l.name) = lower(v.name));

insert into public.lifts (key, name, category, kind, per_leg, parent_key, bar_weight_input, sort_order)
select v.* from (values
  ('trap_bar_high_pull', 'Trap Bar High Pull',  'jump', 'jump', false, 'trap_bar_dl', false, 64),
  ('jump_shrug',         'Barbell Jump Shrug',  'jump', 'jump', false, 'deadlift',    false, 65)
) as v(key, name, category, kind, per_leg, parent_key, bar_weight_input, sort_order)
where not exists (select 1 from public.lifts l where l.key = v.key or lower(l.name) = lower(v.name));

-- Hinge order: trap bar → staggered → barbell → staggered → block pull → RDL → hip thrust
update public.lifts set category = 'hinge', sort_order = 26 where key = 'hip_thrust';
update public.lifts set sort_order = 22 where key = 'deadlift';
update public.lifts set sort_order = 25 where key = 'rdl';

select category, string_agg(name, ' · ' order by sort_order) as lifts
from public.lifts where active group by category order by min(sort_order);
