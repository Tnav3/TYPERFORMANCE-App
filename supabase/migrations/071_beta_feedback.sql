-- =====================================================================
-- Migration 071 — beta testing
--   profiles.beta: coach marks beta testers (they get new features first).
--   feedback: "Report a problem / idea" from inside the app, with the page
--   and app version attached; the coach is notified.
-- =====================================================================
alter table public.profiles add column if not exists beta boolean not null default false;
create or replace function public.guard_profile_beta()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and not public.is_coach() and new.beta is distinct from old.beta then
    raise exception 'Only the coach can change beta access';
  end if;
  return new;
end;
$$;
create trigger guard_profile_beta before update on public.profiles
  for each row execute function public.guard_profile_beta();

create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind        text not null default 'bug' check (kind in ('bug', 'idea', 'other')),
  message     text not null check (length(btrim(message)) between 3 and 2000),
  page        text check (page is null or length(page) <= 200),
  app_version text check (app_version is null or length(app_version) <= 60),
  device      text check (device is null or length(device) <= 300),
  status      text not null default 'new' check (status in ('new', 'planned', 'fixed', 'wont_fix')),
  created_at  timestamptz not null default now()
);
alter table public.feedback enable row level security;
create policy "feedback_insert_own" on public.feedback for insert to authenticated with check (user_id = auth.uid());
create policy "feedback_read" on public.feedback for select to authenticated using (user_id = auth.uid() or public.is_coach());
create policy "feedback_coach_update" on public.feedback for update to authenticated using (public.is_coach()) with check (public.is_coach());

create or replace function public.notify_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, title, body, url)
  select c.id, 'reminder', left(case new.kind when 'bug' then 'Problem reported' when 'idea' then 'New idea' else 'Feedback' end
           || ' · ' || coalesce((select full_name from profiles where id = new.user_id), 'Someone'), 80),
         left(new.message, 200), '/coach/feedback'
  from profiles c where c.role = 'coach' and c.status = 'active' and c.id <> new.user_id;
  return null;
end;
$$;
create trigger notify_feedback after insert on public.feedback for each row execute function public.notify_feedback();
revoke execute on function public.notify_feedback() from public, anon, authenticated;
