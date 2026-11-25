-- =====================================================================
-- Migration 097 — coach reactions on logged sessions (Recent activity).
-- The coach taps 👍 🔥 💪 or 👏 on a finished session; the client gets a
-- notification. Only the coach can set or change it.
-- =====================================================================
alter table public.workout_logs
  add column if not exists coach_reaction text check (coach_reaction in ('👍', '🔥', '💪', '👏')),
  add column if not exists coach_reacted_at timestamptz;

create or replace function private.guard_log_reaction()
returns trigger language plpgsql set search_path = public
as $$
begin
  if not public.is_coach() then
    if tg_op = 'INSERT' then
      new.coach_reaction := null; new.coach_reacted_at := null;
    else
      new.coach_reaction := old.coach_reaction; new.coach_reacted_at := old.coach_reacted_at;
    end if;
  end if;
  return new;
end;
$$;
create trigger workout_logs_reaction_guard before insert or update on public.workout_logs
  for each row execute function private.guard_log_reaction();

create or replace function private.notify_log_reaction()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.coach_reaction is not null and new.coach_reaction is distinct from old.coach_reaction then
    insert into notifications (user_id, kind, title, body, url)
    select p.id, 'workout', 'Your coach reacted ' || new.coach_reaction,
           left('To your ' || coalesce((select w.title from workouts w where w.id = new.workout_id), 'session')
                || ' on ' || to_char(new.workout_date, 'Dy DD Mon') || '. Keep it up.', 200),
           case when new.workout_id is null then '/train/history' else '/train/' || new.workout_id || '/summary' end
    from profiles p where p.id = new.athlete_id and p.notify_workouts;
  end if;
  return null;
end;
$$;
create trigger workout_logs_reaction_notify after update of coach_reaction on public.workout_logs
  for each row execute function private.notify_log_reaction();

revoke execute on function private.guard_log_reaction() from public, anon, authenticated;
revoke execute on function private.notify_log_reaction() from public, anon, authenticated;
