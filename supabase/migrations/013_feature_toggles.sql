-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 013 — per-athlete feature switches (coach-controlled)
-- New and existing athletes start with everything on.
-- =====================================================================

alter table public.profiles
  add column if not exists feat_checkin boolean not null default true,
  add column if not exists feat_testing boolean not null default true,
  add column if not exists feat_1rm     boolean not null default true,
  add column if not exists feat_mas     boolean not null default true;

-- Only the coach can change an athlete's switches
create or replace function public.guard_profile_features()
returns trigger language plpgsql
as $$
begin
  if current_user = 'authenticated' and not public.is_coach() and (
       new.feat_checkin is distinct from old.feat_checkin
    or new.feat_testing is distinct from old.feat_testing
    or new.feat_1rm     is distinct from old.feat_1rm
    or new.feat_mas     is distinct from old.feat_mas) then
    raise exception 'Only the coach can change which features you have';
  end if;
  return new;
end;
$$;
create trigger profiles_guard_features before update on public.profiles
  for each row execute function public.guard_profile_features();

-- Saving is refused when that feature is switched off for the athlete
-- (the coach can still enter data for anyone).
-- NOT security definer: inside one, current_user is the owner and the check
-- below would never fire. Athletes can read their own profile row under RLS.
create or replace function public.require_feature()
returns trigger language plpgsql
set search_path = public
as $$
declare ok boolean;
begin
  -- Only the athlete's own saves; anything else is left to row-level security.
  if current_user = 'authenticated' and new.athlete_id = auth.uid() and not public.is_coach() then
    execute format('select %I from public.profiles where id = $1', tg_argv[0])
      into ok using new.athlete_id;
    if ok is not true then
      raise exception 'This feature is switched off for your account';
    end if;
  end if;
  return new;
end;
$$;

create trigger training_sessions_feature before insert or update on public.training_sessions
  for each row execute function public.require_feature('feat_checkin');
create trigger weekly_checkins_feature before insert or update on public.weekly_checkins
  for each row execute function public.require_feature('feat_checkin');
create trigger test_entries_feature before insert or update on public.test_entries
  for each row execute function public.require_feature('feat_testing');
create trigger lift_maxes_feature before insert on public.lift_maxes
  for each row execute function public.require_feature('feat_1rm');
