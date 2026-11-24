-- Migration 055 — profile photo and personality: fight nickname, about me, own goal.
alter table public.profiles
  add column if not exists avatar_path text check (avatar_path is null or (length(avatar_path) <= 200 and avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$')),
  add column if not exists nickname   text check (nickname is null or length(btrim(nickname)) between 1 and 40),
  add column if not exists about_me   text check (about_me is null or length(about_me) <= 500),
  add column if not exists goal_text  text check (goal_text is null or length(goal_text) <= 200);

-- A photo path must live in the person's own folder.
create or replace function public.guard_profile_avatar()
returns trigger language plpgsql as $$
begin
  if new.avatar_path is not null and new.avatar_path is distinct from old.avatar_path
     and split_part(new.avatar_path, '/', 1) <> new.id::text then
    raise exception 'That photo belongs to someone else';
  end if;
  return new;
end;
$$;
create trigger guard_profile_avatar before update on public.profiles
  for each row execute function public.guard_profile_avatar();

-- Public bucket: file names are random, small images only. Anyone signed in uploads to their own folder; coach can manage all.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
