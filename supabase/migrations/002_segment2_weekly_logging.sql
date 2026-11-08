-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 002 — Segment 2: weekly logging (sessions + weekly check-in)
-- Run once in Supabase: SQL Editor → paste → Run (after 001)
-- =====================================================================

-- ---------- Sydney-time helpers ----------
-- The business runs on Sydney time; the database server runs on UTC.
create or replace function public.sydney_today()
returns date language sql stable
as $$ select (now() at time zone 'Australia/Sydney')::date $$;

-- Monday of the week containing d
create or replace function public.week_monday(d date)
returns date language sql immutable
as $$ select d - (extract(isodow from d)::int - 1) $$;

-- Earliest date an athlete may still log/edit: Monday 3 weeks before this week
-- (current week + 3 previous weeks).
create or replace function public.editable_from()
returns date language sql stable
as $$ select public.week_monday(public.sydney_today()) - 21 $$;

-- Lets the composite foreign key below check type ↔ discipline
alter table public.session_types
  add constraint session_types_id_discipline_key unique (id, discipline_id);

-- ---------- Training sessions ----------
create table public.training_sessions (
  id               uuid primary key default gen_random_uuid(),
  athlete_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  session_date     date not null,
  start_time       time not null,
  duration_min     int  not null check (duration_min between 5 and 360),
  discipline_id    uuid not null references public.disciplines(id),
  session_type_id  uuid not null,
  rpe              int  not null check (rpe between 1 and 10),
  notes            text check (notes is null or length(notes) <= 300),
  week_start       date generated always as (session_date - (extract(isodow from session_date)::int - 1)) stored,
  load_au          int  generated always as (rpe * duration_min) stored,   -- session RPE load (Foster)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- the session type must belong to the chosen discipline
  foreign key (session_type_id, discipline_id) references public.session_types (id, discipline_id)
);

create index training_sessions_athlete_week_idx on public.training_sessions (athlete_id, week_start);

-- ---------- Weekly check-ins ----------
create table public.weekly_checkins (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  week_start    date not null check (extract(isodow from week_start) = 1),  -- always a Monday
  wellness      int  not null check (wellness between 1 and 10),
  bodyweight_kg numeric(5,2) check (bodyweight_kg is null or bodyweight_kg between 30 and 200),
  niggle        boolean not null default false,
  niggle_note   text check (niggle_note is null or length(niggle_note) <= 300),
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (athlete_id, week_start),
  check (niggle or niggle_note is null)  -- no note without a flag
);

create index weekly_checkins_week_idx on public.weekly_checkins (week_start);

-- ---------- Edit-window guard (app users only) ----------
create or replace function public.guard_session_dates()
returns trigger language plpgsql
as $$
begin
  new.updated_at := now();
  if current_user = 'authenticated' then
    if new.athlete_id is distinct from auth.uid() then
      raise exception 'You can only log your own sessions';
    end if;
    if new.session_date > public.sydney_today() then
      raise exception 'Session date cannot be in the future';
    end if;
    if new.session_date < public.editable_from() then
      raise exception 'That week is locked (older than 4 weeks)';
    end if;
    if tg_op = 'UPDATE' and old.session_date < public.editable_from() then
      raise exception 'That week is locked (older than 4 weeks)';
    end if;
  end if;
  return new;
end;
$$;

create trigger training_sessions_guard
  before insert or update on public.training_sessions
  for each row execute function public.guard_session_dates();

create or replace function public.guard_checkin_dates()
returns trigger language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.submitted_at := old.submitted_at;  -- first submission time is kept
  end if;
  if current_user = 'authenticated' then
    if new.athlete_id is distinct from auth.uid() then
      raise exception 'You can only submit your own check-in';
    end if;
    if new.week_start > public.week_monday(public.sydney_today()) then
      raise exception 'Cannot check in for a future week';
    end if;
    if new.week_start < public.editable_from()
       or (tg_op = 'UPDATE' and old.week_start < public.editable_from()) then
      raise exception 'That week is locked (older than 4 weeks)';
    end if;
  end if;
  return new;
end;
$$;

create trigger weekly_checkins_guard
  before insert or update on public.weekly_checkins
  for each row execute function public.guard_checkin_dates();

-- ---------- Row Level Security ----------
alter table public.training_sessions enable row level security;
alter table public.weekly_checkins  enable row level security;

-- Read: your own, or coach reads everyone
create policy "sessions_select" on public.training_sessions
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "checkins_select" on public.weekly_checkins
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());

-- Write: only your own rows, only while your account is active
create policy "sessions_insert" on public.training_sessions
  for insert to authenticated with check (athlete_id = auth.uid() and public.is_active_user());
create policy "sessions_update" on public.training_sessions
  for update to authenticated
  using (athlete_id = auth.uid() and public.is_active_user())
  with check (athlete_id = auth.uid() and public.is_active_user());
create policy "sessions_delete" on public.training_sessions
  for delete to authenticated
  using (athlete_id = auth.uid() and public.is_active_user() and session_date >= public.editable_from());

create policy "checkins_insert" on public.weekly_checkins
  for insert to authenticated with check (athlete_id = auth.uid() and public.is_active_user());
create policy "checkins_update" on public.weekly_checkins
  for update to authenticated
  using (athlete_id = auth.uid() and public.is_active_user())
  with check (athlete_id = auth.uid() and public.is_active_user());
