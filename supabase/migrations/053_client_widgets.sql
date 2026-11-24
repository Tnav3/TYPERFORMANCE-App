-- Per-client widget choice (coach) and the client's home trend card.
alter table public.profiles
  add column if not exists coach_widgets text[] check (coach_widgets is null or (cardinality(coach_widgets) <= 4 and coach_widgets <@ array['volume','strength','bodyweight','compliance','readiness','sessions'])),
  add column if not exists home_trend text check (home_trend is null or home_trend in ('strength','bodyweight','volume','off'));

create or replace function public.guard_profile_coach_prefs()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and not public.is_coach() and (
       new.coach_widgets is distinct from old.coach_widgets
    or new.home_trend is distinct from old.home_trend) then
    raise exception 'Only the coach can change this';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_coach_prefs on public.profiles;
create trigger guard_profile_coach_prefs before update on public.profiles
  for each row execute function public.guard_profile_coach_prefs();
