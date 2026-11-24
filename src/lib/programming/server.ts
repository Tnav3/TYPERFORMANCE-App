// Shared server helpers for the programming module's server actions.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export { UUID, ISO_DATE } from "./patterns";

export async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();
  return {
    supabase,
    user,
    isCoach: me?.role === "coach" && me?.status === "active",
  };
}

export async function coachOnly() {
  const c = await signedIn();
  if (!c.isCoach) redirect("/");
  return c.supabase;
}

export const str = (v: FormDataEntryValue | null, max = 2000) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

export const int = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
};

export const dec = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Only allow same-site relative paths as redirect targets. */
export const safePath = (v: FormDataEntryValue | null, fallback: string) => {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
};

/** Plain-English message for a database error. */
export function friendly(msg: string | undefined, fallback = "Couldn't save. Please try again.") {
  if (!msg) return fallback;
  if (/row-level security/i.test(msg)) return "You don't have access to do that.";
  if (/duplicate|unique/i.test(msg)) return "That name is already taken.";
  const known = msg.match(
    /(past the end[^.]*|Pick one client or one group|Only group workouts can be personalised|That client is not in this group|locked \(older than 4 weeks\)|switched off for your account|before its day|not part of this workout)/i,
  );
  return known ? known[0].charAt(0).toUpperCase() + known[0].slice(1) : fallback;
}
