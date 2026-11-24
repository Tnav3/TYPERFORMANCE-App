-- In-app notifications centre: the push outbox doubles as each user's inbox.
alter table public.notifications add column if not exists read_at timestamptz;
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create or replace function public.mark_notifications_read()
returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;
revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;
