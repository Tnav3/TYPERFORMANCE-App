-- How many weeks ahead a client can see a block: null = all of it, 1 = this week only,
-- 2 = this week and next, and so on. The older one-week-at-a-time switch still counts as 1.
alter table public.assignments
  add column if not exists reveal_weeks int check (reveal_weeks is null or reveal_weeks between 1 and 12);

create or replace function public.is_hidden_ahead(w public.workouts)
returns boolean language sql stable security definer set search_path = public
as $$
  select w.assignment_id is not null and coalesce((
    select w.workout_date > public.week_monday(public.sydney_today()) + 7 * coalesce(a.reveal_weeks, case when a.reveal_weekly then 1 end) - 1
    from assignments a where a.id = w.assignment_id
  ), false)
$$;
