-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 001 — Segment 1: accounts, profiles, consent, disciplines
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run
-- =====================================================================

-- ---------- Types ----------
create type public.user_role as enum ('coach', 'athlete');
create type public.account_status as enum ('pending', 'active', 'inactive');

-- ---------- Disciplines & session types (coach-editable) ----------
-- "active = false" hides an item from pickers without breaking old logs.
create table public.disciplines (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) between 1 and 60),
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.session_types (
  id             uuid primary key default gen_random_uuid(),
  discipline_id  uuid not null references public.disciplines(id) on delete cascade,
  name           text not null check (length(trim(name)) between 1 and 60),
  sort_order     int  not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (discipline_id, name)
);

-- ---------- Profiles (one row per login) ----------
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text not null,
  full_name             text,
  role                  public.user_role      not null default 'athlete',
  status                public.account_status not null default 'pending',

  -- Athlete profile (spec §4)
  main_discipline_id    uuid references public.disciplines(id),
  weight_class          text,                         -- e.g. "Lightweight"; null = not competing
  weight_class_limit_kg numeric(5,2) check (weight_class_limit_kg is null or weight_class_limit_kg between 30 and 200),
  next_fight_date       date,
  training_age_years    numeric(4,1) check (training_age_years is null or training_age_years between 0 and 60),
  profile_completed_at  timestamptz,

  -- Consent (spec §10)
  consent_version       text,
  consent_accepted_at   timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index profiles_role_status_idx on public.profiles (role, status);

-- ---------- Helper functions ----------
-- SECURITY DEFINER so they can read profiles without tripping RLS recursion.
create or replace function public.is_coach()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'coach' and status = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- ---------- New signup → profile row ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Guard rails on profile updates ----------
-- Only enforced for app users (role "authenticated"); SQL Editor / service role bypass.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  if current_user = 'authenticated' then
    -- Nobody edits id/email through the app
    if new.id is distinct from old.id or new.email is distinct from old.email then
      raise exception 'id and email cannot be changed here';
    end if;

    -- Athletes cannot change their own role or status
    if not public.is_coach() then
      if new.role is distinct from old.role or new.status is distinct from old.status then
        raise exception 'Only the coach can change role or account status';
      end if;
    end if;

    -- Coach cannot lock themselves out
    if old.id = auth.uid() and old.role = 'coach'
       and (new.role <> 'coach' or new.status <> 'active') then
      raise exception 'You cannot deactivate or demote your own coach account';
    end if;

    -- Consent and profile-completion timestamps are always server time
    if new.consent_accepted_at is distinct from old.consent_accepted_at
       and new.consent_accepted_at is not null then
      new.consent_accepted_at := now();
    end if;
    if new.profile_completed_at is distinct from old.profile_completed_at
       and new.profile_completed_at is not null then
      new.profile_completed_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------- Row Level Security ----------
alter table public.profiles       enable row level security;
alter table public.disciplines    enable row level security;
alter table public.session_types  enable row level security;

-- Profiles: you see/edit your own; the coach sees/edits everyone. No deletes (deactivate instead).
create policy "profiles_select_own_or_coach" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_coach());

create policy "profiles_update_own_or_coach" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_coach())
  with check (id = auth.uid() or public.is_coach());

-- Disciplines / session types: any logged-in user reads; only coach writes.
create policy "disciplines_read" on public.disciplines
  for select to authenticated using (true);
create policy "disciplines_coach_write" on public.disciplines
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

create policy "session_types_read" on public.session_types
  for select to authenticated using (true);
create policy "session_types_coach_write" on public.session_types
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- ---------- Seed: default disciplines & session types (spec §5) ----------
with d as (
  insert into public.disciplines (name, sort_order) values
    ('Muay Thai', 1), ('Boxing', 2), ('BJJ', 3), ('Wrestling', 4),
    ('MMA', 5), ('Kickboxing', 6), ('S&C', 7)
  returning id, name
)
insert into public.session_types (discipline_id, name, sort_order)
select d.id, t.name, t.ord
from d
join (values
  ('Muay Thai', 'Bag work', 1), ('Muay Thai', 'Pad work', 2), ('Muay Thai', 'Sparring', 3), ('Muay Thai', 'Clinch', 4),
  ('Boxing', 'Bag', 1), ('Boxing', 'Pads', 2), ('Boxing', 'Sparring', 3),
  ('BJJ', 'Drilling', 1), ('BJJ', 'Positional sparring', 2), ('BJJ', 'Rolling', 3),
  ('Wrestling', 'Drilling', 1), ('Wrestling', 'Live wrestling', 2), ('Wrestling', 'Conditioning', 3),
  ('MMA', 'Striking', 1), ('MMA', 'Grappling', 2), ('MMA', 'Sparring', 3),
  ('Kickboxing', 'Bag', 1), ('Kickboxing', 'Pads', 2), ('Kickboxing', 'Sparring', 3),
  ('S&C', 'Strength', 1), ('S&C', 'Conditioning', 2), ('S&C', 'Sprints', 3), ('S&C', 'Plyometrics', 4)
) as t(discipline, name, ord) on t.discipline = d.name;
