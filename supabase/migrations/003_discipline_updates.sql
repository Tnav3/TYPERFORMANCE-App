-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 003 — session type changes requested 8 Nov 2026
--   MMA:                + Pad work, + Drilling
--   Muay Thai:          + Drilling
--   Kickboxing:         + Drilling
--   S&C:                Strength, Conditioning, Running, Sprints
--                       (+ Running; Plyometrics removed — hidden instead if already used)
-- Safe to run more than once.
-- =====================================================================

insert into public.session_types (discipline_id, name, sort_order)
select d.id, v.name, v.ord
from (values
  ('MMA', 'Pad work', 4),
  ('MMA', 'Drilling', 5),
  ('Muay Thai', 'Drilling', 5),
  ('Kickboxing', 'Drilling', 4),
  ('S&C', 'Running', 3)
) as v(discipline, name, ord)
join public.disciplines d on d.name = v.discipline
on conflict (discipline_id, name) do update set active = true, sort_order = excluded.sort_order;

-- S&C order: Strength, Conditioning, Running, Sprints
update public.session_types s set sort_order = v.ord, active = true
from public.disciplines d, (values ('Strength', 1), ('Conditioning', 2), ('Running', 3), ('Sprints', 4)) as v(name, ord)
where s.discipline_id = d.id and d.name = 'S&C' and s.name = v.name;

-- Plyometrics: delete if never logged, otherwise hide (keeps old sessions intact)
delete from public.session_types s
using public.disciplines d
where s.discipline_id = d.id and d.name = 'S&C' and s.name = 'Plyometrics'
  and not exists (select 1 from public.training_sessions t where t.session_type_id = s.id);

update public.session_types s set active = false
from public.disciplines d
where s.discipline_id = d.id and d.name = 'S&C' and s.name = 'Plyometrics';
