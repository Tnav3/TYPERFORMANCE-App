"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { titleCase } from "@/lib/calculator";
import { coachOnly, friendly, str, UUID } from "@/lib/programming/server";
import { FIELD_KEYS } from "@/lib/programming/fields";
import {
  cleanVideoUrl,
  EXERCISE_CATEGORIES,
  MEASURES,
} from "@/lib/programming/types";

const PATH = "/coach/library";
const CATS = EXERCISE_CATEGORIES.map((c) => c[0]) as string[];
const MEAS = MEASURES.map((m) => m[0]) as string[];
const KEY = /^[a-z0-9_]{2,40}$/;

function back(error?: string, anchor?: string, q?: string): never {
  revalidatePath(PATH);
  const params = new URLSearchParams();
  if (error) params.set("error", error);
  if (q) params.set("q", q);
  const qs = params.toString();
  redirect(`${PATH}${qs ? `?${qs}` : ""}${anchor ? `#${anchor}` : ""}`);
}

/** "Lower, unilateral , DB" → ["lower","unilateral","db"] (max 8, 30 chars each) */
function parseTags(raw: string): string[] {
  const out: string[] = [];
  for (const t of raw.split(",")) {
    const v = t.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 30);
    if (v && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 8);
}

const LOAD_TYPES = ["percent", "rpe", "kg", "bodyweight", "velocity", "none"];
/** Default prescription filled in when this exercise is added to a day. */
function defaults(fd: FormData):
  | { error: string }
  | { default_sets: number | null; default_reps: string | null; default_load_type: string | null; default_load_value: number | null; default_rest_sec: number | null } {
  const setsRaw = String(fd.get("default_sets") ?? "").trim();
  const sets = setsRaw ? Number(setsRaw) : null;
  if (sets !== null && (!Number.isInteger(sets) || sets < 1 || sets > 20)) return { error: "Default sets must be 1–20." };
  const reps = str(fd.get("default_reps"), 20);
  const lt = String(fd.get("default_load_type") ?? "none");
  const type = LOAD_TYPES.includes(lt) ? lt : "none";
  const valRaw = String(fd.get("default_load_value") ?? "").trim().replace(",", ".");
  const val = valRaw && type !== "none" && type !== "bodyweight" ? Number(valRaw) : null;
  if (val !== null && (!Number.isFinite(val) || val < 0 || val > 600)) return { error: "Default load must be a number." };
  const restRaw = String(fd.get("default_rest") ?? "").trim().toLowerCase();
  let rest: number | null = null;
  if (restRaw) {
    const mm = restRaw.match(/^(\d+):(\d{1,2})$/);
    const m = restRaw.match(/^(\d+(?:\.\d+)?)\s*m(in)?s?$/);
    const sec = restRaw.match(/^(\d+)\s*s?(ec)?s?$/);
    rest = mm ? Number(mm[1]) * 60 + Number(mm[2]) : m ? Math.round(Number(m[1]) * 60) : sec ? Number(sec[1]) : NaN;
    if (!Number.isFinite(rest) || rest < 0 || rest > 1800) return { error: "Default rest: try 90s, 2m or 1:30." };
  }
  const any = sets !== null || reps || (type !== "none" && (val !== null || type === "bodyweight")) || rest !== null;
  return {
    default_sets: sets,
    default_reps: reps,
    default_load_type: any ? type : null,
    default_load_value: val,
    default_rest_sec: rest,
  };
}

function fields(fd: FormData) {
  const raw = str(fd.get("name"), 80)?.replace(/\s+/g, " ");
  const name = raw ? titleCase(raw) : null;
  const category = String(fd.get("category") ?? "");
  const measure = String(fd.get("measure") ?? "load");
  const lift = String(fd.get("lift_key") ?? "");
  const videoRaw = str(fd.get("video_url"), 300);
  const video_url = cleanVideoUrl(videoRaw);
  if (!name || name.length < 2) return { error: "Enter a name (2–80 characters)." };
  if (!CATS.includes(category)) return { error: "Pick a category." };
  if (!MEAS.includes(measure)) return { error: "Pick how it's measured." };
  if (videoRaw && !video_url) return { error: "Video link must start with https://" };
  const fieldsPicked = fd.getAll("fields").map(String).filter((f) => (FIELD_KEYS as readonly string[]).includes(f));
  if (fieldsPicked.length > 4) return { error: "Pick up to 4 things to record." };
  const d = defaults(fd);
  if ("error" in d) return { error: d.error };
  const wu = String(fd.get("weight_unit") ?? "kg");
  const du = String(fd.get("distance_unit") ?? "m");
  const su = String(fd.get("speed_unit") ?? "ms");
  return {
    row: {
      fields: fieldsPicked.length ? FIELD_KEYS.filter((k) => fieldsPicked.includes(k)) : null,
      weight_unit: wu === "lb" ? "lb" : "kg",
      distance_unit: ["m", "km", "mi"].includes(du) ? du : "m",
      speed_unit: su === "mph" ? "mph" : su === "kmh" ? "kmh" : "ms",
      name,
      category,
      measure,
      lift_key: KEY.test(lift) ? lift : null,
      video_url,
      cues: str(fd.get("cues"), 1000),
      tags: parseTags(String(fd.get("tags") ?? "")),
      ...d,
    },
  };
}

export async function addExercise(fd: FormData) {
  const supabase = await coachOnly();
  const f = fields(fd);
  if (!f.row) back(f.error);
  const { data, error } = await supabase
    .from("exercises")
    .insert(f.row)
    .select("id")
    .single();
  if (error) back(friendly(error.message, "Couldn't add the exercise."));
  back(undefined, `ex-${data!.id}`);
}

export async function updateExercise(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) back("Exercise not found.");
  const f = fields(fd);
  if (!f.row) back(f.error, `ex-${id}`);
  const { error } = await supabase.from("exercises").update(f.row).eq("id", id);
  back(error ? friendly(error.message) : undefined, `ex-${id}`);
}

export async function setExerciseActive(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) back();
  const active = fd.get("active") === "true";
  const { error } = await supabase.from("exercises").update({ active }).eq("id", id);
  back(error ? friendly(error.message) : undefined, `ex-${id}`);
}

/** Tick several exercises, then move category, add/remove a tag, archive or restore. */
export async function bulkExercises(fd: FormData) {
  const supabase = await coachOnly();
  const ids = fd.getAll("ids").map(String).filter((x) => UUID.test(x));
  const op = String(fd.get("op") ?? "");
  const value = String(fd.get("value") ?? "").trim();
  const q = String(fd.get("q") ?? "");
  if (!ids.length) back("Tick some exercises first.", undefined, q);
  if (op === "category") {
    if (!CATS.includes(value)) back("Pick a category to move them to.", undefined, q);
    const { error } = await supabase.from("exercises").update({ category: value }).in("id", ids);
    if (error) back(friendly(error.message), undefined, q);
  } else if (op === "archive" || op === "restore") {
    const { error } = await supabase.from("exercises").update({ active: op === "restore" }).in("id", ids);
    if (error) back(friendly(error.message), undefined, q);
  } else if (op === "tag_add" || op === "tag_remove") {
    const tag = parseTags(value)[0];
    if (!tag) back("Type the tag.", undefined, q);
    const { data } = await supabase.from("exercises").select("id, tags").in("id", ids);
    for (const e of data ?? []) {
      const cur = (e.tags ?? []) as string[];
      const next = op === "tag_add" ? (cur.includes(tag!) ? cur : [...cur, tag!].slice(0, 8)) : cur.filter((t) => t !== tag);
      if (next.join() !== cur.join()) {
        const { error } = await supabase.from("exercises").update({ tags: next }).eq("id", e.id);
        if (error) back(friendly(error.message), undefined, q);
      }
    }
  } else back("Pick what to do.", undefined, q);
  back(undefined, undefined, q);
}
