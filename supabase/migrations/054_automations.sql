-- =====================================================================
-- Migration 054 — coach automations ("missed 2 sessions → send a message")
--   A rule = a trigger + threshold + who hears about it (client gets a chat
--   message from the coach, or the coach gets a notification).
--   Runs hourly; acts from 9am Sydney; each client is hit at most once per
--   rule per cooldown window. {first_name} is filled in.
-- =====================================================================
create table public.automations (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name          text not null check (length(btrim(name)) between 2 and 80),
  trigger       text not null check (trigger in ('missed_sessions', 'inactive_days', 'low_readiness', 'program_ending', 'bodyweight_gap')),
  threshold     int  not null check (threshold between 1 and 100),
  audience      text not null default 'client' check (audience in ('client', 'coach')),
  body          text not null check (length(btrim(body)) between 1 and 1000),
  cooldown_days int  not null default 7 check (cooldown_days between 1 and 90),
  active        boolean not null default false,
  created_at    timestamptz not null default now()
);
create table public.automation_runs (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  athlete_id    uuid not null references public.profiles(id) on delete cascade,
  ran_on        date not null default public.sydney_today(),
  detail        text,
  created_at    timestamptz not null default now()
);
create index automation_runs_lookup on public.automation_runs (automation_id, athlete_id, ran_on desc);
alter table public.automations     enable row level security;
alter table public.automation_runs enable row level security;
create policy "automations_coach"     on public.automations     for all    to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "automation_runs_coach" on public.automation_runs for select to authenticated using (public.is_coach());

-- Who matches each trigger today. Returns athlete + a short detail for the log.
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
      insert into automation_runs (automation_id, athlete_id, ran_on, detail) values (a.id, m.athlete_id, today, m.detail);
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;
revoke execute on function public.run_automations(boolean) from public, anon;
grant execute on function public.run_automations(boolean) to authenticated;
revoke all on function private.automation_matches(public.automations, date) from public;

-- Preview: who would each rule hit right now (coach only, sends nothing).
create or replace function public.automation_preview(p_id uuid)
returns table (athlete_id uuid, full_name text, detail text) language plpgsql stable security definer set search_path = public, private
as $$
declare a automations;
begin
  if not public.is_coach() then raise exception 'Coach only'; end if;
  select * into a from automations where id = p_id;
  if a.id is null then return; end if;
  return query select x.athlete_id, p.full_name, x.detail from private.automation_matches(a, public.sydney_today()) x join profiles p on p.id = x.athlete_id order by p.full_name;
end;
$$;
revoke execute on function public.automation_preview(uuid) from public, anon;
grant execute on function public.automation_preview(uuid) to authenticated;

do $$ begin
  perform cron.schedule('automations-hourly', '7 * * * *', 'select public.run_automations()');
exception when others then null;
end $$;
