-- Form builder: coach-made forms (e.g. weekly check-in), assigned to clients once or on a repeat.
create table if not exists public.forms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 80),
  description text check (description is null or length(description) <= 1000),
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.form_questions (
  id        uuid primary key default gen_random_uuid(),
  form_id   uuid not null references public.forms(id) on delete cascade,
  position  int not null default 0,
  kind      text not null check (kind in ('short', 'long', 'number', 'scale', 'choice', 'multi', 'yesno')),
  label     text not null check (length(btrim(label)) between 1 and 200),
  help      text check (help is null or length(help) <= 300),
  options   text[] not null default '{}' check (cardinality(options) <= 12),
  required  boolean not null default false
);
create index if not exists form_questions_form_idx on public.form_questions (form_id, position);

create table if not exists public.form_assignments (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references public.forms(id) on delete cascade,
  athlete_id  uuid not null references public.profiles(id) on delete cascade,
  repeat      text not null default 'weekly' check (repeat in ('once', 'weekly', 'fortnightly', 'monthly')),
  starts_on   date not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (form_id, athlete_id)
);

create table if not exists public.form_responses (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references public.forms(id) on delete cascade,
  athlete_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  due_on        date not null,
  answers       jsonb not null default '{}' check (jsonb_typeof(answers) = 'object' and length(answers::text) <= 20000),
  submitted_at  timestamptz not null default now(),
  coach_seen_at timestamptz,
  unique (form_id, athlete_id, due_on)
);

alter table public.forms enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_assignments enable row level security;
alter table public.form_responses enable row level security;

create policy "forms_coach" on public.forms for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "forms_client_read" on public.forms for select to authenticated
  using (public.is_active_user() and exists (select 1 from public.form_assignments a where a.form_id = forms.id and a.athlete_id = auth.uid()));

create policy "form_q_coach" on public.form_questions for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "form_q_client_read" on public.form_questions for select to authenticated
  using (public.is_active_user() and exists (select 1 from public.form_assignments a where a.form_id = form_questions.form_id and a.athlete_id = auth.uid()));

create policy "form_assign_coach" on public.form_assignments for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "form_assign_client_read" on public.form_assignments for select to authenticated using (athlete_id = auth.uid());

create policy "form_resp_coach" on public.form_responses for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "form_resp_client_read" on public.form_responses for select to authenticated using (athlete_id = auth.uid());
create policy "form_resp_client_insert" on public.form_responses for insert to authenticated
  with check (
    athlete_id = auth.uid() and public.is_active_user() and coach_seen_at is null
    and exists (select 1 from public.form_assignments a where a.form_id = form_responses.form_id and a.athlete_id = auth.uid() and a.active)
    and due_on <= (now() at time zone 'Australia/Sydney')::date + 1
  );

-- A starter weekly check-in the coach can edit
do $$
declare f uuid;
begin
  if not exists (select 1 from public.forms where name = 'Weekly check-in') then
    insert into public.forms (name, description) values ('Weekly check-in', 'Takes 2 minutes. Helps me adjust your plan for next week.') returning id into f;
    insert into public.form_questions (form_id, position, kind, label, help, options, required) values
      (f, 1, 'number', 'Bodyweight this morning (kg)', null, '{}', false),
      (f, 2, 'scale',  'Energy this week', '1 = flat, 10 = flying', '{}', true),
      (f, 3, 'scale',  'Sleep quality this week', '1 = terrible, 10 = great', '{}', true),
      (f, 4, 'scale',  'Stress this week', '1 = calm, 10 = very stressed', '{}', true),
      (f, 5, 'choice', 'How many planned sessions did you complete?', null, '{All of them,Most,About half,Less than half}', true),
      (f, 6, 'yesno',  'Any pain or niggles?', null, '{}', true),
      (f, 7, 'long',   'Wins this week', null, '{}', false),
      (f, 8, 'long',   'What did you struggle with?', null, '{}', false),
      (f, 9, 'long',   'Anything you want to ask me?', null, '{}', false);
  end if;
end $$;
