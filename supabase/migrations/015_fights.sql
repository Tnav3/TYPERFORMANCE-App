-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 015 — fight record (result + rounds) with its own switch
-- =====================================================================

alter table public.profiles
  add column if not exists feat_fights boolean not null default true;

create or replace function public.guard_profile_features()
returns trigger language plpgsql
as $$
begin
  if current_user = 'authenticated' and not public.is_coach() and (
       new.feat_checkin is distinct from old.feat_checkin
    or new.feat_testing is distinct from old.feat_testing
    or new.feat_1rm     is distinct from old.feat_1rm
    or new.feat_mas     is distinct from old.feat_mas
    or new.feat_rpe     is distinct from old.feat_rpe
    or new.feat_hr      is distinct from old.feat_hr
    or new.feat_fights  is distinct from old.feat_fights) then
    raise exception 'Only the coach can change which features you have';
  end if;
  return new;
end;
$$;

create table public.fights (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  fought_on   date not null,
  result      text not null check (result in ('win', 'loss', 'draw')),
  rounds      int  not null check (rounds between 1 and 15),
  entered_by  uuid not null default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index fights_athlete_idx on public.fights (athlete_id, fought_on desc);

create or replace function public.guard_fight()
returns trigger language plpgsql
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.entered_by := auth.uid();
    else
      new.entered_by := old.entered_by;
      new.athlete_id := old.athlete_id;
    end if;
    if new.fought_on > public.sydney_today() then
      raise exception 'Fight date cannot be in the future';
    end if;
  end if;
  return new;
end;
$$;
create trigger fights_guard before insert or update on public.fights
  for each row execute function public.guard_fight();
create trigger fights_feature before insert or update on public.fights
  for each row execute function public.require_feature('feat_fights');

alter table public.fights enable row level security;
create policy "fights_select" on public.fights
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "fights_insert" on public.fights
  for insert to authenticated
  with check (public.is_coach() or (athlete_id = auth.uid() and public.is_active_user()));
create policy "fights_update" on public.fights
  for update to authenticated
  using (public.is_coach() or (athlete_id = auth.uid() and public.is_active_user()))
  with check (public.is_coach() or (athlete_id = auth.uid() and public.is_active_user()));
create policy "fights_delete" on public.fights
  for delete to authenticated using (public.is_coach() or athlete_id = auth.uid());
