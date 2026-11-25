-- =====================================================================
-- Migration 090 — remember the card before the latest finished session, so
-- the workout summary can show "what changed" (and keeps showing it on reload).
-- =====================================================================
alter table public.player_cards add column if not exists prev jsonb;       -- {overall, tier, stats} before last_log
alter table public.player_cards add column if not exists last_log uuid;    -- workout_logs.id the change belongs to
