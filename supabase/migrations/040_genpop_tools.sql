-- =====================================================================
-- TYPERFORMANCE App
-- Migration 040 — Segment G: habits, macros, progress photos, meal plan toggle
-- =====================================================================

alter table public.profiles add column if not exists feat_mealplan boolean not null default false;

create or replace function public.guard_profile_features()
returns trigger language plpgsql
as $$
begin
  if current_user = 'authenticated' and not public.is_coach() and (
       new.feat_checkin     is distinct from old.feat_checkin
    or new.feat_testing     is distinct from old.feat_testing
    or new.feat_1rm         is distinct from old.feat_1rm
    or new.feat_mas         is distinct from old.feat_mas
    or new.feat_rpe         is distinct from old.feat_rpe
    or new.feat_hr          is distinct from old.feat_hr
    or new.feat_fights      is distinct from old.feat_fights
    or new.feat_mobility    is distinct from old.feat_mobility
    or new.feat_nutrition   is distinct from old.feat_nutrition
    or new.feat_program     is distinct from old.feat_program
    or new.feat_chat        is distinct from old.feat_chat
    or new.feat_leaderboard is distinct from old.feat_leaderboard
    or new.feat_habits      is distinct from old.feat_habits
    or new.feat_macros      is distinct from old.feat_macros
    or new.feat_photos      is distinct from old.feat_photos
    or new.feat_bodyweight  is distinct from old.feat_bodyweight
    or new.feat_mealplan    is distinct from old.feat_mealplan) then
    raise exception 'Only the coach can change which features you have';
  end if;
  return new;
end;
$$;

-- ---------- Habits ----------
create table public.habits (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 80),
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create table public.habit_logs (
  habit_id    uuid not null references public.habits(id) on delete cascade,
  athlete_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  day         date not null default public.sydney_today(),
  primary key (habit_id, day)
);
create or replace function public.guard_habit_log()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from habits where id = new.habit_id and athlete_id = new.athlete_id) then
    raise exception 'That habit is not yours';
  end if;
  if current_user = 'authenticated' and not public.is_coach()
     and (new.day > public.sydney_today() or new.day < public.sydney_today() - 6) then
    raise exception 'You can tick habits for the last 7 days only';
  end if;
  return new;
end;
$$;
create trigger habit_logs_guard before insert or update on public.habit_logs
  for each row execute function public.guard_habit_log();
create trigger habit_logs_feature before insert on public.habit_logs
  for each row execute function public.require_feature('feat_habits');
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
create policy "habits_select" on public.habits for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "habits_coach" on public.habits for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "habit_logs_select" on public.habit_logs for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "habit_logs_write" on public.habit_logs for all to authenticated
  using (athlete_id = auth.uid() and public.is_active_user())
  with check (athlete_id = auth.uid() and public.is_active_user());

-- ---------- Macros ----------
create table public.macro_targets (
  athlete_id  uuid primary key references public.profiles(id) on delete cascade,
  calories    int check (calories is null or calories between 800 and 8000),
  protein_g   int check (protein_g is null or protein_g between 0 and 500),
  carbs_g     int check (carbs_g is null or carbs_g between 0 and 1200),
  fat_g       int check (fat_g is null or fat_g between 0 and 400),
  updated_at  timestamptz not null default now()
);
create table public.macro_logs (
  athlete_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  day         date not null default public.sydney_today(),
  calories    int check (calories is null or calories between 0 and 10000),
  protein_g   int check (protein_g is null or protein_g between 0 and 600),
  carbs_g     int check (carbs_g is null or carbs_g between 0 and 1500),
  fat_g       int check (fat_g is null or fat_g between 0 and 500),
  primary key (athlete_id, day)
);
create or replace function public.guard_macro_log()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and not public.is_coach()
     and (new.day > public.sydney_today() or new.day < public.sydney_today() - 6) then
    raise exception 'You can log the last 7 days only';
  end if;
  return new;
end;
$$;
create trigger macro_logs_guard before insert or update on public.macro_logs
  for each row execute function public.guard_macro_log();
create trigger macro_logs_feature before insert or update on public.macro_logs
  for each row execute function public.require_feature('feat_macros');
alter table public.macro_targets enable row level security;
alter table public.macro_logs enable row level security;
create policy "macro_targets_select" on public.macro_targets for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "macro_targets_coach" on public.macro_targets for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "macro_logs_select" on public.macro_logs for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "macro_logs_write" on public.macro_logs for all to authenticated
  using (athlete_id = auth.uid() and public.is_active_user())
  with check (athlete_id = auth.uid() and public.is_active_user());

-- ---------- Progress photos ----------
create table public.progress_photos (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  taken_on    date not null default public.sydney_today(),
  pose        text not null check (pose in ('front', 'side', 'back', 'other')),
  path        text not null,
  created_at  timestamptz not null default now(),
  check (split_part(path, '/', 1) = athlete_id::text)
);
create trigger progress_photos_feature before insert on public.progress_photos
  for each row execute function public.require_feature('feat_photos');
alter table public.progress_photos enable row level security;
create policy "photos_select" on public.progress_photos for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "photos_insert" on public.progress_photos for insert to authenticated with check (athlete_id = auth.uid() and public.is_active_user());
create policy "photos_delete" on public.progress_photos for delete to authenticated using (athlete_id = auth.uid() or public.is_coach());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;
create policy "progress_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user());
create policy "progress_photos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'progress-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
create policy "progress_photos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
