-- =====================================================================
-- TYPERFORMANCE App
-- Migration 030 — Programming module, Segment B: program templates
-- Templates are coach-only. Clients only ever see dated workouts (031).
-- =====================================================================

create table public.programs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) between 2 and 80),
  description  text check (description is null or length(description) <= 2000),
  tag          text check (tag is null or length(btrim(tag)) between 1 and 40),
  weeks        int  not null default 4 check (weeks between 1 and 52),
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger programs_touch before update on public.programs
  for each row execute function public.touch_updated_at();

create table public.program_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  week_no     int  not null check (week_no between 1 and 52),
  day_no      int  not null check (day_no between 1 and 7),
  title       text check (title is null or length(title) <= 80),
  notes       text check (notes is null or length(notes) <= 2000),
  unique (program_id, week_no, day_no)
);

-- A day can't sit past the end of its program
create or replace function public.guard_program_day()
returns trigger language plpgsql
as $$
begin
  if new.week_no > (select weeks from public.programs where id = new.program_id) then
    raise exception 'Week % is past the end of this program', new.week_no;
  end if;
  return new;
end;
$$;
create trigger program_days_guard before insert or update on public.program_days
  for each row execute function public.guard_program_day();

-- Shrinking a program removes the weeks past its new end
create or replace function public.trim_program_weeks()
returns trigger language plpgsql
as $$
begin
  if new.weeks < old.weeks then
    delete from public.program_days where program_id = new.id and week_no > new.weeks;
  end if;
  return new;
end;
$$;
create trigger programs_trim after update of weeks on public.programs
  for each row execute function public.trim_program_weeks();

-- One prescription line. The same columns are used by workout_items (031).
create table public.program_items (
  id           uuid primary key default gen_random_uuid(),
  day_id       uuid not null references public.program_days(id) on delete cascade,
  position     int  not null default 0,
  kind         text not null default 'exercise' check (kind in ('exercise', 'text')),
  exercise_id  uuid references public.exercises(id),
  block        text not null default 'A' check (block ~ '^[A-Z]$'),
  slot         int  not null default 1 check (slot between 1 and 9),
  sets         int  check (sets is null or sets between 1 and 20),
  reps         text check (reps is null or length(reps) between 1 and 20),
  load_type    text not null default 'none' check (load_type in ('percent', 'rpe', 'kg', 'bodyweight', 'none')),
  percent      numeric(5,2) check (percent is null or percent between 1 and 120),
  rpe          numeric(3,1) check (rpe is null or rpe between 1 and 10),
  load_kg      numeric(6,2) check (load_kg is null or load_kg between 0 and 600),
  tempo        text check (tempo is null or length(tempo) <= 10),
  rest_sec     int  check (rest_sec is null or rest_sec between 0 and 1800),
  title        text check (title is null or length(title) <= 80),
  notes        text check (notes is null or length(notes) <= 2000),
  check ((kind = 'exercise') = (exercise_id is not null)),
  check (kind = 'exercise' or coalesce(title, notes) is not null),
  check (load_type <> 'percent' or percent is not null),
  check (load_type <> 'rpe' or rpe is not null),
  check (load_type <> 'kg' or load_kg is not null)
);
create index program_items_day_idx on public.program_items (day_id, position);

alter table public.programs      enable row level security;
alter table public.program_days  enable row level security;
alter table public.program_items enable row level security;
create policy "programs_coach" on public.programs
  for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "program_days_coach" on public.program_days
  for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "program_items_coach" on public.program_items
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- Copy one week's days and items onto another week (replacing what's there).
create or replace function public.copy_program_week(p_program uuid, p_from int, p_to int)
returns void language plpgsql
set search_path = public
as $$
declare d record; new_day uuid;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  if p_from = p_to then return; end if;
  delete from program_days where program_id = p_program and week_no = p_to;
  for d in select * from program_days where program_id = p_program and week_no = p_from loop
    insert into program_days (program_id, week_no, day_no, title, notes)
    values (p_program, p_to, d.day_no, d.title, d.notes) returning id into new_day;
    insert into program_items (day_id, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes)
    select new_day, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes
    from program_items where day_id = d.id;
  end loop;
end;
$$;

-- Copy a week forward with a progression applied to every exercise line.
--   p_pct:  added to percent loads (e.g. 2.5)
--   p_rpe:  added to RPE targets (e.g. 0.5), capped at 10
--   p_sets: added to set counts (e.g. 1), capped at 20
--   p_kg:   added to fixed kg loads
create or replace function public.progress_program_week(
  p_program uuid, p_from int, p_to int,
  p_pct numeric default 0, p_rpe numeric default 0, p_sets int default 0, p_kg numeric default 0)
returns void language plpgsql
set search_path = public
as $$
begin
  perform public.copy_program_week(p_program, p_from, p_to);
  update program_items i set
    percent = case when i.percent is null then null else least(120, greatest(1, i.percent + p_pct)) end,
    rpe     = case when i.rpe is null then null else least(10, greatest(1, i.rpe + p_rpe)) end,
    sets    = case when i.sets is null then null else least(20, greatest(1, i.sets + p_sets)) end,
    load_kg = case when i.load_kg is null then null else least(600, greatest(0, i.load_kg + p_kg)) end
  from program_days d
  where i.day_id = d.id and d.program_id = p_program and d.week_no = p_to and i.kind = 'exercise';
end;
$$;

-- Duplicate a whole program (all weeks)
create or replace function public.duplicate_program(p_program uuid, p_name text)
returns uuid language plpgsql
set search_path = public
as $$
declare new_prog uuid; d record; new_day uuid;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  insert into programs (name, description, tag, weeks)
  select p_name, description, tag, weeks from programs where id = p_program
  returning id into new_prog;
  if new_prog is null then raise exception 'Program not found'; end if;
  for d in select * from program_days where program_id = p_program loop
    insert into program_days (program_id, week_no, day_no, title, notes)
    values (new_prog, d.week_no, d.day_no, d.title, d.notes) returning id into new_day;
    insert into program_items (day_id, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes)
    select new_day, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes
    from program_items where day_id = d.id;
  end loop;
  return new_prog;
end;
$$;
