-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 008 — Segment 5: e1RM & percentage calculator
-- =====================================================================

-- ---------- Lift catalogue (coach-editable) ----------
-- kind:   barbell     → normal e1RM from weight × reps
--         bodyweight  → formula on system mass (bodyweight + added)
--         olympic     → 1–3RM only; higher reps flagged as a rough guide (app side)
--         jump        → no own 1RM; % of the parent lift's e1RM
-- velocity_model: which research bar-speed guide applies (set here, not editable in the app)
create table public.lifts (
  key              text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  name             text not null check (length(btrim(name)) between 2 and 60),
  category         text not null check (category in ('squat', 'hinge', 'press', 'pull', 'olympic', 'jump')),
  kind             text not null check (kind in ('barbell', 'bodyweight', 'olympic', 'jump')),
  per_leg          boolean not null default false,
  parent_key       text references public.lifts(key),
  bar_weight_input boolean not null default false,
  velocity_model   text check (velocity_model in ('bench', 'squat', 'deadlift')),
  sort_order       int not null default 0,
  active           boolean not null default true,
  check ((kind = 'jump') = (parent_key is not null)),
  check (kind = 'jump' or not bar_weight_input),
  check (parent_key is null or parent_key <> key)
);

insert into public.lifts (key, name, category, kind, per_leg, velocity_model, sort_order) values
  ('back_squat',        'Back squat',               'squat',   'barbell',    false, 'squat',    10),
  ('front_squat',       'Front squat',              'squat',   'barbell',    false, null,       11),
  ('zercher_squat',     'Zercher squat',            'squat',   'barbell',    false, null,       12),
  ('box_squat',         'Box squat',                'squat',   'barbell',    false, null,       13),
  ('split_squat',       'Barbell split squat',      'squat',   'barbell',    true,  null,       14),
  ('hip_thrust',        'Hip thrust',               'squat',   'barbell',    false, null,       15),
  ('trap_bar_dl',       'Trap bar deadlift',        'hinge',   'barbell',    false, null,       20),
  ('deadlift',          'Barbell deadlift',         'hinge',   'barbell',    false, 'deadlift', 21),
  ('rdl',               'Barbell RDL',              'hinge',   'barbell',    false, null,       22),
  ('bench',             'Bench press',              'press',   'barbell',    false, 'bench',    30),
  ('incline_bench',     'Incline bench press',      'press',   'barbell',    false, null,       31),
  ('ohp',               'Barbell overhead press',   'press',   'barbell',    false, null,       32),
  ('landmine_press',    'Landmine press',           'press',   'barbell',    false, null,       33),
  ('bent_over_row',     'Barbell bent-over row',    'pull',    'barbell',    false, null,       40),
  ('weighted_chin_up',  'Weighted chin-up',         'pull',    'bodyweight', false, null,       41),
  ('weighted_pull_up',  'Weighted pull-up',         'pull',    'bodyweight', false, null,       42),
  ('power_clean',       'Power clean (floor)',      'olympic', 'olympic',    false, null,       50),
  ('hang_power_clean',  'Hang power clean',         'olympic', 'olympic',    false, null,       51),
  ('hang_clean_pull',   'Hang clean pull',          'olympic', 'olympic',    false, null,       52),
  ('hang_snatch',       'Hang snatch',              'olympic', 'olympic',    false, null,       53),
  ('hang_power_snatch', 'Hang power snatch',        'olympic', 'olympic',    false, null,       54);

insert into public.lifts (key, name, category, kind, per_leg, parent_key, bar_weight_input, sort_order) values
  ('trap_bar_jump',     'Trap bar jump',              'jump', 'jump', false, 'trap_bar_dl', false, 60),
  ('squat_jump',        'Barbell squat jump',         'jump', 'jump', false, 'back_squat',  false, 61),
  ('split_squat_jump',  'Barbell split squat jump',   'jump', 'jump', true,  'split_squat', false, 62),
  ('smith_bench_throw', 'Smith machine bench throw',  'jump', 'jump', false, 'bench',       true,  63);

-- A jump's parent must be a lift with its own 1RM (not another jump)
create or replace function public.guard_lift()
returns trigger language plpgsql
as $$
begin
  if new.parent_key is not null
     and (select kind from public.lifts where key = new.parent_key) = 'jump' then
    raise exception 'Parent lift must have its own 1RM';
  end if;
  -- velocity guides are research-specific: only set by migration, never through the app
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.velocity_model := null;
    else
      new.velocity_model := old.velocity_model;
      new.key := old.key;
      new.kind := old.kind;
    end if;
  end if;
  return new;
end;
$$;
create trigger lifts_guard before insert or update on public.lifts
  for each row execute function public.guard_lift();

alter table public.lifts enable row level security;
create policy "lifts_read" on public.lifts for select to authenticated using (true);
create policy "lifts_coach_insert" on public.lifts for insert to authenticated with check (public.is_coach());
create policy "lifts_coach_update" on public.lifts
  for update to authenticated using (public.is_coach()) with check (public.is_coach());

-- ---------- Saved e1RMs (history; newest per lift = current) ----------
create table public.lift_maxes (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  lift_key       text not null references public.lifts(key),
  load_kg        numeric(6,2) not null check (load_kg > 0 and load_kg <= 600),
  reps           int not null check (reps between 1 and 10),
  bodyweight_kg  numeric(5,2) check (bodyweight_kg is null or bodyweight_kg between 30 and 200),
  e1rm_kg        numeric(6,2) not null,
  saved_on       date not null default public.sydney_today(),
  entered_by     uuid not null default auth.uid() references public.profiles(id),
  created_at     timestamptz not null default now()
);
create index lift_maxes_athlete_idx on public.lift_maxes (athlete_id, lift_key, created_at desc);

-- e1RM is computed here so a saved value can't be typed in by hand.
-- Average of Epley and Brzycki; 1 rep = the load; nearest 0.5 kg.
-- Bodyweight lifts: on system mass (bodyweight + added); e1rm_kg stores the SYSTEM e1RM.
create or replace function public.e1rm(load numeric, reps int)
returns numeric language sql immutable
as $$
  select case when reps <= 1 then round(load * 2) / 2
    else round(((load * (1 + reps / 30.0) + load * 36.0 / (37 - reps)) / 2) * 2) / 2 end
$$;

create or replace function public.guard_lift_max()
returns trigger language plpgsql
as $$
declare k text;
begin
  select kind into k from public.lifts where key = new.lift_key;
  if k = 'jump' then
    raise exception 'Jumps use the parent lift''s 1RM';
  end if;
  if k = 'bodyweight' then
    if new.bodyweight_kg is null then
      raise exception 'Bodyweight is needed for this lift';
    end if;
    new.e1rm_kg := public.e1rm(new.load_kg + new.bodyweight_kg, new.reps);
  else
    new.bodyweight_kg := null;
    new.e1rm_kg := public.e1rm(new.load_kg, new.reps);
  end if;
  if current_user = 'authenticated' then
    new.entered_by := auth.uid();
    if new.saved_on > public.sydney_today() then
      raise exception 'Date cannot be in the future';
    end if;
  end if;
  return new;
end;
$$;
create trigger lift_maxes_guard before insert on public.lift_maxes
  for each row execute function public.guard_lift_max();

alter table public.lift_maxes enable row level security;
create policy "lift_maxes_select" on public.lift_maxes
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "lift_maxes_insert" on public.lift_maxes
  for insert to authenticated
  with check (public.is_coach() or (athlete_id = auth.uid() and public.is_active_user()));
create policy "lift_maxes_delete" on public.lift_maxes
  for delete to authenticated using (athlete_id = auth.uid() or public.is_coach());
-- No update policy: history is append-only (delete + re-save to correct).
