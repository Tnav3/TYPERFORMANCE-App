-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 025 — Nutrition Guide switch (the guide itself stores nothing)
-- =====================================================================
alter table public.profiles
  add column if not exists feat_nutrition boolean not null default true;

create or replace function public.guard_profile_features()
returns trigger language plpgsql
as $$
begin
  if current_user = 'authenticated' and not public.is_coach() and (
       new.feat_checkin   is distinct from old.feat_checkin
    or new.feat_testing   is distinct from old.feat_testing
    or new.feat_1rm       is distinct from old.feat_1rm
    or new.feat_mas       is distinct from old.feat_mas
    or new.feat_rpe       is distinct from old.feat_rpe
    or new.feat_hr        is distinct from old.feat_hr
    or new.feat_fights    is distinct from old.feat_fights
    or new.feat_mobility  is distinct from old.feat_mobility
    or new.feat_nutrition is distinct from old.feat_nutrition) then
    raise exception 'Only the coach can change which features you have';
  end if;
  return new;
end;
$$;

select count(*) as athletes_with_nutrition_on from public.profiles where feat_nutrition;
