-- =====================================================================
-- Migration 098 — Program shop (sell pre-built programs, TrainHeroic style).
--   shop_products: a program the coach sells, with price + MxP/Stripe checkout link.
--   shop_purchases: every paid order the GHL webhook receives.
--   fulfil_shop_purchase(): service-role only. Existing client → active, off hold,
--     program assigned. New email → auto-approved invite; on signup the
--     program is assigned straight away (handle_new_user).
-- =====================================================================
create table public.shop_products (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid not null references public.programs(id) on delete restrict,
  slug              text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  title             text not null check (length(btrim(title)) between 3 and 80),
  tagline           text check (tagline is null or length(tagline) <= 160),
  description       text check (description is null or length(description) <= 4000),
  price_cents       int not null check (price_cents between 0 and 10000000),
  currency          text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  billing           text not null default 'once' check (billing in ('once', 'weekly', 'monthly')),
  billing_count     int check (billing_count is null or billing_count between 1 and 104),
  checkout_url      text check (checkout_url is null or checkout_url ~ '^https://[^\s]+$'),
  match_name        text check (match_name is null or length(match_name) <= 100),
  start_rule        text not null default 'next_monday' check (start_rule in ('purchase', 'next_monday')),
  weeks             int,
  sessions_per_week int,
  active            boolean not null default false,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now()
);
create unique index shop_products_match_idx on public.shop_products (lower(match_name)) where match_name is not null;
alter table public.shop_products enable row level security;
create policy "shop_products_coach" on public.shop_products for all to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));
create policy "shop_products_public" on public.shop_products for select to anon, authenticated using (active);
create index shop_products_program_idx on public.shop_products (program_id);

create table public.shop_purchases (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.shop_products(id) on delete restrict,
  email         text not null check (email = lower(btrim(email))),
  profile_id    uuid references public.profiles(id) on delete set null,
  assignment_id uuid references public.assignments(id) on delete set null,
  status        text not null default 'pending' check (status in ('pending', 'fulfilled')),
  created_at    timestamptz not null default now(),
  fulfilled_at  timestamptz
);
alter table public.shop_purchases enable row level security;
create policy "shop_purchases_coach" on public.shop_purchases for select to authenticated using ((select public.is_coach()));
create index shop_purchases_product_idx on public.shop_purchases (product_id);
create index shop_purchases_profile_idx on public.shop_purchases (profile_id);
create index shop_purchases_assignment_idx on public.shop_purchases (assignment_id);
create index shop_purchases_pending_idx on public.shop_purchases (email) where status = 'pending';

create or replace function public.fulfil_shop_purchase(p_purchase uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare pur shop_purchases; prod shop_products; prof profiles; a uuid; d record; w uuid; start date; today date := public.sydney_today(); pname text; pinstr text; preveal boolean;
begin
  -- Server only: the GHL webhook (service role) or the signup trigger. Never a signed-in or anonymous API caller.
  if auth.uid() is not null
     or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                 nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('anon', 'authenticated') then
    raise exception 'Not allowed';
  end if;
  select * into pur from shop_purchases where id = p_purchase;
  if pur.id is null then return 'purchase not found'; end if;
  if pur.status = 'fulfilled' then return 'already fulfilled'; end if;
  select * into prod from shop_products where id = pur.product_id;
  select * into prof from profiles where lower(email) = pur.email;
  if prof.id is null then
    insert into invites (email, auto_approve, note) values (pur.email, true, left('Bought: ' || prod.title, 200))
      on conflict (email) do update set auto_approve = true, used_at = null;
    return 'invite created; program assigned when they sign up';
  end if;
  if prof.role <> 'athlete' then return 'coach account: no change'; end if;
  update profiles set status = 'active', payment_hold = false, feat_program = true where id = prof.id;
  start := case when prod.start_rule = 'purchase' then today
                when extract(isodow from today) = 1 then today
                else today + (8 - extract(isodow from today))::int end;
  select name, instructions, reveal_weekly into pname, pinstr, preveal from programs where id = prod.program_id;
  insert into assignments (program_id, program_name, instructions, reveal_weekly, athlete_id, start_date)
    values (prod.program_id, pname, pinstr, preveal, prof.id, start) returning id into a;
  for d in select * from program_days where program_id = prod.program_id order by week_no, day_no loop
    insert into workouts (athlete_id, assignment_id, workout_date, title, notes)
    values (prof.id, a, start + (d.week_no - 1) * 7 + (d.day_no - 1),
            coalesce(nullif(btrim(d.title), ''), pname || ' · W' || d.week_no || 'D' || d.day_no), d.notes)
    returning id into w;
    insert into workout_items (workout_id, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan)
    select w, position, kind, exercise_id, block, slot, sets, reps,
      load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan
    from program_items where day_id = d.id;
  end loop;
  update shop_purchases set status = 'fulfilled', fulfilled_at = now(), profile_id = prof.id, assignment_id = a where id = pur.id;
  return 'assigned from ' || to_char(start, 'DD Mon');
end;
$$;
revoke execute on function public.fulfil_shop_purchase(uuid) from public, anon, authenticated;
grant execute on function public.fulfil_shop_purchase(uuid) to service_role;

-- Signup: same as 089, then fulfil anything they already bought
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare inv invites; ref_by uuid; pur record;
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
  for pur in select id from shop_purchases where email = lower(new.email) and status = 'pending' order by created_at loop
    perform public.fulfil_shop_purchase(pur.id);
  end loop;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- The two programs that used to sell on Trainerize, ready to switch on once a checkout link is added
insert into public.shop_products (program_id, slug, title, tagline, description, price_cents, billing, billing_count, match_name, weeks, sessions_per_week, sort_order)
select p.id, v.slug, v.title, v.tagline, p.description, 1499, 'weekly', 8, v.title, p.weeks,
       (select count(*) from program_days d where d.program_id = p.id and d.week_no = 1), v.ord
from (values
  ('Power Puncher Program', 'power-puncher', 'Power Puncher Program', '3 days a week for 8 weeks: turn your strength into knockout punching power.', 1),
  ('Base Builder - Novice', 'base-builder-novice', 'Base Builder - Novice', '4 days a week for 8 weeks: build strength, power and fitness from the ground up.', 2)
) as v(pname, slug, title, tagline, ord)
join public.programs p on p.name = v.pname and not p.archived
on conflict (slug) do nothing;
