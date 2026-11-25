-- =====================================================================
-- Migration 088 — open one notification: mark it read and return where it points.
-- Used by the home screen's "New for you" box.
-- =====================================================================
create or replace function public.open_notification(p_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  update notifications set read_at = coalesce(read_at, now())
  where id = p_id and user_id = auth.uid()
  returning url;
$$;
revoke execute on function public.open_notification(uuid) from public, anon;
grant execute on function public.open_notification(uuid) to authenticated;
