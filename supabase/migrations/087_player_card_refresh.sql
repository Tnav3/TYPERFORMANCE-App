-- =====================================================================
-- Migration 087 — the home player card refreshes as soon as something that
-- feeds it changes (finished session, new test, new lift max), instead of
-- waiting for the next day. It just marks the cached card stale.
-- =====================================================================
create or replace function private.stale_player_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.player_cards set updated_on = date '2000-01-01' where athlete_id = new.athlete_id;
  return null;
end $$;

drop trigger if exists player_card_on_log on public.workout_logs;
create trigger player_card_on_log
  after insert or update of completed_at on public.workout_logs
  for each row when (new.completed_at is not null)
  execute function private.stale_player_card();

drop trigger if exists player_card_on_test on public.test_entries;
create trigger player_card_on_test
  after insert or update on public.test_entries
  for each row execute function private.stale_player_card();

drop trigger if exists player_card_on_max on public.lift_maxes;
create trigger player_card_on_max
  after insert on public.lift_maxes
  for each row execute function private.stale_player_card();
