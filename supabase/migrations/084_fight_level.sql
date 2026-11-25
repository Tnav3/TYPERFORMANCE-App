-- =====================================================================
-- Migration 084 — amateur or professional.
--   profiles.fight_level: what the fighter competes as now (default for new fights)
--   fights.level: each fight keeps its own level, so amateur and pro records stay separate
-- =====================================================================
alter table public.profiles add column if not exists fight_level text check (fight_level in ('amateur', 'pro'));
alter table public.fights add column if not exists level text not null default 'amateur' check (level in ('amateur', 'pro'));
