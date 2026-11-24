"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { coachOnly, friendly, int, ISO_DATE, safePath, str, UUID } from "@/lib/programming/server";
import { EMPHASIS } from "@/lib/programming/periodisation";

const EMP = new Set<string>(EMPHASIS.map((e) => e[0]));
const page = (id: string) => `/coach/plan/${id}`;
function go(path: string, error?: string): never {
  revalidatePath(path.split(/[?#]/)[0]);
  redirect(error ? `${path.split("#")[0]}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : path);
}

export async function createSeason(fd: FormData) {
  const supabase = await coachOnly();
  const back = safePath(fd.get("back"), "/coach");
  const [k, id] = String(fd.get("target") ?? "").split(":");
  const name = str(fd.get("name"), 80);
  if (!UUID.test(id ?? "") || !["a", "g"].includes(k)) go(back, "Pick a client or group.");
  if (!name || name.length < 2) go(back, "Name the season (e.g. Road to the title).");
  const { data, error } = await supabase
    .from("seasons")
    .insert({ name, athlete_id: k === "a" ? id : null, group_id: k === "g" ? id : null, goal: str(fd.get("goal"), 500) })
    .select("id")
    .single();
  if (error) go(back, friendly(error.message));
  go(page(data!.id));
}

export async function updateSeason(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) go("/coach");
  const name = str(fd.get("name"), 80);
  if (!name) go(page(id), "Name the season.");
  const { error } = await supabase
    .from("seasons")
    .update({ name, goal: str(fd.get("goal"), 500), notes: str(fd.get("notes"), 2000) })
    .eq("id", id);
  go(page(id), error ? friendly(error.message) : undefined);
}

export async function deleteSeason(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const back = safePath(fd.get("back"), "/coach");
  if (fd.get("confirm") !== "DELETE") go(page(id), "Type DELETE to confirm.");
  if (UUID.test(id)) await supabase.from("seasons").delete().eq("id", id);
  go(back);
}

function phaseRow(fd: FormData) {
  const name = str(fd.get("name"), 60);
  const start = String(fd.get("start_date") ?? "");
  const end = String(fd.get("end_date") ?? "");
  if (!name) return { error: "Name the phase." };
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return { error: "Pick start and end dates." };
  if (end < start) return { error: "The end date is before the start." };
  const lo = int(fd.get("intensity_lo"));
  const hi = int(fd.get("intensity_hi"));
  if (lo != null && hi != null && lo > hi) return { error: "Intensity range is back to front." };
  const pattern = String(fd.get("load_pattern") ?? "3:1");
  const program = String(fd.get("program_id") ?? "");
  return {
    row: {
      name,
      start_date: start,
      end_date: end,
      emphasis: fd.getAll("emphasis").map(String).filter((e) => EMP.has(e)),
      goal: str(fd.get("goal"), 500),
      sessions_per_week: int(fd.get("sessions_per_week")),
      sets_per_week: int(fd.get("sets_per_week")),
      intensity_lo: lo,
      intensity_hi: hi,
      conditioning_min: int(fd.get("conditioning_min")),
      load_pattern: /^[1-8]:[0-2]$/.test(pattern) ? pattern : "3:1",
      program_id: UUID.test(program) ? program : null,
      notes: str(fd.get("notes"), 2000),
    },
  };
}

export async function addPhase(fd: FormData) {
  const supabase = await coachOnly();
  const season = String(fd.get("season_id") ?? "");
  if (!UUID.test(season)) go("/coach");
  const p = phaseRow(fd);
  if (!p.row) go(page(season), p.error);
  const { error } = await supabase.from("phases").insert({ ...p.row, season_id: season });
  go(page(season), error ? friendly(error.message, "Couldn't save. Phases can be up to 26 weeks.") : undefined);
}

export async function updatePhase(fd: FormData) {
  const supabase = await coachOnly();
  const season = String(fd.get("season_id") ?? "");
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(season) || !UUID.test(id)) go("/coach");
  const p = phaseRow(fd);
  if (!p.row) go(`${page(season)}#phase-${id}`, p.error);
  const { error } = await supabase.from("phases").update(p.row).eq("id", id);
  go(`${page(season)}#phase-${id}`, error ? friendly(error.message) : undefined);
}

export async function deletePhase(fd: FormData) {
  const supabase = await coachOnly();
  const season = String(fd.get("season_id") ?? "");
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("phases").delete().eq("id", id);
  go(page(season));
}
