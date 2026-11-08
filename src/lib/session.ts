// Server-side helpers: load the current user's profile and enforce
// which screens they're allowed on.
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { gateState, HOME_FOR, type GateState } from "./gate";
import type { Profile } from "./types";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  return { supabase, user, profile: profile ?? null };
}

/** Redirects to the right home screen unless the user's state is in `allowed`. */
export async function requireState(allowed: GateState[]) {
  const ctx = await getSessionProfile();
  const state = gateState(ctx.profile);
  if (!allowed.includes(state)) redirect(HOME_FOR[state]);
  return { ...ctx, profile: ctx.profile as Profile, state };
}
