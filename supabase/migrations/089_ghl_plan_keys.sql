-- =====================================================================
-- Migration 089 — GHL payments map onto the app's coaching plans.
--   invites.plan_key: the plan a paid-but-not-signed-up client gets on signup.
--   handle_new_user copies it onto the new profile.
-- =====================================================================
alter table public.invites add column if not exists plan_key text references public.coaching_plans(key) on delete set null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare inv invites; ref_by uuid;
begin
  select * into inv from invites where email = lower(new.email) and used_at is null;
  insert into public.profiles (id, email, full_name, status, feat_mealplan, plan_key)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    case when inv.auto_approve then 'active'::account_status else 'pending'::account_status end,
    coalesce(inv.plan = 'premium', false),
    inv.plan_key
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
revoke execute on function public.handle_new_user() from public, anon, authenticated;
