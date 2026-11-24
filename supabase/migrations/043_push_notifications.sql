-- =====================================================================
-- TYPERFORMANCE App
-- Migration 043 — Segment M: mobile push notifications (+ helper hardening)
--   Database writes an outbox row → pings the app (pg_net) → the app sends Web Push.
--   A once-a-minute job retries anything not yet sent and queues daily reminders.
-- =====================================================================

-- ---------- Client preferences ----------
alter table public.profiles
  add column if not exists notify_messages boolean not null default true,
  add column if not exists notify_workouts boolean not null default true,
  add column if not exists workout_reminder_time time,
  add column if not exists habit_reminder_time time,
  add column if not exists reminders_sent_on date;

-- ---------- Device subscriptions ----------
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh      text not null check (length(p256dh) <= 200),
  auth        text not null check (length(auth) <= 100),
  user_agent  text check (user_agent is null or length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "push_own" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Outbox ----------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('message', 'workout', 'reminder', 'habit', 'announcement')),
  title       text not null check (length(title) <= 80),
  body        text not null check (length(body) <= 200),
  url         text not null default '/' check (url ~ '^/' and length(url) <= 200),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  attempts    int not null default 0,
  error       text
);
create index notifications_unsent_idx on public.notifications (created_at) where sent_at is null;
alter table public.notifications enable row level security;
create policy "notifications_own_read" on public.notifications for select to authenticated using (user_id = auth.uid());

-- App URL + shared secret for the database → app ping (not exposed through the API)
create schema if not exists private;
create table if not exists private.settings (key text primary key, value text not null);
revoke all on schema private from public, anon, authenticated;

create or replace function public.ping_push_dispatch()
returns void language plpgsql security definer set search_path = public, private
as $$
declare u text; s text;
begin
  select value into u from private.settings where key = 'app_url';
  select value into s from private.settings where key = 'push_secret';
  if u is null or s is null then return; end if;
  begin
    perform net.http_post(
      url := u || '/api/push/dispatch',
      headers := jsonb_build_object('content-type', 'application/json', 'x-typ-secret', s),
      body := '{}'::jsonb);
  exception when others then null;  -- pg_net missing: the minute job retries
  end;
end;
$$;
revoke execute on function public.ping_push_dispatch() from public, anon, authenticated;

create or replace function public.notification_created()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.ping_push_dispatch();
  return null;
end;
$$;
create trigger notifications_ping after insert on public.notifications
  for each statement execute function public.notification_created();

-- New chat message → notify the other side
create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = public
as $$
declare sender profiles; preview text;
begin
  select * into sender from profiles where id = new.sender_id;
  preview := left(regexp_replace(new.body, '\s+', ' ', 'g'), 140);
  if sender.role = 'coach' then
    insert into notifications (user_id, kind, title, body, url)
    select p.id, case when new.announcement then 'announcement' else 'message' end,
           case when new.announcement then 'Announcement' else 'Message from your coach' end, preview, '/chat'
    from profiles p where p.id = new.athlete_id and p.notify_messages and p.status = 'active';
  else
    insert into notifications (user_id, kind, title, body, url)
    select c.id, 'message', coalesce(sender.full_name, 'Client') || ' sent a message', preview, '/coach/chat/' || new.athlete_id
    from profiles c where c.role = 'coach' and c.status = 'active' and c.notify_messages;
  end if;
  return null;
end;
$$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_message();

-- New program assigned → notify the client(s)
create or replace function public.notify_assignment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into notifications (user_id, kind, title, body, url)
  select p.id, 'workout', 'New program: ' || left(new.program_name, 60),
         'Starts ' || to_char(new.start_date, 'Dy DD Mon') || '. Open the app to see it.', '/train'
  from profiles p
  where p.status = 'active' and p.notify_workouts and p.feat_program
    and (p.id = new.athlete_id or p.id in (select athlete_id from group_members where group_id = new.group_id));
  return null;
end;
$$;
create trigger assignments_notify after insert on public.assignments
  for each row execute function public.notify_assignment();

-- One-off workout added for today or later (not part of a program)
create or replace function public.notify_one_off_workout()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.assignment_id is null and new.overrides_id is null and new.workout_date >= public.sydney_today() then
    insert into notifications (user_id, kind, title, body, url)
    select p.id, 'workout', 'New workout: ' || left(new.title, 60),
           'Scheduled for ' || to_char(new.workout_date, 'Dy DD Mon') || '.', '/train/' || new.id
    from profiles p
    where p.status = 'active' and p.notify_workouts and p.feat_program
      and (p.id = new.athlete_id or p.id in (select athlete_id from group_members where group_id = new.group_id));
  end if;
  return null;
end;
$$;
create trigger workouts_notify after insert on public.workouts
  for each row execute function public.notify_one_off_workout();

-- Daily reminders at each client's chosen time (Sydney). Run every minute.
create or replace function public.queue_reminders()
returns int language plpgsql security definer set search_path = public
as $$
declare n int := 0; k int; now_syd timestamp := now() at time zone 'Australia/Sydney';
begin
  if auth.uid() is not null then raise exception 'permission denied'; end if;
  -- workout reminders: a workout today that isn't finished yet
  with due as (
    select p.id from profiles p
    where p.status = 'active' and p.feat_program and p.workout_reminder_time is not null
      and p.workout_reminder_time <= now_syd::time
      and (p.reminders_sent_on is null or p.reminders_sent_on < now_syd::date)
  ), todays as (
    select d.id user_id, min(w.title) title
    from due d
    join workouts w on w.workout_date = now_syd::date
      and (w.athlete_id = d.id or (w.group_id in (select group_id from group_members where athlete_id = d.id)
           and not exists (select 1 from workouts o where o.overrides_id = w.id and o.athlete_id = d.id)))
    where not exists (select 1 from workout_logs l where l.workout_id = w.id and l.athlete_id = d.id and l.completed_at is not null)
    group by d.id
  )
  insert into notifications (user_id, kind, title, body, url)
  select user_id, 'reminder', 'Training today', title || '. Tap to start.', '/train' from todays;
  get diagnostics k = row_count; n := n + k;
  update profiles set reminders_sent_on = now_syd::date
  where status = 'active' and workout_reminder_time is not null and workout_reminder_time <= now_syd::time
    and (reminders_sent_on is null or reminders_sent_on < now_syd::date);

  -- habit reminders: habits not all ticked today (uses a separate marker via notifications)
  insert into notifications (user_id, kind, title, body, url)
  select p.id, 'habit', 'Habits', 'Don''t break the streak: tick off today''s habits.', '/habits'
  from profiles p
  where p.status = 'active' and p.feat_habits and p.habit_reminder_time is not null
    and p.habit_reminder_time <= now_syd::time
    and not exists (select 1 from notifications x where x.user_id = p.id and x.kind = 'habit'
                    and (x.created_at at time zone 'Australia/Sydney')::date = now_syd::date)
    and exists (select 1 from habits h where h.athlete_id = p.id and h.active
                and not exists (select 1 from habit_logs l where l.habit_id = h.id and l.day = now_syd::date));
  get diagnostics k = row_count; n := n + k;
  return n;
end;
$$;
revoke execute on function public.queue_reminders() from public, anon, authenticated;

create or replace function public.minute_push_job()
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.queue_reminders();
  if exists (select 1 from notifications where sent_at is null and attempts < 5) then
    perform public.ping_push_dispatch();
  end if;
end;
$$;
revoke execute on function public.minute_push_job() from public, anon, authenticated;

do $$ begin
  create extension if not exists pg_net;
exception when others then null;
end $$;
do $$ begin
  perform cron.schedule('push-minute', '* * * * *', 'select public.minute_push_job()');
exception when others then null;
end $$;

-- ---------- Hardening: helper functions aren't for signed-out visitors ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.can_see_season(uuid)', 'public.can_see_workout(uuid)', 'public.group_leaderboard(uuid, uuid)',
    'public.is_group_member(uuid)', 'public.owns_log(uuid)', 'public.is_hidden_ahead(public.workouts)']
  loop
    execute format('revoke execute on function %s from anon', f);
  end loop;
end $$;
