-- =====================================================================
-- Migration 085 — tidy Supabase security advisor warnings.
--   1. Pin search_path on helper/guard functions that didn't set one
--      (stops a malicious schema shadowing public objects).
--   2. Trigger-only functions can't be called as API endpoints by anyone.
-- Behaviour is unchanged: these functions already resolved names in public.
-- =====================================================================
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in (
        'guard_program_day', 'trim_program_weeks', 'guard_macro_log', 'guard_fight', 'guard_profile_features',
        'guard_profile_update', 'sydney_today', 'week_monday', 'editable_from', 'guard_session_dates',
        'guard_checkin_dates', 'touch_updated_at', 'guard_test_entry', 'guard_lift', 'guard_lift_max',
        'guard_body_metric', 'next_send_time', 'guard_scheduled_message', 'guard_readiness',
        'guard_profile_coach_prefs', 'guard_profile_avatar', 'guard_profile_target', 'e1rm',
        'stamp_first_completion', 'guard_profile_plan', 'guard_profile_beta', 'guard_profile_assigned_coach')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;

  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
      and p.proname in ('handle_new_user', 'notification_created', 'notify_assignment', 'notify_message',
                        'notify_one_off_workout', 'enrol_on_approval')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
