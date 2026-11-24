-- =====================================================================
-- TYPERFORMANCE App
-- Migration 038 — choose what each exercise collects, and in which units
--   fields: ordered list from reps, weight, time, distance, speed, watts,
--           calories, heart_rate, rpe, height (null = default for its measure)
--   Stored canonically: weight kg (load_kg), time s, distance m, speed km/h,
--   height cm; everything except reps/weight goes in set_logs.metrics.
-- =====================================================================
alter table public.exercises
  add column if not exists fields text[] check (
    fields is null or (cardinality(fields) between 1 and 4
      and fields <@ array['reps','weight','time','distance','speed','watts','calories','heart_rate','rpe','height'])),
  add column if not exists weight_unit   text not null default 'kg'  check (weight_unit in ('kg', 'lb')),
  add column if not exists distance_unit text not null default 'm'   check (distance_unit in ('m', 'km', 'mi')),
  add column if not exists speed_unit    text not null default 'kmh' check (speed_unit in ('kmh', 'mph'));

alter table public.set_logs
  add column if not exists metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object');

-- Sensible defaults for the seeded conditioning exercises
update public.exercises set fields = '{calories,time,watts}' where name in ('Assault Bike', 'Rower', 'SkiErg') and fields is null;
update public.exercises set fields = '{distance,time,heart_rate}', distance_unit = 'km' where name in ('Run', 'Treadmill Run') and fields is null;
update public.exercises set fields = '{reps,height}' where name in ('Box Jump', 'Depth Jump') and fields is null;
