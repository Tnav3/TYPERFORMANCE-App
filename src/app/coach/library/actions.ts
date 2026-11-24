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
