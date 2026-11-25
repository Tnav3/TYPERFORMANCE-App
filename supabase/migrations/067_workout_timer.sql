-- Migration 067 — hidden workout timer (coach only)
-- A log is created at the client's first entry (first set, tick or note). We keep
-- the first time it was finished, so "first entry → finished" is the real session
-- length, whatever minutes they type in. Clients never see this.
alter table public.workout_logs add column if not exists first_completed_at timestamptz;
update public.workout_logs set first_completed_at = completed_at where completed_at is not null and first_completed_at is null;

create or replace function public.stamp_first_completion()
returns trigger language plpgsql as $$
begin
  if new.completed_at is not null and new.first_completed_at is null then
    new.first_completed_at := new.completed_at;
  end if;
  if tg_op = 'UPDATE' then new.first_completed_at := coalesce(old.first_completed_at, new.first_completed_at); end if;
  return new;
end;
$$;
create trigger stamp_first_completion before insert or update on public.workout_logs
  for each row execute function public.stamp_first_completion();
