-- =====================================================================
-- Migration 066 — onboarding v2 (replaces Trainerize auto-messages)
--   • Coach file library (PARQ, waiver, start-up guide…) attachable to any
--     sequence step; clients open it in one tap from chat.
--   • Steps can be switched on/off and can send a check-in form.
--   • Starter forms copied from Trainerize (onboarding, post-competition
--     reflection) and a rewritten "New client welcome" sequence.
-- =====================================================================
create table public.coach_files (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 120),
  path       text not null unique check (path ~ '^library/[A-Za-z0-9._-]+$'),
  mime       text not null,
  size       int not null check (size between 1 and 52428800),
  created_at timestamptz not null default now()
);
alter table public.coach_files enable row level security;
create policy "coach_files_read" on public.coach_files for select to authenticated using (public.is_coach() or public.is_active_user());
create policy "coach_files_coach" on public.coach_files for all to authenticated using (public.is_coach()) with check (public.is_coach());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-files', 'coach-files', false, 52428800, array['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'])
on conflict (id) do nothing;
create policy "coach_files_obj_read" on storage.objects for select to authenticated
  using (bucket_id = 'coach-files' and (public.is_coach() or public.is_active_user()));
create policy "coach_files_obj_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-files' and public.is_coach());
create policy "coach_files_obj_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'coach-files' and public.is_coach());

alter table public.messages add column if not exists file_id uuid references public.coach_files(id) on delete set null;
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.messages'::regclass and contype = 'c' and conname = 'messages_body_check' loop
    execute format('alter table public.messages drop constraint %I', c);
  end loop;
end $$;
alter table public.messages add constraint messages_body_check check (
  length(body) <= 2000 and (length(btrim(body)) >= 1 or attachment_path is not null or file_id is not null));

alter table public.sequence_steps
  add column if not exists active boolean not null default true,
  add column if not exists form_id uuid references public.forms(id) on delete set null,
  add column if not exists file_id uuid references public.coach_files(id) on delete set null;
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.sequence_steps'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%btrim(body)%' loop
    execute format('alter table public.sequence_steps drop constraint %I', c);
  end loop;
end $$;
alter table public.sequence_steps add constraint sequence_steps_body_check check (
  length(body) <= 2000 and (length(btrim(body)) >= 1 or form_id is not null or file_id is not null));

create or replace function public.send_sequence_steps()
returns int language plpgsql security definer set search_path = public
as $$
declare n int; now_syd timestamp := now() at time zone 'Australia/Sydney';
begin
  if auth.uid() is not null then raise exception 'permission denied'; end if;
  create temp table if not exists _due (step_id uuid, athlete_id uuid, created_by uuid, body text, full_name text, form_id uuid, file_id uuid) on commit drop;
  truncate _due;
  insert into _due
    select st.id, e.athlete_id, s.created_by, st.body, p.full_name, st.form_id, st.file_id
    from sequence_enrollments e
    join sequences s on s.id = e.sequence_id and s.active
    join sequence_steps st on st.sequence_id = s.id and st.active
    join profiles p on p.id = e.athlete_id and p.status = 'active' and p.feat_chat
    where e.stopped_at is null
      and (e.started_on + st.day_offset) + st.send_time <= now_syd
      and (e.started_on + st.day_offset) + st.send_time > now_syd - interval '2 days'
      and not exists (select 1 from sequence_sends x where x.step_id = st.id and x.athlete_id = e.athlete_id);
  insert into sequence_sends (step_id, athlete_id) select step_id, athlete_id from _due on conflict do nothing;
  insert into messages (athlete_id, sender_id, body, file_id)
  select d.athlete_id, d.created_by,
         replace(d.body, '{first_name}', coalesce(nullif(split_part(d.full_name, ' ', 1), ''), 'there')), d.file_id
  from _due d;
  get diagnostics n = row_count;
  insert into form_assignments (form_id, athlete_id, repeat, starts_on, active)
  select d.form_id, d.athlete_id, 'once', public.sydney_today(), true from _due d where d.form_id is not null
  -- don't turn an active weekly check-in into a one-off
  on conflict (form_id, athlete_id) do update set repeat = 'once', starts_on = excluded.starts_on, active = true
    where not form_assignments.active;
  return n;
end;
$$;
revoke execute on function public.send_sequence_steps() from public, anon, authenticated;

-- ---------- Starter forms (from Trainerize) ----------
do $$
declare f uuid;
begin
  if not exists (select 1 from forms where name = 'Onboarding questionnaire') then
    insert into forms (name, description) values ('Onboarding questionnaire', 'Sent on day 1. Helps build their first program.') returning id into f;
    insert into form_questions (form_id, position, kind, label, options, required) values
      (f, 1, 'multi', 'What are your goals?', array['Get stronger','Build muscle','Lose body fat','Improve fitness / cardio','Prepare for a fight or comp','Move better, less pain','General health'], true),
      (f, 2, 'short', 'Any other goals (if not listed above)?', '{}', false),
      (f, 3, 'yesno', 'Do you exercise regularly at the moment?', '{}', true),
      (f, 4, 'scale', 'How active are you day to day? (1 = mostly sitting, 10 = on your feet all day)', '{}', true),
      (f, 5, 'scale', 'How is your fitness / cardio right now? (1 = very low, 10 = excellent)', '{}', true),
      (f, 6, 'choice', 'How much training experience do you have?', array['New to training','Under 1 year','1-3 years','3+ years'], true),
      (f, 7, 'multi', 'What equipment can you use?', array['Full gym','Home gym','Dumbbells / kettlebells only','Bands only','Bodyweight only','Fight gym (bags, pads)'], true),
      (f, 8, 'multi', 'Which days can you train?', array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], true),
      (f, 9, 'choice', 'How many sessions a week can you realistically do?', array['1-2','3','4','5+'], true),
      (f, 10, 'long', 'Any injuries, niggles or medical conditions I should know about?', '{}', true),
      (f, 11, 'yesno', 'Do you smoke or vape?', '{}', false),
      (f, 12, 'long', 'Anything else you want from your program?', '{}', false);
  end if;
  if not exists (select 1 from forms where name = 'Post-competition reflection') then
    insert into forms (name, description) values ('Post-competition reflection', 'Sent after a fight or competition.') returning id into f;
    insert into form_questions (form_id, position, kind, label, required) values
      (f, 1, 'long', 'How do you think you went in your competition?', true),
      (f, 2, 'long', 'What did you do well?', true),
      (f, 3, 'long', 'What can you improve on, and why?', true),
      (f, 4, 'long', 'Physically, what helped you on the day?', false),
      (f, 5, 'long', 'From an S&C point of view, what could we improve before your next one?', false),
      (f, 6, 'long', 'What are the biggest lessons you are taking away?', false),
      (f, 7, 'short', 'When is your next competition (if any)?', false),
      (f, 8, 'long', 'Anything else you want to add?', false);
  end if;
end $$;

-- ---------- Starter welcome sequence (off until the coach switches it on) ----------
do $$
declare s uuid; coach uuid; onb uuid; chk uuid;
begin
  select id into coach from profiles where role = 'coach' and status = 'active' order by created_at limit 1;
  if coach is null or exists (select 1 from sequences where name = 'New client welcome') then return; end if;
  select id into onb from forms where name = 'Onboarding questionnaire';
  select id into chk from forms where name = 'Weekly check-in' limit 1;
  insert into sequences (created_by, name, trigger, active) values (coach, 'New client welcome', 'approved', false) returning id into s;
  insert into sequence_steps (sequence_id, day_offset, send_time, body, form_id) values
    (s, 0, '00:00', E'Welcome {first_name}, stoked to have you on board.\n\nThree quick things to get you started:\n1. Fill in the short questionnaire on your home screen (2 mins). It\'s how I build your first program.\n2. Your training lives in the Train tab. Tap any exercise name for the video and cues.\n3. Message me here any time. This is the fastest way to reach me.\n\nNew to tempos or RPE? Watch these two short videos first:\nHow to read tempos: https://www.youtube.com/watch?v=_shSvAWKDJg\nHow to read RPE: https://www.youtube.com/watch?v=5bWAhiH_TFw', onb),
    (s, 2, '09:00', E'Hey {first_name}, how are you finding the app so far?\n\nIf anything is confusing, just reply here. No such thing as a dumb question. Also make sure notifications are on so you see my messages and new workouts.', null),
    (s, 7, '09:00', E'One week in {first_name}. How\'s it feeling?\n\nIf the sessions feel too easy, too hard, or the days don\'t suit your week, tell me now and I\'ll adjust. The program should fit your life, not the other way round.', chk),
    (s, 14, '09:00', E'Two weeks down {first_name}, good work.\n\nQuick reminder: if an exercise doesn\'t feel right, use the Swap button in your workout and pick the reason. I see it and adjust from there. Anything urgent, message me here.', null),
    (s, 28, '09:00', E'One month in {first_name}! This is where the habits start to stick.\n\nLet\'s do a proper review of how it\'s going. What\'s been working, and what do you want more of?', null);
end $$;

-- Same rule for automations: an active recurring form stays as it is
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
        on conflict (form_id, athlete_id) do update set repeat = 'once', starts_on = excluded.starts_on, active = true
          where not form_assignments.active;
      end if;
      insert into automation_runs (automation_id, athlete_id, ran_on, detail) values (a.id, m.athlete_id, today, m.detail);
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;
