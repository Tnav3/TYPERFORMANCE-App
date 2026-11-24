-- Referral offers: each client gets a personal sign-up link; the coach sees who referred whom.
create table if not exists public.referral_offers (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(btrim(title)) between 2 and 80),
  body       text check (body is null or length(body) <= 1000),
  reward     text check (reward is null or length(reward) <= 200),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.referral_offers enable row level security;
create policy "ref_offers_coach" on public.referral_offers for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "ref_offers_read" on public.referral_offers for select to authenticated using (active and public.is_active_user());

alter table public.profiles add column if not exists referral_code text;
update public.profiles set referral_code = substr(md5(random()::text || id::text), 1, 8) where referral_code is null;
alter table public.profiles alter column referral_code set default substr(md5(random()::text || clock_timestamp()::text), 1, 8);
create unique index if not exists profiles_referral_code_key on public.profiles (referral_code);

create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  rewarded_at timestamptz
);
alter table public.referrals enable row level security;
create policy "referrals_coach" on public.referrals for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "referrals_own" on public.referrals for select to authenticated using (referrer_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare inv invites; ref_by uuid;
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
  select id into ref_by from profiles
   where referral_code = lower(left(coalesce(new.raw_user_meta_data ->> 'ref', ''), 12)) and id <> new.id;
  if ref_by is not null then
    insert into referrals (referrer_id, referred_id) values (ref_by, new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
