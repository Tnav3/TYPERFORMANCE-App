-- =====================================================================
-- TYPERFORMANCE App
-- Migration 033 — Programming module, Segments E + F (+ data for K):
--   bodyweight log, leaderboards, coach chat, scheduled/recurring messages,
--   follow-ups, daily app opens
-- =====================================================================

-- ---------- Bodyweight (daily) ----------
create table public.body_metrics (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  measured_on  date not null default public.sydney_today(),
  weight_kg    numeric(5,2) not null check (weight_kg between 30 and 250),
  waist_cm     numeric(5,1) check (waist_cm is null or waist_cm between 40 and 200),
  created_at   timestamptz not null default now(),
  unique (athlete_id, measured_on)
);
create or replace function public.guard_body_metric()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and new.measured_on > public.sydney_today() then
    raise exception 'Date cannot be in the future';
  end if;
  return new;
end;
$$;
create trigger body_metrics_guard before insert or update on public.body_metrics
  for each row execute function public.guard_body_metric();
create trigger body_metrics_feature before insert or update on public.body_metrics
  for each row execute function public.require_feature('feat_bodyweight');
alter table public.body_metrics enable row level security;
create policy "body_metrics_select" on public.body_metrics
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "body_metrics_write" on public.body_metrics
  for all to authenticated
  using ((athlete_id = auth.uid() and public.is_active_user()) or public.is_coach())
  with check ((athlete_id = auth.uid() and public.is_active_user()) or public.is_coach());

-- ---------- Leaderboard ----------
-- Best estimated 1RM (from logged sets of 1–12 reps) per member of a group for one exercise.
-- Only members who have leaderboards switched on appear. Callers: the coach, or a member
-- of that group who has leaderboards on.
create or replace function public.group_leaderboard(p_group uuid, p_exercise uuid)
returns table (athlete_id uuid, name text, best_e1rm numeric, best_load numeric, best_reps int, on_date date)
language sql stable security definer set search_path = public
as $$
  with allowed as (
    select public.is_coach()
        or exists (select 1 from group_members gm join profiles p on p.id = gm.athlete_id
                   where gm.group_id = p_group and gm.athlete_id = auth.uid() and p.feat_leaderboard and p.status = 'active') ok
  ),
  sets as (
    select l.athlete_id, s.load_kg, s.reps, l.workout_date,
           public.e1rm(s.load_kg, s.reps) e
    from set_logs s
    join workout_logs l on l.id = s.log_id
    join workout_items i on i.id = s.item_id
    join group_members gm on gm.athlete_id = l.athlete_id and gm.group_id = p_group
    join profiles p on p.id = l.athlete_id and p.feat_leaderboard and p.status = 'active'
    where i.exercise_id = p_exercise and s.done and s.load_kg > 0 and s.reps between 1 and 12
  ),
  ranked as (
    select *, row_number() over (partition by athlete_id order by e desc, workout_date) rn from sets
  )
  select r.athlete_id, coalesce(split_part(p.full_name, ' ', 1) || coalesce(' ' || left(nullif(split_part(p.full_name, ' ', 2), ''), 1) || '.', ''), 'Athlete'),
         r.e, r.load_kg, r.reps, r.workout_date
  from ranked r join profiles p on p.id = r.athlete_id, allowed
  where r.rn = 1 and allowed.ok
  order by r.e desc
  limit 50
$$;

-- ---------- Chat ----------
-- One thread per client (athlete_id). Coach and that client only.
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.profiles(id) on delete cascade,
  sender_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body          text not null check (length(btrim(body)) between 1 and 2000),
  created_at    timestamptz not null default now(),
  read_at       timestamptz,
  scheduled_id  uuid,
  announcement  boolean not null default false
);
create index messages_thread_idx on public.messages (athlete_id, created_at desc);
create index messages_unread_idx on public.messages (athlete_id) where read_at is null;

create or replace function public.guard_message()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.sender_id := auth.uid();
      new.read_at := null;
      new.created_at := now();
      new.scheduled_id := null;
      new.announcement := false;
      if not public.is_coach() then
        if new.athlete_id <> auth.uid() then raise exception 'You can only message your coach'; end if;
        if not coalesce((select feat_chat from profiles where id = auth.uid()), false) then
          raise exception 'This feature is switched off for your account';
        end if;
      end if;
    else
      -- Only read_at can change, and only by the person who received the message
      if new.body is distinct from old.body or new.sender_id is distinct from old.sender_id
         or new.athlete_id is distinct from old.athlete_id or new.created_at is distinct from old.created_at then
        raise exception 'Messages can''t be edited';
      end if;
      if old.sender_id = auth.uid() and new.read_at is distinct from old.read_at then
        raise exception 'Only the recipient can mark a message read';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger messages_guard before insert or update on public.messages
  for each row execute function public.guard_message();

alter table public.messages enable row level security;
create policy "messages_select" on public.messages
  for select to authenticated using (public.is_coach() or (athlete_id = auth.uid() and public.is_active_user()));
create policy "messages_insert" on public.messages
  for insert to authenticated with check (public.is_coach() or (athlete_id = auth.uid() and public.is_active_user()));
create policy "messages_update" on public.messages
  for update to authenticated
  using (public.is_coach() or athlete_id = auth.uid())
  with check (public.is_coach() or athlete_id = auth.uid());
create policy "messages_delete" on public.messages
  for delete to authenticated using (public.is_coach() or sender_id = auth.uid());

-- Live updates (Supabase only; skipped where realtime isn't installed)
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when others then null;
end $$;

-- ---------- Scheduled & recurring messages (in-app) ----------
create table public.scheduled_messages (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body          text not null check (length(btrim(body)) between 1 and 2000),
  target        text not null check (target in ('athlete', 'group', 'all')),
  athlete_id    uuid references public.profiles(id) on delete cascade,
  group_id      uuid references public.groups(id) on delete cascade,
  repeat        text not null default 'none' check (repeat in ('none', 'weekly', 'days')),
  weekdays      int[] check (weekdays is null or weekdays <@ array[1,2,3,4,5,6,7]),   -- ISO: 1 = Mon
  every_days    int check (every_days is null or every_days between 1 and 90),
  time_of_day   time not null default '09:00',
  next_send_at  timestamptz,                    -- null = finished
  active        boolean not null default true,
  last_sent_at  timestamptz,
  sent_count    int not null default 0,
  created_at    timestamptz not null default now(),
  check ((target = 'athlete') = (athlete_id is not null)),
  check ((target = 'group') = (group_id is not null)),
  check (repeat <> 'weekly' or cardinality(weekdays) > 0),
  check (repeat <> 'days' or every_days is not null)
);
alter table public.scheduled_messages enable row level security;
create policy "scheduled_messages_coach" on public.scheduled_messages
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- Next send time strictly after `after` (Sydney local time of day).
create or replace function public.next_send_time(
  p_repeat text, p_weekdays int[], p_every int, p_time time, p_after timestamptz, p_last timestamptz)
returns timestamptz language plpgsql stable
as $$
declare d date; c timestamptz; i int;
begin
  if p_repeat = 'days' then
    if p_last is null then
      d := (p_after at time zone 'Australia/Sydney')::date;
      c := (d + p_time) at time zone 'Australia/Sydney';
      if c <= p_after then c := ((d + 1) + p_time) at time zone 'Australia/Sydney'; end if;
      return c;
    end if;
    d := (p_last at time zone 'Australia/Sydney')::date + p_every;
    c := (d + p_time) at time zone 'Australia/Sydney';
    while c <= p_after loop
      d := d + p_every;
      c := (d + p_time) at time zone 'Australia/Sydney';
    end loop;
    return c;
  elsif p_repeat = 'weekly' then
    d := (p_after at time zone 'Australia/Sydney')::date;
    for i in 0..7 loop
      c := ((d + i) + p_time) at time zone 'Australia/Sydney';
      if c > p_after and extract(isodow from d + i)::int = any (p_weekdays) then
        return c;
      end if;
    end loop;
    return null;
  end if;
  return null;
end;
$$;

-- Set next_send_at on save (for one-offs the coach gives next_send_at directly)
create or replace function public.guard_scheduled_message()
returns trigger language plpgsql
as $$
begin
  if new.repeat = 'none' then
    if new.next_send_at is null and new.sent_count = 0 then
      raise exception 'Pick when to send it';
    end if;
  elsif tg_op = 'INSERT'
     or new.repeat is distinct from old.repeat or new.weekdays is distinct from old.weekdays
     or new.every_days is distinct from old.every_days or new.time_of_day is distinct from old.time_of_day
     or (new.active and not old.active) then
    new.next_send_at := public.next_send_time(new.repeat, new.weekdays, new.every_days, new.time_of_day, now(),
                                              case when tg_op = 'UPDATE' then old.last_sent_at end);
  end if;
  return new;
end;
$$;
create trigger scheduled_messages_guard before insert or update on public.scheduled_messages
  for each row execute function public.guard_scheduled_message();

-- Delivers everything due. Run every minute by pg_cron (and safe to run by hand).
create or replace function public.send_due_messages()
returns int language plpgsql security definer set search_path = public
as $$
declare r scheduled_messages; n int := 0; k int;
begin
  -- Only the scheduler (no signed-in user) runs this
  if auth.uid() is not null then
    raise exception 'permission denied for function send_due_messages';
  end if;
  for r in
    select * from scheduled_messages
    where active and next_send_at is not null and next_send_at <= now()
    for update skip locked
  loop
    insert into messages (athlete_id, sender_id, body, scheduled_id, announcement)
    select p.id, r.created_by, r.body, r.id, r.target <> 'athlete'
    from profiles p
    where p.role = 'athlete' and p.status = 'active' and p.feat_chat
      and (r.target = 'all'
           or (r.target = 'athlete' and p.id = r.athlete_id)
           or (r.target = 'group' and p.id in (select athlete_id from group_members where group_id = r.group_id)));
    get diagnostics k = row_count;
    n := n + k;
    update scheduled_messages set
      last_sent_at = now(),
      sent_count = sent_count + 1,
      next_send_at = case when r.repeat = 'none' then null
                          else public.next_send_time(r.repeat, r.weekdays, r.every_days, r.time_of_day, now(), now()) end,
      active = r.repeat <> 'none'
    where id = r.id;
  end loop;
  return n;
end;
$$;
revoke execute on function public.send_due_messages() from public, anon, authenticated;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('send-due-messages', '* * * * *', 'select public.send_due_messages()');
exception when others then null;   -- not available (e.g. local tests)
end $$;

-- ---------- Follow-ups (coach reminders per client) ----------
create table public.follow_ups (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.profiles(id) on delete cascade,
  due_on      date not null,
  note        text not null check (length(btrim(note)) between 1 and 500),
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index follow_ups_due_idx on public.follow_ups (due_on) where done_at is null;
alter table public.follow_ups enable row level security;
create policy "follow_ups_coach" on public.follow_ups
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- ---------- Daily app opens (for "average sign-in") ----------
create table public.app_opens (
  athlete_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  opened_on   date not null default public.sydney_today(),
  primary key (athlete_id, opened_on)
);
alter table public.app_opens enable row level security;
create policy "app_opens_select" on public.app_opens
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "app_opens_insert" on public.app_opens
  for insert to authenticated with check (athlete_id = auth.uid() and opened_on = public.sydney_today());

-- Coach dashboard card switches (saved on the coach's own profile)
alter table public.profiles add column if not exists dashboard_prefs jsonb not null default '{}'::jsonb;
