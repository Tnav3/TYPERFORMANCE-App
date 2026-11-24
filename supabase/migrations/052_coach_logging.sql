-- Train together: the coach can log a client's session for them (in person).
alter table public.workout_logs add column if not exists logged_by uuid references public.profiles(id) on delete set null default auth.uid();

drop policy if exists "workout_logs_insert" on public.workout_logs;
create policy "workout_logs_insert" on public.workout_logs
  for insert to authenticated
  with check ((athlete_id = auth.uid() and public.is_active_user()) or public.is_coach());

drop policy if exists "set_logs_write" on public.set_logs;
create policy "set_logs_write" on public.set_logs
  for all to authenticated
  using ((public.owns_log(log_id) and public.is_active_user()) or public.is_coach())
  with check ((public.owns_log(log_id) and public.is_active_user()) or public.is_coach());

drop policy if exists "item_logs_write" on public.item_logs;
create policy "item_logs_write" on public.item_logs
  for all to authenticated
  using ((public.owns_log(log_id) and public.is_active_user()) or public.is_coach())
  with check ((public.owns_log(log_id) and public.is_active_user()) or public.is_coach());
