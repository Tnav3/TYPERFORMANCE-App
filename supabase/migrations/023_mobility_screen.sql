-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 023 — Mobility Screen (range of motion vs norms)
--   rom_measures: catalogue with the norm (a minimum) and its source
--   rom_entries:  one row per measure per day (left/right or single value)
-- Clients can enter only the self-test measures; the coach enters anything.
-- =====================================================================

alter table public.profiles
  add column if not exists feat_mobility boolean not null default true;

create or replace function public.guard_profile_features()
returns trigger language plpgsql
as $$
begin
  if current_user = 'authenticated' and not public.is_coach() and (
       new.feat_checkin  is distinct from old.feat_checkin
    or new.feat_testing  is distinct from old.feat_testing
    or new.feat_1rm      is distinct from old.feat_1rm
    or new.feat_mas      is distinct from old.feat_mas
    or new.feat_rpe      is distinct from old.feat_rpe
    or new.feat_hr       is distinct from old.feat_hr
    or new.feat_fights   is distinct from old.feat_fights
    or new.feat_mobility is distinct from old.feat_mobility) then
    raise exception 'Only the coach can change which features you have';
  end if;
  return new;
end;
$$;

create table public.rom_measures (
  key           text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  name          text not null check (length(btrim(name)) between 2 and 60),
  region        text not null check (region in ('neck', 'shoulder', 'thoracic', 'hip', 'ankle')),
  unit          text not null check (unit in ('deg', 'cm')),
  sided         boolean not null default true,
  norm          numeric(6,1),                  -- minimum; null = no published norm
  norm_text     text check (norm_text is null or length(norm_text) <= 60),
  asym_pct      numeric(4,1),                  -- flag L/R gap ≥ this % of the better side
  asym_abs      numeric(5,1),                  -- …or ≥ this many units (used instead of %)
  self_test     boolean not null default false,
  instructions  text check (instructions is null or length(instructions) <= 1500),
  source        text check (source is null or length(source) <= 500),
  sort_order    int not null default 0,
  active        boolean not null default true
);

alter table public.rom_measures enable row level security;
create policy "rom_measures_read" on public.rom_measures
  for select to authenticated using (true);
create policy "rom_measures_coach_write" on public.rom_measures
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

create table public.rom_entries (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  measure_key  text not null references public.rom_measures(key),
  measured_on  date not null default public.sydney_today(),
  left_value   numeric(5,1) check (left_value  between -90 and 360),
  right_value  numeric(5,1) check (right_value between -90 and 360),
  value        numeric(5,1) check (value       between -90 and 360),
  entered_by   uuid not null default auth.uid() references public.profiles(id),
  created_at   timestamptz not null default now(),
  check ((value is null) = (left_value is not null and right_value is not null)),
  check (value is not null or (left_value is not null and right_value is not null))
);
create index rom_entries_athlete_idx on public.rom_entries (athlete_id, measure_key, measured_on desc);

create or replace function public.guard_rom_entry()
returns trigger language plpgsql
set search_path = public
as $$
declare m public.rom_measures;
begin
  select * into m from public.rom_measures where key = new.measure_key;
  if m.sided and new.value is not null then
    raise exception '% needs a left and a right value', m.name;
  end if;
  if not m.sided and new.value is null then
    raise exception '% takes a single value', m.name;
  end if;
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.entered_by := auth.uid();
    else
      new.entered_by := old.entered_by;
      new.athlete_id := old.athlete_id;
    end if;
    if new.measured_on > public.sydney_today() then
      raise exception 'Date cannot be in the future';
    end if;
    if not public.is_coach() and not m.self_test then
      raise exception 'Only your coach can enter %', m.name;
    end if;
  end if;
  return new;
end;
$$;
create trigger rom_entries_guard before insert or update on public.rom_entries
  for each row execute function public.guard_rom_entry();
create trigger rom_entries_feature before insert or update on public.rom_entries
  for each row execute function public.require_feature('feat_mobility');

alter table public.rom_entries enable row level security;
create policy "rom_entries_select" on public.rom_entries
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "rom_entries_insert" on public.rom_entries
  for insert to authenticated
  with check (public.is_coach() or (athlete_id = auth.uid() and public.is_active_user()));
create policy "rom_entries_update" on public.rom_entries
  for update to authenticated
  using (public.is_coach() or (athlete_id = auth.uid() and entered_by = auth.uid() and public.is_active_user()))
  with check (public.is_coach() or (athlete_id = auth.uid() and public.is_active_user()));
create policy "rom_entries_delete" on public.rom_entries
  for delete to authenticated
  using (public.is_coach() or (athlete_id = auth.uid() and entered_by = auth.uid()));

-- ---------- Catalogue (norms are minimums; higher is better) ----------
insert into public.rom_measures
  (key, name, region, unit, sided, norm, norm_text, asym_pct, asym_abs, self_test, sort_order, source, instructions) values
  ('cervical_flexion', 'Neck Flexion', 'neck', 'deg', false, 45, '45–60°', null, null, false, 1,
   'Norm 45–60° (UFC Performance Institute 2021, Table 6.1). UFC fighters averaged 47° (men) and 46° (women).', null),
  ('cervical_extension', 'Neck Extension', 'neck', 'deg', false, 60, '60°', null, null, false, 2,
   'Norm 60° (UFC Performance Institute 2021, Table 6.1). UFC fighters averaged 59° (men) and 60° (women).', null),
  ('cervical_rotation', 'Neck Rotation', 'neck', 'deg', true, 80, '80°', 10, null, false, 3,
   'Norm 80° each way (UFC Performance Institute 2021, Table 6.1). UFC fighters averaged 67–69°, the most common restriction they found.', null),
  ('shoulder_flexion', 'Shoulder Flexion', 'shoulder', 'deg', true, 180, '180°', 10, null, false, 10,
   'Norm 180° (UFC Performance Institute 2021, Table 6.3). UFC fighters averaged 172–173°.', null),
  ('shoulder_abduction', 'Shoulder Abduction', 'shoulder', 'deg', true, 180, '180°', 10, null, false, 11,
   'Norm 180° (UFC Performance Institute 2021, Table 6.3). UFC fighters averaged 173–178°.', null),
  ('shoulder_ir', 'Shoulder Internal Rotation', 'shoulder', 'deg', true, 70, '70–90°', 10, null, false, 12,
   'Norm 70–90° (UFC Performance Institute 2021, Table 6.3). UFC men averaged 64–65°, women 70–72°.', null),
  ('shoulder_er', 'Shoulder External Rotation', 'shoulder', 'deg', true, 90, '90°', 10, null, false, 13,
   'Norm 90° (UFC Performance Institute 2021, Table 6.3). UFC men averaged 76–77° (often limited), women 90–93°.', null),
  ('thoracic_rotation', 'Thoracic Rotation', 'thoracic', 'deg', true, 80, '80°', 10, null, false, 20,
   'Norm 80° each way (UFC Performance Institute 2021, Table 6.1). UFC men averaged 80–81°, women 74–75°.', null),
  ('thoracic_extension', 'Thoracic Extension', 'thoracic', 'deg', false, null, 'No published norm', null, null, false, 21,
   'No agreed norm for thoracic extension in degrees; methods vary too much between studies. Tracked for change over time.', null),
  ('lumbar_locked_rotation', 'Lumbar-Locked Rotation', 'thoracic', 'deg', true, 50, '50°', 10, null, true, 22,
   'Unrestricted ≥ 50° in the lumbar-locked position (IJSPT 2024; phone clinometer apps are valid for this test, J Athl Train 2017;52:820).',
   E'You need a partner and a phone with a free clinometer (angle) app.\nKneel, then sit back onto your heels. Put one forearm flat on the floor in front of your knees and the other hand behind your head.\nTurn your chest and point the raised elbow up to the ceiling as far as you can. Keep your hips still on your heels.\nYour partner lays the phone flat across the top of your upper back, between the shoulder blades, and reads the angle.\nDo 2 tries each side and record the best in degrees.'),
  ('hip_flexion', 'Hip Flexion', 'hip', 'deg', true, 120, '120°', 10, null, false, 30,
   'Norm 120° (American Academy of Orthopaedic Surgeons goniometry norms).', null),
  ('hip_extension', 'Hip Extension', 'hip', 'deg', true, 15, '15°', 10, null, false, 31,
   'Elite-athlete norm 15° (UFC Performance Institute 2018, Table 2.1). UFC fighters averaged 11.2°, a sign of tight hip flexors.', null),
  ('hip_ir', 'Hip Internal Rotation', 'hip', 'deg', true, 45, '45°', 10, null, false, 32,
   'Norm 45° (UFC Performance Institute 2021, Table 6.4). UFC men averaged 36–37°, women 45–46°.', null),
  ('hip_er', 'Hip External Rotation', 'hip', 'deg', true, 45, '45°', 10, null, false, 33,
   'Norm 45° (UFC Performance Institute 2021, Table 6.4). UFC men averaged 61–66°, women 58–59°.', null),
  ('thomas_hip', 'Thomas Test: Thigh Angle', 'hip', 'deg', true, 0, 'At or below horizontal', null, 5, false, 34,
   'Degrees below horizontal (negative = above). Thigh above horizontal = short or stiff hip flexors (Harvey 1998, Br J Sports Med 32:68; elite athletes averaged 11.9° below). Flag at a 5° L/R gap.', null),
  ('thomas_knee', 'Thomas Test: Knee Bend', 'hip', 'deg', true, 67, '67°', 10, null, false, 35,
   'Knee angle under 67° = short or stiff quads / rectus femoris (reference values, BMC Sports Sci Med Rehabil 2021).', null),
  ('ankle_df', 'Ankle Dorsiflexion (Lunge Angle)', 'ankle', 'deg', true, 40, '40°', 10, null, false, 40,
   'Accepted range in athletes is above 40° (UFC Performance Institute 2021, Section 38). UFC fighters averaged 40–42°.', null),
  ('knee_to_wall', 'Knee-to-Wall', 'ankle', 'cm', true, 10, '10 cm', null, 2, true, 41,
   'Commonly used clinical cut-off: 10 cm or more is normal, under 4 cm is restricted, and a 2 cm L/R gap is worth checking. Each cm is about 3.6° of dorsiflexion.',
   E'Take your shoes off. Face a wall with a tape measure on the floor pointing straight at it.\nPut your big toe on the tape a few centimetres from the wall, heel flat.\nBend your knee forward to touch the wall without your heel lifting.\nIf it touches, slide the foot back 1 cm and try again. Keep going until the knee only just touches with the heel still down.\nMeasure from the wall to the tip of your big toe. Record the best for each foot in centimetres.')
on conflict (key) do nothing;

select key, region, unit, sided, norm, self_test from public.rom_measures order by sort_order;
