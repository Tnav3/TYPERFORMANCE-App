-- =====================================================================
-- Migration 069 — coaching plans and booking links
--   Each client is on a plan (Foundation / Performance / Elite / Hybrid,
--   1-on-1, Semi-private). A plan carries how often they get a catch-up
--   and a booking link (e.g. Calendly) shown on their home screen.
-- =====================================================================
create table public.coaching_plans (
  key          text primary key check (key ~ '^[a-z][a-z0-9_]{1,29}$'),
  name         text not null check (length(btrim(name)) between 1 and 40),
  kind         text not null default 'online' check (kind in ('online', 'in_person', 'hybrid')),
  cadence      text check (cadence is null or cadence in ('weekly', 'fortnightly', 'monthly', 'per_session')),
  booking_label text check (booking_label is null or length(booking_label) <= 60),
  booking_url  text check (booking_url is null or booking_url ~ '^https://[^\s]+$'),
  sort_order   int not null default 0,
  active       boolean not null default true
);
alter table public.coaching_plans enable row level security;
create policy "plans_read" on public.coaching_plans for select to authenticated using (true);
create policy "plans_coach" on public.coaching_plans for all to authenticated using (public.is_coach()) with check (public.is_coach());

insert into public.coaching_plans (key, name, kind, cadence, booking_label, sort_order) values
  ('foundation', 'Foundation', 'online', 'monthly', 'Book your monthly check-in call', 1),
  ('performance', 'Performance', 'online', 'fortnightly', 'Book your fortnightly check-in call', 2),
  ('elite', 'Elite', 'online', 'weekly', 'Book your weekly check-in call', 3),
  ('hybrid', 'Hybrid', 'hybrid', 'fortnightly', 'Book your fortnightly 1-on-1 session', 4),
  ('one_on_one', '1-on-1 (in person)', 'in_person', 'per_session', 'Book your next session', 5),
  ('semi_private', 'Semi-private group', 'in_person', 'per_session', 'Book your next group session', 6)
on conflict (key) do nothing;

alter table public.profiles add column if not exists plan_key text references public.coaching_plans(key) on update cascade on delete set null;

create or replace function public.guard_profile_plan()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and not public.is_coach() and new.plan_key is distinct from old.plan_key then
    raise exception 'Only the coach can change your plan';
  end if;
  return new;
end;
$$;
create trigger guard_profile_plan before update on public.profiles
  for each row execute function public.guard_profile_plan();
