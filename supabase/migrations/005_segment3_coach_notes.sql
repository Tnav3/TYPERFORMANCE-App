-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 005 — Segment 3: coach notes (one per athlete per week)
-- Private to the coach unless "visible_to_athlete" is switched on.
-- =====================================================================

create table public.coach_notes (
  id                  uuid primary key default gen_random_uuid(),
  athlete_id          uuid not null references public.profiles(id) on delete cascade,
  week_start          date not null check (extract(isodow from week_start) = 1),
  note                text not null check (length(trim(note)) between 1 and 2000),
  visible_to_athlete  boolean not null default false,
  created_by          uuid not null default auth.uid() references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (athlete_id, week_start)
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger coach_notes_touch before update on public.coach_notes
  for each row execute function public.touch_updated_at();

alter table public.coach_notes enable row level security;

-- Coach reads all; an athlete reads only their own notes that are shared with them
create policy "coach_notes_select" on public.coach_notes
  for select to authenticated
  using (public.is_coach() or (athlete_id = auth.uid() and visible_to_athlete));

-- Only the coach writes
create policy "coach_notes_insert" on public.coach_notes
  for insert to authenticated with check (public.is_coach());
create policy "coach_notes_update" on public.coach_notes
  for update to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "coach_notes_delete" on public.coach_notes
  for delete to authenticated using (public.is_coach());
