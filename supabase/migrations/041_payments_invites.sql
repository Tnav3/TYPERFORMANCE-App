-- =====================================================================
-- TYPERFORMANCE App
-- Migration 041 — Segments H + I: GHL payment events, invites / pre-approval
-- =====================================================================

-- Every call from GoHighLevel is recorded (coach can audit; written by the server only)
create table public.payment_events (
  id           uuid primary key default gen_random_uuid(),
  received_at  timestamptz not null default now(),
  event        text not null,
  email        text,
  plan         text,
  result       text not null,
  raw          jsonb not null default '{}'::jsonb
);
alter table public.payment_events enable row level security;
create policy "payment_events_coach_read" on public.payment_events for select to authenticated using (public.is_coach());

-- Invites: emails the coach expects (bulk paste or a GHL payment before signup).
-- When that email signs up, their account starts approved, with the plan's features.
create table public.invites (
  email         text primary key check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  plan          text check (plan is null or plan in ('basic', 'premium')),
  auto_approve  boolean not null default true,
  note          text check (note is null or length(note) <= 200),
  created_at    timestamptz not null default now(),
  used_at       timestamptz
);
alter table public.invites enable row level security;
create policy "invites_coach" on public.invites for all to authenticated using (public.is_coach()) with check (public.is_coach());

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare inv invites;
begin
  select * into inv from invites where email = lower(new.email) and used_at is null;
  insert into public.profiles (id, email, full_name, status, feat_mealplan)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    case when inv.auto_approve then 'active'::account_status else 'pending'::account_status end,
    coalesce(inv.plan = 'premium', false)
  );
  if inv.email is not null then
    update invites set used_at = now() where email = inv.email;
  end if;
  return new;
end;
$$;
