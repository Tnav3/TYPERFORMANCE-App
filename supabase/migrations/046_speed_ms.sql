-- Speed can be shown in m/s (now the default). Stored value stays km/h.
alter table public.exercises drop constraint if exists exercises_speed_unit_check;
alter table public.exercises
  add constraint exercises_speed_unit_check check (speed_unit in ('ms', 'kmh', 'mph'));
alter table public.exercises alter column speed_unit set default 'ms';
update public.exercises set speed_unit = 'ms' where speed_unit = 'kmh';
