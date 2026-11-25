-- =====================================================================
-- Migration 068 — clients move a workout to another day
--   Window: from a week ago to 4 weeks ahead, never a finished workout.
--   A group workout becomes the client's own copy (the group keeps its date).
--   The coach gets a notification.
-- =====================================================================
create or replace function public.move_my_workout(p_workout uuid, p_date date)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); src workouts; w uuid; today date := public.sydney_today();
begin
  if me is null or not public.is_active_user() then raise exception 'permission denied'; end if;
  if p_date is null or p_date < today - 7 or p_date > today + 28 then raise exception 'Pick a day from last week to 4 weeks ahead'; end if;
  select * into src from workouts where id = p_workout;
  if src.id is null then raise exception 'Workout not found'; end if;
  if not (coalesce(src.athlete_id = me, false) or (src.group_id is not null and exists (select 1 from group_members where group_id = src.group_id and athlete_id = me))) then
    raise exception 'Workout not found';
  end if;
  if exists (select 1 from workout_logs where workout_id = p_workout and athlete_id = me and completed_at is not null) then
    raise exception 'That workout is already finished';
  end if;
  if src.group_id is not null and src.athlete_id is null then
    -- personal copy for this client on the new day
    select id into w from workouts where overrides_id = p_workout and athlete_id = me;
    if w is null then
      insert into workouts (athlete_id, overrides_id, assignment_id, workout_date, position, title, notes, created_by)
      values (me, p_workout, src.assignment_id, p_date, src.position, src.title, src.notes, null)
      returning id into w;
      insert into workout_items (workout_id, position, kind, exercise_id, block, slot, sets, reps,
        load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields)
      select w, position, kind, exercise_id, block, slot, sets, reps,
        load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields
      from workout_items where workout_id = p_workout;
    else
      update workouts set workout_date = p_date where id = w;
    end if;
  else
    w := src.id;
    update workouts set workout_date = p_date where id = w;
  end if;
  insert into notifications (user_id, kind, title, body, url)
  select c.id, 'workout', left(coalesce((select full_name from profiles where id = me), 'A client') || ' moved a workout', 80),
         left(src.title || ': ' || to_char(src.workout_date, 'Dy DD Mon') || ' → ' || to_char(p_date, 'Dy DD Mon'), 200),
         '/coach/athlete/' || me || '/program'
  from profiles c where c.role = 'coach' and c.status = 'active';
  return w;
end;
$$;
revoke execute on function public.move_my_workout(uuid, date) from public, anon;
grant execute on function public.move_my_workout(uuid, date) to authenticated;
