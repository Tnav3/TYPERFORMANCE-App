-- Group board for semi-private groups: members (when the coach switches it on) see how the
-- group is going this week. Effort-based, so it's fair across body sizes: sessions done,
-- sets done, and PBs in the last 4 weeks. Nobody's loads are shown.
alter table public.groups add column if not exists leaderboard boolean not null default false;

create or replace function public.group_board(p_group uuid)
returns table (athlete_id uuid, name text, sessions_week int, sets_week int, pbs_28 int, is_me boolean)
language sql stable security definer set search_path = public
as $$
  with ok as (
    select 1 from groups g
    where g.id = p_group and not g.archived
      and (public.is_coach() or (g.leaderboard and public.is_active_user() and public.is_group_member(g.id)))
  ),
  mem as (
    select m.athlete_id, coalesce(split_part(nullif(btrim(p.full_name), ''), ' ', 1), 'Member') as name
    from group_members m join profiles p on p.id = m.athlete_id
    where m.group_id = p_group and p.status = 'active' and exists (select 1 from ok)
  ),
  wk as (select public.week_monday(public.sydney_today()) as mon, public.sydney_today() as today),
  logs as (
    select l.id, l.athlete_id, l.workout_date, l.completed_at from workout_logs l
    where l.athlete_id in (select athlete_id from mem)
  ),
  sets as (
    select l.athlete_id, l.workout_date, s.exercise_id, public.e1rm(s.load_kg, s.reps) as e
    from set_logs s join logs l on l.id = s.log_id
    where s.done
  ),
  daybest as (
    select athlete_id, exercise_id, workout_date, max(e) as best
    from sets where exercise_id is not null and e is not null group by 1, 2, 3
  ),
  pb as (
    select athlete_id, count(*)::int n from (
      select d.*, max(best) over (partition by athlete_id, exercise_id order by workout_date rows between unbounded preceding and 1 preceding) as prev
      from daybest d
    ) x, wk
    where prev is not null and best > prev and workout_date > wk.today - 28
    group by athlete_id
  )
  select m.athlete_id, m.name,
    (select count(*)::int from logs l, wk where l.athlete_id = m.athlete_id and l.completed_at is not null and l.workout_date between wk.mon and wk.today),
    (select count(*)::int from sets s, wk where s.athlete_id = m.athlete_id and s.workout_date between wk.mon and wk.today),
    coalesce((select n from pb where pb.athlete_id = m.athlete_id), 0),
    m.athlete_id = auth.uid()
  from mem m
  order by 3 desc, 4 desc, 5 desc, 2
$$;
revoke execute on function public.group_board(uuid) from public, anon;
grant execute on function public.group_board(uuid) to authenticated;
