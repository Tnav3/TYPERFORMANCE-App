// "View as client": the coach sees a client's app read-only. The client id lives in an
// httpOnly cookie; every write is refused while it's set (see middleware).
import type { SupabaseClient } from "@supabase/supabase-js";

export const VIEW_AS_COOKIE = "typ_view_as";
export const VIEW_AS_NAME = "typ_view_as_name";
export const VIEW_AS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Wraps the coach's client so "my_*" functions (which use the signed-in user) answer for the
 * client being viewed instead. Everything else passes straight through; the coach can read
 * all client data anyway.
 */
export function asClient(supabase: SupabaseClient, athleteId: string): SupabaseClient {
  return new Proxy(supabase, {
    get(target, prop, recv) {
      if (prop === "rpc")
        return (fn: string, args?: Record<string, unknown>, opts?: unknown) =>
          fn === "my_workouts"
            ? target.rpc("client_workouts", { p_athlete: athleteId, ...(args ?? {}) }, opts as never)
            : target.rpc(fn, args, opts as never);
      const v = Reflect.get(target, prop, recv);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}
