-- =====================================================================
-- Migration 063 — more automations: birthdays, after a fight, program finished,
-- and rules that also send a check-in form (e.g. post-fight reflection).
-- =====================================================================
alter table public.profiles add column if not exists birthday date check (birthday is null or birthday between '1900-01-01' and '2100-01-01');

alter table public.automations add column if not exists form_id uuid references public.forms(id) on delete set null;
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.automations'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%missed_sessions%' loop
    execute format('alter table public.automations drop constraint %I', c);
  end loop;
end $$;
alter table public.automations add constraint automations_trigger_check check (trigger in
  ('missed_sessions', 'inactive_days', 'low_readiness', 'program_ending', 'bodyweight_gap', 'birthday', 'fight_done', 'program_complete'));
alter table public.automations alter column threshold set default 1;
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.automations'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%threshold%' loop
    execute format('alter table public.automations drop constraint %I', c);
  end loop;
end $$;
alter table public.automations add constraint automations_threshold_check check (threshold between 0 and 365);
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.automations'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%cooldown_days%' loop
    execute format('alter table public.automations drop constraint %I', c);
  end loop;
end $$;
alter table public.automations add constraint automations_cooldown_check check (cooldown_days between 1 and 366);

create or replace function private.automation_matches(a public.automations, today date)
returns table (athlete_id uuid, detail text) language sql stable set search_path = public
as $$
  with clients as (
    select p.id from profiles p where p.role = 'athlete' and p.status = 'active' and p.feat_program is not false
  ), planned as (
    select c.id athlete_id, w.id workout_id, w.workout_date
    from clients c
    join workouts w on w.workout_date between today - 60 and today + 60
      and (w.athlete_id = c.id or (w.group_id in (select group_id from group_members gm where gm.athlete_id = c.id)
           and not exists (select 1 from workouts o where o.overrides_id = w.id and o.athlete_id = c.id)))
  ), done as (
    select l.athlete_id, l.workout_id, l.workout_date from workout_logs l where l.completed_at is not null and l.workout_date >= today - 60
  )
  -- missed: planned in the last 7 days (before today) and not finished
  select p.athlete_id, count(*) || ' missed in the last 7 days'
  from planned p
  where a.trigger = 'missed_sessions' and p.workout_date between today - 7 and today - 1
    and not exists (select 1 from done d where d.workout_id = p.workout_id and d.athlete_id = p.athlete_id)
  group by p.athlete_id having count(*) >= a.threshold
  union all
  -- inactive: has a program but hasn't finished a workout in N days
  select c.id, coalesce('last workout ' || (select max(d.workout_date) from done d where d.athlete_id = c.id)::text, 'no workouts logged')
  from clients c
  where a.trigger = 'inactive_days'
    and exists (select 1 from planned p where p.athlete_id = c.id and p.workout_date between today - a.threshold and today)
    and not exists (select 1 from done d where d.athlete_id = c.id and d.workout_date > today - a.threshold)
  union all
  -- low readiness today
  select r.athlete_id, 'readiness ' || r.score
  from readiness r join clients c on c.id = r.athlete_id
  where a.trigger = 'low_readiness' and r.checked_on = today and r.score < a.threshold
  union all
  -- program ending: last planned workout is within N days and nothing after it
  select p.athlete_id, 'last workout ' || max(p.workout_date)::text
  from planned p
  where a.trigger = 'program_ending'
  group by p.athlete_id
  having max(p.workout_date) between today and today + a.threshold
  union all
  -- birthday today (29 Feb birthdays are celebrated on 28 Feb in other years)
  select p.id, 'birthday'
  from profiles p
  where a.trigger = 'birthday' and p.role = 'athlete' and p.status = 'active' and p.birthday is not null
    and (to_char(p.birthday, 'MM-DD') = to_char(today, 'MM-DD')
         or (to_char(p.birthday, 'MM-DD') = '02-29' and to_char(today, 'MM-DD') = '02-28'
             and not (extract(year from today)::int % 4 = 0 and (extract(year from today)::int % 100 <> 0 or extract(year from today)::int % 400 = 0))))
  union all
  -- N days after a fight
  select p.id, 'fought ' || coalesce(p.next_fight_date, p.second_fight_date)::text
  from profiles p
  where a.trigger = 'fight_done' and p.role = 'athlete' and p.status = 'active'
    and (p.next_fight_date = today - a.threshold or p.second_fight_date = today - a.threshold)
  union all
  -- program finished N days ago, nothing planned after it
  select p.athlete_id, 'last workout ' || max(p.workout_date)::text
  from planned p
  where a.trigger = 'program_complete'
  group by p.athlete_id
  having max(p.workout_date) = today - a.threshold
  union all
  -- no weigh-in for N days (bodyweight tracking on)
  select c.id, coalesce('last weigh-in ' || (select max(b.measured_on) from body_metrics b where b.athlete_id = c.id)::text, 'never weighed in')
  from clients c join profiles p on p.id = c.id
  where a.trigger = 'bodyweight_gap' and p.feat_bodyweight is not false
    and not exists (select 1 from body_metrics b where b.athlete_id = c.id and b.measured_on > today - a.threshold)
$$;

create or replace function public.run_automations(p_force boolean default false)
returns int language plpgsql security definer set search_path = public, private
as $$
declare a automations; m record; n int := 0; today date := public.sydney_today();
        now_syd timestamp := now() at time zone 'Australia/Sydney'; who text;
begin
  if auth.uid() is not null and not p_force then raise exception 'permission denied'; end if;
  if auth.uid() is not null and not public.is_coach() then raise exception 'Coach only'; end if;
  if not p_force and extract(hour from now_syd) < 9 then return 0; end if;
  for a in select * from automations where active loop
    for m in select * from private.automation_matches(a, today) loop
      continue when exists (select 1 from automation_runs r where r.automation_id = a.id and r.athlete_id = m.athlete_id
                            and r.ran_on > today - a.cooldown_days);
      select coalesce(nullif(split_part(full_name, ' ', 1), ''), 'there') into who from profiles where id = m.athlete_id;
      if a.audience = 'client' then
        insert into messages (athlete_id, sender_id, body) values (m.athlete_id, a.created_by, replace(a.body, '{first_name}', who));
      else
        insert into notifications (user_id, kind, title, body, url)
        select c.id, 'reminder', left(a.name, 80), left((select coalesce(full_name, 'A client') from profiles where id = m.athlete_id) || ': ' || m.detail, 200), '/coach/athlete/' || m.athlete_id
        from profiles c where c.id = a.created_by and c.status = 'active';
      end if;
      if a.form_id is not null then
        insert into form_assignments (form_id, athlete_id, repeat, starts_on, active)
        values (a.form_id, m.athlete_id, 'once', today, true)
        on conflict (form_id, athlete_id) do update set repeat = 'once', starts_on = excluded.starts_on, active = true;
      end if;
      insert into automation_runs (automation_id, athlete_id, ran_on, detail) values (a.id, m.athlete_id, today, m.detail);
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;
