-- =====================================================================
-- Migration 072 — coach meal plan builder (TYPERFORMANCE system)
--   meal_library: the coach's own meals with macros, ingredients (AU brands),
--     steps and a "for the family" line.
--   meal_plans: per-client plan (targets + training/rest day A/B), drafted by
--     the coach. Publishing freezes a snapshot the client reads, so later
--     library edits never change a plan they already have.
-- =====================================================================
create table public.meal_library (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 120),
  slot        text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  kcal        int  not null check (kcal between 0 and 3000),
  protein_g   numeric(5,1) not null check (protein_g between 0 and 300),
  carbs_g     numeric(5,1) not null check (carbs_g between 0 and 400),
  fat_g       numeric(5,1) not null check (fat_g between 0 and 200),
  ingredients jsonb not null default '[]',
  steps       text[] not null default '{}',
  note        text check (note is null or length(note) <= 300),
  family_note text check (family_note is null or length(family_note) <= 300),
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.meal_library enable row level security;
create policy "meal_library_coach" on public.meal_library for all to authenticated using (public.is_coach()) with check (public.is_coach());

create table public.meal_plans (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references public.profiles(id) on delete cascade,
  title        text not null check (length(btrim(title)) between 2 and 80),
  inputs       jsonb not null default '{}',
  targets      jsonb not null default '{}',
  days         jsonb not null default '{}',
  tips         text check (tips is null or length(tips) <= 4000),
  substitutes  text check (substitutes is null or length(substitutes) <= 4000),
  snapshot     jsonb,
  status       text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index meal_plans_athlete_idx on public.meal_plans (athlete_id, status, published_at desc);
alter table public.meal_plans enable row level security;
create policy "meal_plans_coach" on public.meal_plans for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "meal_plans_own_published" on public.meal_plans for select to authenticated
  using (athlete_id = auth.uid() and status = 'published' and public.is_active_user());


-- Tell the client when a plan is published
create or replace function private.notify_meal_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    insert into public.notifications (user_id, kind, title, body, url)
    values (new.athlete_id, 'announcement', 'Your meal plan is ready', left(new.title, 200), '/meal-plan');
  end if;
  return new;
end $$;
create trigger meal_plan_published after update on public.meal_plans
  for each row execute function private.notify_meal_plan();
