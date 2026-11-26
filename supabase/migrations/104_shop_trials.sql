-- Free trial products: a shop product with trial_days gives only the first N days of its program.
-- A "Trial ending" automation messages the client before it runs out, so they can buy the full program.
alter table public.shop_products
  add column if not exists trial_days int check (trial_days is null or trial_days between 1 and 28);

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
  -- A trial product only gives the first trial_days days of the program
  for d in select * from program_days where program_id = prod.program_id
             and (prod.trial_days is null or (week_no - 1) * 7 + day_no <= prod.trial_days)
           order by week_no, day_no loop
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
  return case when prod.trial_days is not null then 'trial ' else '' end || 'assigned from ' || to_char(start, 'DD Mon');
end;
$$;
revoke execute on function public.fulfil_shop_purchase(uuid) from public, anon, authenticated;
grant execute on function public.fulfil_shop_purchase(uuid) to service_role;

-- Automations: new "trial_ending" trigger
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.automations'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%missed_sessions%' loop
    execute format('alter table public.automations drop constraint %I', c);
  end loop;
end $$;
alter table public.automations add constraint automations_trigger_check check (trigger in
  ('missed_sessions', 'inactive_days', 'low_readiness', 'program_ending', 'bodyweight_gap', 'birthday', 'fight_done', 'program_complete', 'new_pb', 'target_weight', 'trial_ending'));

create or replace function private.automation_trial_matches(a public.automations, today date)
returns table (athlete_id uuid, detail text) language sql stable set search_path = public
as $$
  select p.profile_id, prod.title || ' ends ' || to_char(max(w.workout_date), 'DD Mon')
  from shop_purchases p
  join shop_products prod on prod.id = p.product_id and prod.trial_days is not null
  join workouts w on w.assignment_id = p.assignment_id
  where a.trigger = 'trial_ending' and p.status = 'fulfilled' and p.profile_id is not null
    -- not if they've since bought a full (non-trial) program
    and not exists (select 1 from shop_purchases q join shop_products qp on qp.id = q.product_id
                    where q.profile_id = p.profile_id and q.status = 'fulfilled' and qp.trial_days is null and q.created_at > p.created_at)
  group by p.profile_id, prod.title
  having max(w.workout_date) between today and today + a.threshold
$$;

create or replace function private.automation_matches(a public.automations, today date)
returns table (athlete_id uuid, detail text) language sql stable set search_path = public, private
as $$
  select * from private.automation_base_matches(a, today)
  union all
  select * from private.automation_goal_matches(a, today)
  union all
  select * from private.automation_trial_matches(a, today)
$$;
