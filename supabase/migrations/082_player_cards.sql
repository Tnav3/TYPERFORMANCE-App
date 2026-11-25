-- =====================================================================
-- Migration 082 — cached player card, so the client home can show a slim
-- version without recomputing every ratings source on each visit.
--   seen_overall: what the client last saw in the Trophy cabinet, so home
--   can say "Your card went up" when overall rises.
-- =====================================================================
create table if not exists public.player_cards (
  athlete_id   uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  overall      int check (overall between 0 and 99),
  tier         text not null default 'rookie' check (tier in ('rookie', 'bronze', 'silver', 'gold', 'elite')),
  stats        jsonb not null default '{}'::jsonb,
  seen_overall int check (seen_overall between 0 and 99),
  updated_on   date not null default current_date
);

alter table public.player_cards enable row level security;

drop policy if exists player_cards_own on public.player_cards;
create policy player_cards_own on public.player_cards
  for all to authenticated
  using (athlete_id = auth.uid() and public.is_active_user())
  with check (athlete_id = auth.uid() and public.is_active_user());

drop policy if exists player_cards_coach_read on public.player_cards;
create policy player_cards_coach_read on public.player_cards
  for select to authenticated
  using (public.is_coach());
