-- =====================================================================
-- TYPERFORMANCE App
-- Migration 045 — let the database reach protected Vercel preview links
--   If private.settings has 'vercel_bypass' (Vercel → Settings → Deployment
--   Protection → Protection Bypass for Automation), it's sent as the
--   x-vercel-protection-bypass header. Production doesn't need it.
-- =====================================================================
create or replace function public.ping_push_dispatch()
returns void language plpgsql security definer set search_path = public, private
as $$
declare u text; s text; b text; h jsonb;
begin
  select value into u from private.settings where key = 'app_url';
  select value into s from private.settings where key = 'push_secret';
  select value into b from private.settings where key = 'vercel_bypass';
  if u is null or s is null then return; end if;
  h := jsonb_build_object('content-type', 'application/json', 'x-typ-secret', s);
  if b is not null then h := h || jsonb_build_object('x-vercel-protection-bypass', b); end if;
  begin
    perform net.http_post(url := u || '/api/push/dispatch', headers := h, body := '{}'::jsonb);
  exception when others then null;
  end;
end;
$$;
revoke execute on function public.ping_push_dispatch() from public, anon, authenticated;
