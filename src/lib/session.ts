// Server-side helpers: load the current user's profile and enforce
// which screens they're allowed on.
import { redirect } from "next/navigation";
import { after } from "next/server";
import { shouldTouch } from "./activity";
import { createClient } from "./supabase/server";
import { gateState, HOME_FOR, type GateState } from "./gate";
import type { Profile } from "./types";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  // Record "last opened the app" (at most hourly), after the page is sent
  if (profile && shouldTouch(profile.last_seen_at, new Date())) {
    after(async () => {
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", user.id);
    });
  }
  return { supabase, user, profile: profile ?? null };
}

/** Redirects to the right home screen unless the user's state is in `allowed`. */
export async function requireState(allowed: GateState[]) {
  const ctx = await getSessionProfile();
  const state = gateState(ctx.profile);
  if (!allowed.includes(state)) redirect(HOME_FOR[state]);
  return { ...ctx, profile: ctx.profile as Profile, state };
}

/** Like requireState, but also sends athletes home if the coach has switched this feature off. */
export async function requireFeature(
  allowed: GateState[],
  feature: import("./features").Feature,
) {
  const ctx = await requireState(allowed);
  const { hasFeature } = await import("./features");
  if (!hasFeature(ctx.profile, feature)) redirect("/athlete");
  return ctx;
}
