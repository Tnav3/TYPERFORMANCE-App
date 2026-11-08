-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 007 — Segment 4: testing (field tests + ForceDecks) and test videos
-- =====================================================================

-- ---------- Test definitions (coach edits video link + instructions) ----------
create table public.test_definitions (
  key          text primary key,
  name         text not null,
  mode         text not null check (mode in ('field', 'forcedecks')),
  youtube_url  text check (youtube_url is null or length(youtube_url) <= 300),
  instructions text check (instructions is null or length(instructions) <= 3000),
  sort_order   int not null default 0,
  active       boolean not null default true
);

insert into public.test_definitions (key, name, mode, sort_order, instructions) values
  ('med_ball_throw', 'Seated med ball throw', 'field', 1,
   E'Setup: sit on the floor, back flat against a wall, legs straight. Hold the ball at your chest with both hands.\nAttempts: 3 throws, 1 minute rest between.\nThrow: push the ball forward and up as hard as you can (chest pass). Back stays on the wall.\nMeasure: from the wall to where the ball first lands. Record your best throw in metres and the ball weight.'),
  ('trap_bar_3rm', '3RM trap bar deadlift', 'field', 2,
   E'Warm up with progressively heavier sets of 3–5 reps.\nAttempts: up to 4 work sets of 3, 3–4 minutes rest. Increase load only if the last set was clean.\nStandard: full lockout every rep, no bouncing between reps, same handle height every set.\nRecord: the heaviest load you completed for 3 clean reps.'),
  ('box_squat_3rm', '3RM box squat', 'field', 3,
   E'Box height: crease of the hip level with the top of the knee when seated. Use the same box every retest.\nWarm up with progressively heavier sets of 3–5 reps.\nAttempts: up to 4 work sets of 3, 3–4 minutes rest.\nStandard: sit fully on the box with control (no bounce), then stand to full lockout.\nRecord: the heaviest load you completed for 3 clean reps.'),
  ('bench_3rm', '3RM bench press', 'field', 4,
   E'Use a spotter.\nWarm up with progressively heavier sets of 3–5 reps.\nAttempts: up to 4 work sets of 3, 3–4 minutes rest.\nStandard: bar touches the chest each rep (no bounce), feet and hips stay down, full lockout.\nRecord: the heaviest load you completed for 3 clean reps.'),
  ('chin_ups', 'Max chin-ups', 'field', 5,
   E'Grip: palms facing you, shoulder width.\nStart from a dead hang, arms fully straight.\nEach rep: chin clearly over the bar, then return to a full dead hang. No kipping or swinging.\nOne set to failure. Record the number of clean reps.'),
  ('mas_5min', '5-minute MAS test', 'field', 6,
   E'Use a running track or a measured flat loop.\nWarm up for 10 minutes including a few short build-ups.\nRun as far as you can in exactly 5 minutes, at an even, hard pace.\nMeasure the total distance in metres (track laps × 400 + the extra metres).\nMAS = distance ÷ 300 seconds.'),
  ('broad_jump', 'Max broad jump', 'field', 7,
   E'Start with toes behind a line, feet hip width.\nSwing the arms and jump forward as far as possible. You must land and hold on both feet without falling back.\nAttempts: 3 jumps, 1 minute rest.\nMeasure: from the start line to the back of the closest heel. Record your best in centimetres.'),
  ('triple_hop', 'Triple hop (each leg)', 'field', 8,
   E'Stand on one leg behind a line.\nDo 3 continuous forward hops on the same leg and stick the final landing for 2 seconds.\nAttempts: 2 per leg, alternating legs, 1 minute rest.\nMeasure: start line to the back of the heel on the final landing. Record the best for each leg in centimetres.'),
  ('lateral_bound', 'Single-leg lateral bound (each leg)', 'field', 9,
   E'Stand on one leg with the inside edge of the foot on a line.\nJump sideways as far as you can, landing on the opposite leg, and stick it for 2 seconds.\nAttempts: 3 per leg, 1 minute rest.\nMeasure: from the line to the inside edge of the landing foot. Record the best for each leg in centimetres.'),
  ('cmj', 'Countermovement jump (CMJ)', 'forcedecks', 101, null),
  ('slj', 'Single leg jump', 'forcedecks', 102, null),
  ('sl_iso_squat', 'Single leg isometric squat', 'forcedecks', 103, null),
  ('imtp', 'IMTP', 'forcedecks', 104, null),
  ('plyo_pushup', 'Plyometric push-up', 'forcedecks', 105, null),
  ('rj_10_5', '10-5 repeated jump test', 'forcedecks', 106, null);

alter table public.test_definitions enable row level security;
create policy "test_defs_read" on public.test_definitions for select to authenticated using (true);
create policy "test_defs_coach_update" on public.test_definitions
  for update to authenticated using (public.is_coach()) with check (public.is_coach());

-- ---------- Test entries ----------
create table public.test_entries (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  test_key       text not null references public.test_definitions(key),
  tested_on      date not null check (tested_on >= date '2020-01-01'),
  values         jsonb not null check (jsonb_typeof(values) = 'object'),
  bodyweight_kg  numeric(5,2) check (bodyweight_kg is null or bodyweight_kg between 30 and 200),
  notes          text check (notes is null or length(notes) <= 500),
  video_path     text,
  entered_by     uuid not null default auth.uid() references public.profiles(id),
  created_at     timestamptz not null default now()
);
create index test_entries_athlete_idx on public.test_entries (athlete_id, test_key, tested_on);

create or replace function public.test_mode(k text)
returns text language sql stable security definer set search_path = public
as $$ select mode from public.test_definitions where key = k $$;

create or replace function public.guard_test_entry()
returns trigger language plpgsql
as $$
begin
  if current_user = 'authenticated' then
    new.entered_by := auth.uid();
    if new.tested_on > public.sydney_today() then
      raise exception 'Test date cannot be in the future';
    end if;
    -- Video must live in the athlete's own folder
    if new.video_path is not null and split_part(new.video_path, '/', 1) <> new.athlete_id::text then
      raise exception 'Video path must be in the athlete''s folder';
    end if;
  end if;
  return new;
end;
$$;
create trigger test_entries_guard before insert or update on public.test_entries
  for each row execute function public.guard_test_entry();

alter table public.test_entries enable row level security;

create policy "test_entries_select" on public.test_entries
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());

-- Athletes enter their own FIELD tests while active; the coach enters anything (incl. ForceDecks)
create policy "test_entries_insert" on public.test_entries
  for insert to authenticated with check (
    public.is_coach()
    or (athlete_id = auth.uid() and public.is_active_user() and public.test_mode(test_key) = 'field')
  );
create policy "test_entries_update" on public.test_entries
  for update to authenticated
  using (public.is_coach() or (athlete_id = auth.uid() and public.is_active_user() and public.test_mode(test_key) = 'field'))
  with check (public.is_coach() or (athlete_id = auth.uid() and public.is_active_user() and public.test_mode(test_key) = 'field'));
create policy "test_entries_delete" on public.test_entries
  for delete to authenticated
  using (public.is_coach() or (athlete_id = auth.uid() and public.test_mode(test_key) = 'field'));

-- ---------- Test videos (private storage bucket, one folder per athlete) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('test-videos', 'test-videos', false, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'])
on conflict (id) do nothing;

create policy "test_videos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'test-videos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user());
create policy "test_videos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'test-videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
create policy "test_videos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'test-videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
