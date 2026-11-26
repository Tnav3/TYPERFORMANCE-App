-- Form checks: a client attaches a short video to an exercise in a session.
-- It's a chat message (so the coach replies in the thread) tagged with the workout item.
alter table public.messages
  add column if not exists form_check_item uuid references public.workout_items(id) on delete set null,
  add column if not exists form_check_set int check (form_check_set is null or form_check_set between 1 and 30);
create index if not exists messages_form_check_idx on public.messages (athlete_id, created_at desc) where form_check_item is not null;

create or replace function private.guard_form_check()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.form_check_item is null then return new; end if;
  if new.attachment_kind is distinct from 'video' then raise exception 'A form check needs a video'; end if;
  if not exists (select 1 from workout_items i join workouts w on w.id = i.workout_id
                 where i.id = new.form_check_item
                   and (w.athlete_id = new.athlete_id
                        or exists (select 1 from group_members g where g.group_id = w.group_id and g.athlete_id = new.athlete_id))) then
    raise exception 'That exercise isn''t in this client''s program';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_form_check_guard on public.messages;
create trigger messages_form_check_guard before insert on public.messages
  for each row execute function private.guard_form_check();
