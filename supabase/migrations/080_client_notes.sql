-- =====================================================================
-- Migration 080 — clients' own notes.
--   exercise_id null  = general note (free text, several allowed)
--   exercise_id set   = setup note for that exercise (one each), shown in the logger:
--                       rack height, seat position, Keiser settings…
-- The coach can read them (helps when programming), only the client writes.
-- =====================================================================
create table public.client_notes (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  exercise_id uuid references public.exercises(id) on delete cascade,
  title       text check (title is null or length(title) <= 80),
  body        text not null check (length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index client_notes_one_per_exercise on public.client_notes (athlete_id, exercise_id) where exercise_id is not null;
create index client_notes_athlete_idx on public.client_notes (athlete_id, updated_at desc);
alter table public.client_notes enable row level security;
create policy "client_notes_own" on public.client_notes for all to authenticated
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid() and public.is_active_user());
create policy "client_notes_coach_read" on public.client_notes for select to authenticated using (public.is_coach());
