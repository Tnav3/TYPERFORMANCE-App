-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 006 — Boxing: + Drilling (requested 9 Nov 2026)
-- Safe to run more than once.
-- =====================================================================

insert into public.session_types (discipline_id, name, sort_order)
select d.id, 'Drilling', 4 from public.disciplines d where d.name = 'Boxing'
on conflict (discipline_id, name) do update set active = true;
