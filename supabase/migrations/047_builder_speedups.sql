-- Faster programming: default prescription per exercise, saved blocks, shift an assigned block.

-- 1. Default prescription, filled in when the exercise is added to a day
alter table public.exercises
  add column if not exists default_sets int check (default_sets between 1 and 20),
  add column if not exists default_reps text check (default_reps is null or length(btrim(default_reps)) between 1 and 20),
  add column if not exists default_load_type text check (default_load_type in ('percent', 'rpe', 'kg', 'bodyweight', 'velocity', 'none')),
  add column if not exists default_load_value numeric check (default_load_value is null or default_load_value between 0 and 600),
  add column if not exists default_rest_sec int check (default_rest_sec between 0 and 1800);

-- 2. Saved blocks (warm-ups, neck circuits, finishers) the coach can drop into any day
create table if not exists public.saved_blocks (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 2 and 60),
  items      jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  created_at timestamptz not null default now()
);
alter table public.saved_blocks enable row level security;
create policy "saved_blocks_coach" on public.saved_blocks
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- 3. Move the not-yet-done part of an assigned program by N days
create or replace function public.shift_assignment(p_assignment uuid, p_days int, p_from date)
returns int language plpgsql
set search_path = public
as $$
declare n int;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  if p_days = 0 or abs(p_days) > 365 then raise exception 'Shift must be between 1 and 365 days'; end if;
  update workouts w set workout_date = w.workout_date + p_days
  where w.assignment_id = p_assignment
    and w.workout_date >= p_from
    and not exists (select 1 from workout_logs l where l.workout_id = w.id);
  get diagnostics n = row_count;
  update assignments set start_date = start_date + p_days
  where id = p_assignment and start_date >= p_from;
  return n;
end;
$$;
revoke execute on function public.shift_assignment(uuid, int, date) from public, anon;
grant execute on function public.shift_assignment(uuid, int, date) to authenticated;
