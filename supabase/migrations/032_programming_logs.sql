-- =====================================================================
-- TYPERFORMANCE App
-- Migration 032 — Programming module, Segment D: workout logging + comments
-- =====================================================================

create table public.workout_logs (
  id                   uuid primary key default gen_random_uuid(),
  workout_id           uuid not null references public.workouts(id) on delete cascade,
  athlete_id           uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  workout_date         date not null,          -- copied from the workout; drives the 4-week edit lock
  completed_at         timestamptz,            -- null = started, not finished
  session_rpe          int check (session_rpe is null or session_rpe between 1 and 10),
  duration_min         int check (duration_min is null or duration_min between 5 and 360),
  comment              text check (comment is null or length(comment) <= 1000),
  coach_seen_at        timestamptz,
  training_session_id  uuid references public.training_sessions(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (workout_id, athlete_id),
  check (completed_at is null or (session_rpe is not null and duration_min is not null))
);
create index workout_logs_athlete_idx on public.workout_logs (athlete_id, workout_date);
create index workout_logs_completed_idx on public.workout_logs (completed_at desc) where completed_at is not null;

create table public.set_logs (
  id        uuid primary key default gen_random_uuid(),
  log_id    uuid not null references public.workout_logs(id) on delete cascade,
  item_id   uuid not null references public.workout_items(id) on delete cascade,
  set_no    int  not null check (set_no between 1 and 30),
  reps      int  check (reps is null or reps between 0 and 1000),
  load_kg   numeric(6,2) check (load_kg is null or load_kg between 0 and 600),
  value     numeric(8,1) check (value is null or value between 0 and 100000),  -- seconds / metres / calories
  done      boolean not null default true,
  unique (log_id, item_id, set_no)
);
create index set_logs_item_idx on public.set_logs (item_id);

-- Per-exercise (or per text block) tick and comment
create table public.item_logs (
  id       uuid primary key default gen_random_uuid(),
  log_id   uuid not null references public.workout_logs(id) on delete cascade,
  item_id  uuid not null references public.workout_items(id) on delete cascade,
  done     boolean not null default false,
  comment  text check (comment is null or length(comment) <= 500),
  unique (log_id, item_id)
);

-- ---------- Guards ----------
create or replace function public.guard_workout_log()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    select workout_date into new.workout_date from workouts where id = new.workout_id;
  else
    new.workout_id := old.workout_id;
    new.athlete_id := old.athlete_id;
    new.workout_date := old.workout_date;
  end if;
  if current_user = 'authenticated' and not public.is_coach() then
    if new.athlete_id is distinct from auth.uid() then
      raise exception 'You can only log your own workouts';
    end if;
    if not public.can_see_workout(new.workout_id) then
      raise exception 'That workout is not yours';
    end if;
    if new.workout_date > public.sydney_today() + 1 then
      raise exception 'You can''t log a workout before its day';
    end if;
    if new.workout_date < public.editable_from() then
      raise exception 'That week is locked (older than 4 weeks)';
    end if;
    new.coach_seen_at := case when tg_op = 'UPDATE' then old.coach_seen_at else null end;
  end if;
  return new;
end;
$$;
create trigger workout_logs_guard before insert or update on public.workout_logs
  for each row execute function public.guard_workout_log();
create trigger workout_logs_feature before insert or update on public.workout_logs
  for each row execute function public.require_feature('feat_program');

-- Child rows: the item must belong to the logged workout, and the log must be editable
create or replace function public.guard_log_child()
returns trigger language plpgsql
set search_path = public
as $$
declare l workout_logs;
begin
  select * into l from workout_logs where id = new.log_id;
  if not exists (select 1 from workout_items where id = new.item_id and workout_id = l.workout_id) then
    raise exception 'That exercise is not part of this workout';
  end if;
  if current_user = 'authenticated' and not public.is_coach()
     and l.workout_date < public.editable_from() then
    raise exception 'That week is locked (older than 4 weeks)';
  end if;
  return new;
end;
$$;
create trigger set_logs_guard before insert or update on public.set_logs
  for each row execute function public.guard_log_child();
create trigger item_logs_guard before insert or update on public.item_logs
  for each row execute function public.guard_log_child();

create or replace function public.owns_log(l uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.workout_logs where id = l and athlete_id = auth.uid()) $$;

alter table public.workout_logs enable row level security;
alter table public.set_logs     enable row level security;
alter table public.item_logs    enable row level security;

create policy "workout_logs_select" on public.workout_logs
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "workout_logs_insert" on public.workout_logs
  for insert to authenticated with check (athlete_id = auth.uid() and public.is_active_user());
create policy "workout_logs_update" on public.workout_logs
  for update to authenticated
  using ((athlete_id = auth.uid() and public.is_active_user()) or public.is_coach())
  with check ((athlete_id = auth.uid() and public.is_active_user()) or public.is_coach());
create policy "workout_logs_delete" on public.workout_logs
  for delete to authenticated
  using ((athlete_id = auth.uid() and workout_date >= public.editable_from()) or public.is_coach());

create policy "set_logs_select" on public.set_logs
  for select to authenticated using (public.owns_log(log_id) or public.is_coach());
create policy "set_logs_write" on public.set_logs
  for all to authenticated
  using (public.owns_log(log_id) and public.is_active_user())
  with check (public.owns_log(log_id) and public.is_active_user());
create policy "item_logs_select" on public.item_logs
  for select to authenticated using (public.owns_log(log_id) or public.is_coach());
create policy "item_logs_write" on public.item_logs
  for all to authenticated
  using (public.owns_log(log_id) and public.is_active_user())
  with check (public.owns_log(log_id) and public.is_active_user());

-- Remove an assignment: deletes its workouts from today on that nobody has logged.
-- Past and logged workouts stay so history is never lost.
create or replace function public.unassign_program(p_assignment uuid)
returns int language plpgsql
set search_path = public
as $$
declare n int;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  delete from workouts w
  where w.assignment_id = p_assignment
    and w.workout_date >= public.sydney_today()
    and not exists (select 1 from workout_logs l where l.workout_id = w.id)
    and not exists (select 1 from workout_logs l join workouts o on o.id = l.workout_id where o.overrides_id = w.id);
  get diagnostics n = row_count;
  delete from assignments a where a.id = p_assignment
    and not exists (select 1 from workouts w where w.assignment_id = a.id);
  return n;
end;
$$;
