-- Migration 058 — tell the coach when a client swaps an exercise because of pain.
create or replace function public.notify_pain_swap()
returns trigger language plpgsql security definer set search_path = public as $$
declare who text; what text; athlete uuid;
begin
  if new.swap_reason = 'pain' and (tg_op = 'INSERT' or old.swap_reason is distinct from 'pain' or old.swap_exercise_id is distinct from new.swap_exercise_id) then
    select l.athlete_id into athlete from workout_logs l where l.id = new.log_id;
    select coalesce(full_name, 'A client') into who from profiles where id = athlete;
    select e.name into what from workout_items wi join exercises e on e.id = wi.exercise_id where wi.id = new.item_id;
    insert into notifications (user_id, kind, title, body, url)
    select c.id, 'reminder', 'Swapped for pain', left(who || ' swapped ' || coalesce(what, 'an exercise') || coalesce(': ' || new.swap_note, ''), 200), '/coach/athlete/' || athlete
    from profiles c where c.role = 'coach' and c.status = 'active';
  end if;
  return null;
end;
$$;
create trigger notify_pain_swap after insert or update of swap_reason, swap_exercise_id on public.item_logs
  for each row execute function public.notify_pain_swap();
revoke execute on function public.notify_pain_swap() from public, anon, authenticated;
