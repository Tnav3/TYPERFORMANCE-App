-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 004 — consistent session type names (8 Nov 2026)
--   "Pads" → "Pad work", "Bag" → "Bag work" (Boxing, Kickboxing)
-- Renames in place, so already-logged sessions keep their history.
-- Safe to run more than once.
-- =====================================================================

update public.session_types set name = 'Pad work' where name = 'Pads';
update public.session_types set name = 'Bag work' where name = 'Bag';
