-- =====================================================================
-- Migration 057 — clients swap an exercise mid-workout, with a reason.
--   item_logs carries the swap; every logged set records which exercise was
--   actually done (set_logs.exercise_id), so history, PBs and e1RM follow the
--   real exercise, not the one that was programmed.
-- =====================================================================
alter table public.item_logs
  add column if not exists swap_exercise_id uuid references public.exercises(id) on delete set null,
  add column if not exists swap_reason text check (swap_reason is null or swap_reason in ('equipment', 'pain', 'too_hard', 'too_easy', 'preference', 'other')),
  add column if not exists swap_note text check (swap_note is null or length(swap_note) <= 300),
  add column if not exists swapped_at timestamptz;

alter table public.set_logs add column if not exists exercise_id uuid references public.exercises(id) on delete set null;
create index if not exists set_logs_exercise_idx on public.set_logs (exercise_id);
update public.set_logs s set exercise_id = wi.exercise_id from public.workout_items wi where wi.id = s.item_id and s.exercise_id is null;

create or replace function public.set_log_exercise()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.exercise_id := coalesce(
    (select il.swap_exercise_id from item_logs il where il.log_id = new.log_id and il.item_id = new.item_id),
    (select wi.exercise_id from workout_items wi where wi.id = new.item_id));
  return new;
end;
$$;
create trigger set_log_exercise before insert or update of item_id, log_id on public.set_logs
  for each row execute function public.set_log_exercise();

create or replace function public.item_log_swap_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.swap_exercise_id is distinct from old.swap_exercise_id then
    update set_logs s set exercise_id = coalesce(new.swap_exercise_id, (select wi.exercise_id from workout_items wi where wi.id = new.item_id))
    where s.log_id = new.log_id and s.item_id = new.item_id;
  end if;
  return null;
end;
$$;
create trigger item_log_swap_sync after insert or update of swap_exercise_id on public.item_logs
  for each row execute function public.item_log_swap_sync();
revoke execute on function public.set_log_exercise() from public, anon, authenticated;
revoke execute on function public.item_log_swap_sync() from public, anon, authenticated;
