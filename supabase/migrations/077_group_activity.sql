-- =====================================================================
-- Migration 077 — group activity feed (opt-in per group).
-- When show_activity is on, members see who in their group finished a
-- workout in the last 7 days: first name, photo, workout title, time.
-- No loads, notes or ratings are shared.
-- =====================================================================
alter table public.groups add column if not exists show_activity boolean not null default false;

create or replace function public.group_activity(p_days int default 7)
returns table (group_name text, athlete_id uuid, first_name text, avatar_path text, workout_title text, completed_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public
as $$
  select g.name,
         p.id,
         split_part(coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.full_name), ''), 'A teammate'), ' ', 1),
         p.avatar_path,
         w.title,
         l.completed_at,
         p.id = auth.uid()
  from group_members me
  join groups g on g.id = me.group_id and g.show_activity and not g.archived
  join group_members gm on gm.group_id = g.id
  join profiles p on p.id = gm.athlete_id and p.status = 'active'
  join workout_logs l on l.athlete_id = p.id and l.completed_at is not null
       and l.completed_at > now() - make_interval(days => least(greatest(p_days, 1), 14))
  join workouts w on w.id = l.workout_id
  where me.athlete_id = auth.uid() and public.is_active_user()
  order by l.completed_at desc
  limit 30;
$$;
revoke all on function public.group_activity(int) from public, anon;
grant execute on function public.group_activity(int) to authenticated;
