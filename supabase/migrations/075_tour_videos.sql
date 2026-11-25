-- =====================================================================
-- Migration 075 — optional "Watch how" clip per welcome-tour step (coach-set links).
-- =====================================================================
create table public.tour_videos (
  key        text primary key check (key ~ '^[a-z_]{2,20}$'),
  url        text not null check (url ~ '^https://' and length(url) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.tour_videos enable row level security;
create policy "tour_videos_coach" on public.tour_videos for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "tour_videos_read" on public.tour_videos for select to authenticated using (true);
