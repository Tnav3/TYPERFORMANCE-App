-- =====================================================================
-- TYPERFORMANCE App
-- Migration 044 — onboarding / automation sequences (Trainerize "Auto Messages")
--   A sequence = timed chat messages ("Day 0 09:00 welcome", "Day 3 18:00 check-in").
--   Clients are enrolled automatically when approved (or by hand), then the
--   minute job delivers each step at Sydney time. {first_name} is filled in.
-- =====================================================================

create table public.sequences (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 80),
  trigger     text not null default 'approved' check (trigger in ('approved', 'manual')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create table public.sequence_steps (
  id           uuid primary key default gen_random_uuid(),
  sequence_id  uuid not null references public.sequences(id) on delete cascade,
  day_offset   int  not null check (day_offset between 0 and 365),
  send_time    time not null default '09:00',
  body         text not null check (length(btrim(body)) between 1 and 2000)
);
create index sequence_steps_seq_idx on public.sequence_steps (sequence_id, day_offset, send_time);
create table public.sequence_enrollments (
  sequence_id  uuid not null references public.sequences(id) on delete cascade,
  athlete_id   uuid not null references public.profiles(id) on delete cascade,
  started_on   date not null default public.sydney_today(),
  stopped_at   timestamptz,
  primary key (sequence_id, athlete_id)
);
create table public.sequence_sends (
  step_id      uuid not null references public.sequence_steps(id) on delete cascade,
  athlete_id   uuid not null references public.profiles(id) on delete cascade,
  sent_at      timestamptz not null default now(),
  primary key (step_id, athlete_id)
);
alter table public.sequences            enable row level security;
alter table public.sequence_steps       enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.sequence_sends       enable row level security;
create policy "sequences_coach"   on public.sequences            for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "seq_steps_coach"   on public.sequence_steps       for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "seq_enrol_coach"   on public.sequence_enrollments for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "seq_sends_coach"   on public.sequence_sends       for select to authenticated using (public.is_coach());

-- Auto-enrol on approval (pending → active)
create or replace function public.enrol_on_approval()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role = 'athlete' and new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    insert into sequence_enrollments (sequence_id, athlete_id, started_on)
    select s.id, new.id, public.sydney_today() from sequences s where s.active and s.trigger = 'approved'
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger profiles_enrol_after_update after update of status on public.profiles
  for each row execute function public.enrol_on_approval();
create trigger profiles_enrol_after_insert after insert on public.profiles
  for each row execute function public.enrol_on_approval();

-- Deliver due steps (Sydney time). Steps whose day has passed are still sent
-- (late) so nothing is skipped, but nothing older than 2 days is sent.
create or replace function public.send_sequence_steps()
returns int language plpgsql security definer set search_path = public
as $$
declare n int; now_syd timestamp := now() at time zone 'Australia/Sydney';
begin
  if auth.uid() is not null then raise exception 'permission denied'; end if;
  with due as (
    select st.id step_id, e.athlete_id, s.created_by, st.body, p.full_name
    from sequence_enrollments e
    join sequences s on s.id = e.sequence_id and s.active
    join sequence_steps st on st.sequence_id = s.id
    join profiles p on p.id = e.athlete_id and p.status = 'active' and p.feat_chat
    where e.stopped_at is null
      and (e.started_on + st.day_offset) + st.send_time <= now_syd
      and (e.started_on + st.day_offset) + st.send_time > now_syd - interval '2 days'
      and not exists (select 1 from sequence_sends x where x.step_id = st.id and x.athlete_id = e.athlete_id)
  ), marked as (
    insert into sequence_sends (step_id, athlete_id) select step_id, athlete_id from due
    on conflict do nothing
    returning step_id, athlete_id
  )
  insert into messages (athlete_id, sender_id, body)
  select d.athlete_id, d.created_by,
         replace(d.body, '{first_name}', coalesce(nullif(split_part(d.full_name, ' ', 1), ''), 'there'))
  from due d join marked m on m.step_id = d.step_id and m.athlete_id = d.athlete_id;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.send_sequence_steps() from public, anon, authenticated;

-- Fold into the minute job
create or replace function public.minute_push_job()
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.send_sequence_steps();
  perform public.queue_reminders();
  if exists (select 1 from notifications where sent_at is null and attempts < 5) then
    perform public.ping_push_dispatch();
  end if;
end;
$$;
revoke execute on function public.minute_push_job() from public, anon, authenticated;
