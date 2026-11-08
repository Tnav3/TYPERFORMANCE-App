"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_ORDER, slugify, validateCalc, type Lift } from "@/lib/calculator";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[a-z0-9_]{2,40}$/;

async function ctx() {
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

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(",", ".");
  return s === "" ? NaN : Number(s);
};

export type SaveMaxState = {
  errors?: Record<string, string>;
  message?: string;
  saved?: { lift: string; e1rm: number };
};

/** Saves an e1RM for the signed-in athlete. The database recomputes the number. */
export async function saveLiftMax(
  _prev: SaveMaxState,
  fd: FormData,
): Promise<SaveMaxState> {
  const { supabase, user } = await ctx();
  const lift_key = String(fd.get("lift_key") ?? "");
  if (!KEY.test(lift_key)) return { message: "Pick a lift." };
  const { data: lift } = await supabase
    .from("lifts")
    .select("kind")
    .eq("key", lift_key)
    .maybeSingle<Pick<Lift, "kind">>();
  if (!lift) return { message: "Pick a lift." };

  const load = num(fd.get("load_kg"));
  const reps = num(fd.get("reps"));
  const bw = lift.kind === "bodyweight" ? num(fd.get("bodyweight_kg")) : null;
  const errors = validateCalc({ kind: lift.kind, load, reps, bodyweight: bw });
  if (Object.keys(errors).length) return { errors };

  const { data, error } = await supabase
    .from("lift_maxes")
    .insert({
      athlete_id: user.id,
      lift_key,
      load_kg: load,
      reps,
      bodyweight_kg: bw,
      e1rm_kg: 0, // set by the database
    })
    .select("e1rm_kg")
    .single();
  if (error)
    return {
      message: /row-level security/i.test(error.message)
        ? "Your account isn't active, so this can't be saved."
        : "Couldn't save. Please try again.",
    };
  revalidatePath("/calculator");
  return { saved: { lift: lift_key, e1rm: Number(data.e1rm_kg) } };
}

export async function deleteLiftMax(fd: FormData) {
  const { supabase } = await ctx();
  const id = String(fd.get("id") ?? "");
  const back = String(fd.get("next") ?? "/calculator");
  if (UUID.test(id)) await supabase.from("lift_maxes").delete().eq("id", id);
  revalidatePath(back);
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/calculator");
}

// ---------------- Coach: lift list settings ----------------
const SETTINGS = "/coach/settings/lifts";

function done(error?: string, anchor?: string): never {
  revalidatePath(SETTINGS);
  revalidatePath("/calculator");
  redirect(
    error
      ? `${SETTINGS}?error=${encodeURIComponent(error)}`
      : `${SETTINGS}${anchor ? `#${anchor}` : ""}`,
  );
}

function cleanName(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return s.length >= 2 && s.length <= 60 ? s : null;
}

async function coachOnly() {
  const c = await ctx();
  if (!c.isCoach) redirect("/");
  return c.supabase;
}

export async function addLift(fd: FormData) {
  const supabase = await coachOnly();
  const name = cleanName(fd.get("name"));
  if (!name) done("Enter a lift name (2–60 characters).");
  const kind = String(fd.get("kind") ?? "");
  const parent = String(fd.get("parent_key") ?? "") || null;
  let category = String(fd.get("category") ?? "") as Lift["category"];
  if (!["barbell", "bodyweight", "olympic", "jump"].includes(kind))
    done("Pick a lift type.");
  if (kind === "jump") {
    if (!parent || !KEY.test(parent)) done("Pick the lift its % is based on.");
    category = "jump";
  } else if (kind === "olympic") {
    category = "olympic";
  } else if (!CATEGORY_ORDER.includes(category) || category === "jump" || category === "olympic") {
    done("Pick a group.");
  }
  const base = slugify(name!);
  if (base.length < 2) done("Use letters or numbers in the name.");

  const { data: existing } = await supabase.from("lifts").select("key, name, sort_order");
  const taken = new Set((existing ?? []).map((l) => l.key));
  if ((existing ?? []).some((l) => l.name.toLowerCase() === name!.toLowerCase()))
    done("That lift is already on the list.");
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
  const sort = Math.max(0, ...(existing ?? []).map((l) => l.sort_order)) + 1;

  const { error } = await supabase.from("lifts").insert({
    key,
    name,
    category,
    kind,
    per_leg: fd.get("per_leg") === "on",
    parent_key: kind === "jump" ? parent : null,
    bar_weight_input: kind === "jump" && fd.get("bar_weight_input") === "on",
    sort_order: sort,
  });
  if (error)
    done(/own 1RM/.test(error.message) ? "A jump must be based on a lift with its own 1RM." : "Couldn't add the lift.");
  done(undefined, key);
}

export async function renameLift(fd: FormData) {
  const supabase = await coachOnly();
  const key = String(fd.get("key") ?? "");
  const name = cleanName(fd.get("name"));
  if (!KEY.test(key) || !name) done("Enter a lift name (2–60 characters).");
  const { error } = await supabase.from("lifts").update({ name }).eq("key", key);
  done(error ? "Couldn't rename." : undefined, key);
}

export async function setLiftActive(fd: FormData) {
  const supabase = await coachOnly();
  const key = String(fd.get("key") ?? "");
  const active = fd.get("active") === "true";
  if (!KEY.test(key)) done();
  const { error } = await supabase.from("lifts").update({ active }).eq("key", key);
  done(error ? "Couldn't update." : undefined, key);
}

export async function setLiftParent(fd: FormData) {
  const supabase = await coachOnly();
  const key = String(fd.get("key") ?? "");
  const parent = String(fd.get("parent_key") ?? "");
  if (!KEY.test(key) || !KEY.test(parent)) done("Pick a lift.");
  const { error } = await supabase
    .from("lifts")
    .update({ parent_key: parent })
    .eq("key", key)
    .eq("kind", "jump");
  done(
    error
      ? /own 1RM|check/.test(error.message)
        ? "A jump must be based on a lift with its own 1RM."
        : "Couldn't update."
      : undefined,
    key,
  );
}
