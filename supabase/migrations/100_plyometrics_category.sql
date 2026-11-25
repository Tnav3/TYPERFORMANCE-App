-- Jumps, bounds, hops and pogos get their own "Plyometrics" category.
-- Ballistics keeps the throws and Olympic lifts.
update public.exercise_categories set sort_order = sort_order + 1 where sort_order >= 7;
insert into public.exercise_categories (key, label, sort_order) values ('plyometric', 'Plyometrics', 7)
on conflict (key) do nothing;
insert into public.exercise_subcategories (category, key, label, sort_order) values
  ('plyometric', 'jumps', 'Jumps', 1),
  ('plyometric', 'bounds', 'Bounds & hops', 2),
  ('plyometric', 'pogos', 'Pogos', 3),
  ('plyometric', 'upper', 'Upper-body plyo', 4)
on conflict do nothing;

update public.exercises set category = 'plyometric',
  subcategory = case when name ~* 'pogo' then 'pogos' else subcategory end
where category = 'ballistic' and subcategory in ('jumps', 'bounds', 'upper');

-- Anything else in Ballistics that is plainly a jump or pogo (not a throw or a lift)
update public.exercises set category = 'plyometric',
  subcategory = case when name ~* 'pogo' then 'pogos' when name ~* '(bound|\mhop)' then 'bounds' else 'jumps' end
where category = 'ballistic' and coalesce(subcategory, '') not in ('olympic', 'throw_rot', 'throw_oh', 'throw_chest')
  and name ~* '(pogo|jump|\mhop|bound)';

delete from public.exercise_subcategories s
where s.category = 'ballistic' and s.key in ('jumps', 'bounds', 'upper')
  and not exists (select 1 from public.exercises e where e.category = 'ballistic' and e.subcategory = s.key);
