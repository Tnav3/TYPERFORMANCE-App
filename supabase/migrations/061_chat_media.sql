-- =====================================================================
-- Migration 061 — chat media: photos, videos, voice notes, files, reactions
--   Files live in a private bucket, one folder per client thread.
--   A message can be text, an attachment, or both.
-- =====================================================================
alter table public.messages
  add column if not exists attachment_path text check (attachment_path is null or (length(attachment_path) <= 200 and attachment_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$')),
  add column if not exists attachment_kind text check (attachment_kind is null or attachment_kind in ('image', 'video', 'audio', 'file')),
  add column if not exists attachment_name text check (attachment_name is null or length(attachment_name) <= 120),
  add column if not exists attachment_size int check (attachment_size is null or attachment_size between 0 and 52428800),
  add column if not exists duration_sec numeric(6,1) check (duration_sec is null or duration_sec between 0 and 600),
  add column if not exists reply_to uuid references public.messages(id) on delete set null,
  add column if not exists keep boolean not null default false;

-- Body may be empty when there's an attachment
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.messages'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%btrim(body)%' loop
    execute format('alter table public.messages drop constraint %I', c);
  end loop;
end $$;
alter table public.messages add constraint messages_body_check check (
  length(body) <= 2000 and (length(btrim(body)) >= 1 or attachment_path is not null));
alter table public.messages add constraint messages_attachment_pair_check check ((attachment_path is null) = (attachment_kind is null));

create or replace function public.guard_message_media()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'INSERT' then
    if new.attachment_path is not null and split_part(new.attachment_path, '/', 1) <> new.athlete_id::text then
      raise exception 'That file belongs to another chat';
    end if;
    if not public.is_coach() then new.keep := false; end if;
  else
    if new.attachment_path is distinct from old.attachment_path or new.attachment_kind is distinct from old.attachment_kind
       or new.reply_to is distinct from old.reply_to then
      raise exception 'Messages can''t be edited';
    end if;
    if new.keep is distinct from old.keep and not public.is_coach() then raise exception 'Only the coach can keep media'; end if;
  end if;
  return new;
end;
$$;
create trigger messages_media_guard before insert or update on public.messages
  for each row execute function public.guard_message_media();

-- Notification preview for attachments
create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = public
as $$
declare sender profiles; preview text;
begin
  select * into sender from profiles where id = new.sender_id;
  preview := left(regexp_replace(coalesce(nullif(btrim(new.body), ''),
    case new.attachment_kind when 'image' then 'Sent a photo' when 'video' then 'Sent a video'
         when 'audio' then 'Sent a voice message' when 'file' then 'Sent a file' else '' end), '\s+', ' ', 'g'), 140);
  if sender.role = 'coach' then
    insert into notifications (user_id, kind, title, body, url)
    select p.id, case when new.announcement then 'announcement' else 'message' end,
           case when new.announcement then 'Announcement' else 'Message from your coach' end, preview, '/chat'
    from profiles p where p.id = new.athlete_id and p.notify_messages and p.status = 'active';
  else
    insert into notifications (user_id, kind, title, body, url)
    select c.id, 'message', coalesce(sender.full_name, 'Client') || ' sent a message', preview, '/coach/chat/' || new.athlete_id
    from profiles c where c.role = 'coach' and c.status = 'active' and c.notify_messages;
  end if;
  return null;
end;
$$;

-- Reactions: one per person per message
create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('👍', '🔥', '💪', '😂', '❤️', '👏', '🙏', '😮')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_reactions enable row level security;
create policy "reactions_select" on public.message_reactions for select to authenticated
  using (exists (select 1 from messages m where m.id = message_id and (public.is_coach() or (m.athlete_id = auth.uid() and public.is_active_user()))));
create policy "reactions_write" on public.message_reactions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from messages m where m.id = message_id and (public.is_coach() or (m.athlete_id = auth.uid() and public.is_active_user()))));

-- Private bucket, 50 MB per file (the Supabase upload cap on the free plan)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 52428800, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/x-m4a',
  'application/pdf'])
on conflict (id) do nothing;
create policy "chat_media_select" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
create policy "chat_media_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and (((storage.foldername(name))[1] = auth.uid()::text and public.is_active_user()) or public.is_coach()));
create policy "chat_media_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and public.is_coach());
