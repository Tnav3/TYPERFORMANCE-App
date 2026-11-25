-- =====================================================================
-- Migration 074 — multi-coach groundwork.
--   profiles.assigned_coach: which coach looks after this client.
--   profiles.head_coach: true for the owner. Set on the first coach.
-- Access is still "any active coach sees every client" (is_coach()). Per-coach
-- access rules are a later migration, once a second coach actually joins.
-- =====================================================================
alter table public.profiles
  add column if not exists assigned_coach uuid references public.profiles(id) on delete set null,
  add column if not exists head_coach boolean not null default false;

update public.profiles set head_coach = true
where id = (select id from public.profiles where role = 'coach' order by created_at limit 1);

create or replace function public.guard_profile_assigned_coach()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and not public.is_coach()
     and (new.assigned_coach is distinct from old.assigned_coach or new.head_coach is distinct from old.head_coach) then
    raise exception 'Only a coach can change this';
  end if;
  if new.assigned_coach is not null and new.assigned_coach is distinct from old.assigned_coach
     and not exists (select 1 from public.profiles c where c.id = new.assigned_coach and c.role = 'coach') then
    raise exception 'Assigned coach must be a coach';
  end if;
  return new;
end;
$$;
create trigger guard_profile_assigned_coach before update on public.profiles
  for each row execute function public.guard_profile_assigned_coach();
