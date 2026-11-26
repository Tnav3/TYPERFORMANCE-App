-- =====================================================================
-- 109: returning to a lift after a break.
--  * app_settings.stale_max_weeks: after this many weeks an e1RM counts as old
--    (the app shows an RPE build-up and a cautious 90% estimate instead).
--  * lift_maxes.source = 'session': an e1RM the app saved from a logged top set
--    with an RPE, when the old one was out of date. Deletable like any other.
-- =====================================================================
create table if not exists public.app_settings (
  id              boolean primary key default true check (id),
  stale_max_weeks int not null default 8 check (stale_max_weeks between 2 and 52)
);
insert into public.app_settings (id) values (true) on conflict do nothing;
alter table public.app_settings enable row level security;
drop policy if exists "app_settings_read" on public.app_settings;
create policy "app_settings_read" on public.app_settings for select to authenticated using (true);
drop policy if exists "app_settings_coach" on public.app_settings;
create policy "app_settings_coach" on public.app_settings
  for update to authenticated using (public.is_coach()) with check (public.is_coach());

alter table public.lift_maxes
  add column if not exists source text check (source is null or source = 'session');
