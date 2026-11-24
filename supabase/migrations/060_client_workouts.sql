-- =====================================================================
-- Migration 060 — clients add their own workouts
--   For a day with nothing programmed, or to log extra work they did.
--   They can only touch workouts they made themselves, for the last two
--   weeks up to tomorrow. The coach is told; the client isn't pinged.
-- =====================================================================
alter table public.workouts add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();

create policy "workouts_client_own" on public.workouts for all to authenticated
  using (athlete_id = auth.uid() and created_by = auth.uid() and public.is_active_user())
  with check (
    athlete_id = auth.uid() and created_by = auth.uid() and public.is_active_user()
    and assignment_id is null and overrides_id is null and group_id is null
    and workout_date between public.sydney_today() - 14 and public.sydney_today() + 1);

create policy "workout_items_client_own" on public.workout_items for all to authenticated
  using (exists (select 1 from workouts w where w.id = workout_id and w.athlete_id = auth.uid() and w.created_by = auth.uid()) and public.is_active_user())
  with check (exists (select 1 from workouts w where w.id = workout_id and w.athlete_id = auth.uid() and w.created_by = auth.uid()) and public.is_active_user());

create or replace function public.notify_one_off_workout()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.created_by is not null and new.created_by = new.athlete_id then
    -- Client made it themselves: tell the coach instead
    insert into notifications (user_id, kind, title, body, url)
    select c.id, 'workout', left(coalesce((select full_name from profiles where id = new.athlete_id), 'A client') || ' added a workout', 80),
           left(new.title || ' · ' || to_char(new.workout_date, 'Dy DD Mon'), 200), '/coach/athlete/' || new.athlete_id || '/program'
    from profiles c where c.role = 'coach' and c.status = 'active';
    return null;
  end if;
  if new.assignment_id is null and new.overrides_id is null and new.workout_date >= public.sydney_today() then
    insert into notifications (user_id, kind, title, body, url)
    select p.id, 'workout', 'New workout: ' || left(new.title, 60),
           'Scheduled for ' || to_char(new.workout_date, 'Dy DD Mon') || '.', '/train/' || new.id
    from profiles p
    where p.status = 'active' and p.notify_workouts and p.feat_program
      and (p.id = new.athlete_id or p.id in (select athlete_id from group_members where group_id = new.group_id));
  end if;
  return null;
end;
$$;
