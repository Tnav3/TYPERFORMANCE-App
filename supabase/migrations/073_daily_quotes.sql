-- =====================================================================
-- Migration 073 — daily quotes on client Home, written by the coach.
-- One per day for everyone (picked by date), coach can add, edit, switch off.
-- =====================================================================
create table public.quotes (
  id         uuid primary key default gen_random_uuid(),
  body       text not null check (length(btrim(body)) between 5 and 240),
  author     text check (author is null or length(author) <= 80),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.quotes enable row level security;
create policy "quotes_coach" on public.quotes for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "quotes_read" on public.quotes for select to authenticated using (active and public.is_active_user());

insert into public.quotes (body, author) values
  ('Show up on the days you don''t feel like it. That''s where the work counts.', 'TYPERFORMANCE'),
  ('Strong is a skill. Practise it.', 'TYPERFORMANCE'),
  ('Train like the fight is tomorrow. Recover like it''s next month.', 'TYPERFORMANCE'),
  ('Small sessions, done often, beat big sessions done once.', 'TYPERFORMANCE'),
  ('Your conditioning is built on the boring days.', 'TYPERFORMANCE'),
  ('Sleep is the cheapest performance enhancer there is.', 'TYPERFORMANCE'),
  ('Move well first. Then move heavy. Then move fast.', 'TYPERFORMANCE');
