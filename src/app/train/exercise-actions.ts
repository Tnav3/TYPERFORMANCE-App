"use server";
// Data for the exercise pop-up a client sees when they tap an exercise name.
import { signedIn, UUID } from "@/lib/programming/server";
import { loggedSets } from "@/lib/programming/history-data";
import { sessions } from "@/lib/programming/history";
import { rankSimilar, type SimilarInput } from "@/lib/programming/similar";
import { subLabel } from "@/lib/programming/types";

export interface ExerciseCard {
  name: string;
  videoUrl: string | null;
  cues: string | null;
  bestE1rm: { kg: number; date: string } | null;
  bestSet: { kg: number; reps: number; date: string } | null;
  recent: { date: string; sets: string; e1rm: number | null }[];
  totalSessions: number;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export async function exerciseCard(exerciseId: string, athleteId?: string): Promise<{ error?: string; data?: ExerciseCard }> {
  if (!UUID.test(exerciseId) || (athleteId && !UUID.test(athleteId))) return { error: "Not found." };
  const { supabase, user, isCoach } = await signedIn();
  // Clients see their own history; the coach can open it for a client
  const who = athleteId && isCoach ? athleteId : user.id;
  const [{ data: ex }, sets] = await Promise.all([
    supabase.from("exercises").select("name, video_url, cues").eq("id", exerciseId).maybeSingle(),
    loggedSets(supabase, who, exerciseId),
  ]);
  if (!ex) return { error: "Exercise not found." };
  const list = sessions(sets);
  let bestE1rm: ExerciseCard["bestE1rm"] = null;
  let bestSet: ExerciseCard["bestSet"] = null;
  for (const s of list) {
    if (s.bestE1rm != null && (!bestE1rm || s.bestE1rm > bestE1rm.kg)) bestE1rm = { kg: s.bestE1rm, date: s.date };
    for (const x of s.sets)
      if (x.kg && x.reps && (!bestSet || x.kg > bestSet.kg || (x.kg === bestSet.kg && x.reps > bestSet.reps)))
        bestSet = { kg: x.kg, reps: x.reps, date: s.date };
  }
  const recent = list.slice(0, 5).map((s) => ({
    date: s.date,
    sets: s.sets
      .map((x) =>
        x.kg != null && x.reps != null ? `${fmt(x.kg)}×${x.reps}` : x.reps != null ? `${x.reps} reps` : x.value != null ? fmt(x.value) : "✓",
      )
      .join(", "),
    e1rm: s.bestE1rm,
  }));
  return {
    data: {
      name: ex.name,
      videoUrl: ex.video_url,
      cues: ex.cues,
      bestE1rm,
      bestSet,
      recent,
      totalSessions: list.length,
    },
  };
}

export interface SwapOption {
  id: string;
  name: string;
  sub: string | null;
  hasVideo: boolean;
}

/** Swap suggestions: same movement pattern, closest first. With a search, any exercise by name. */
export async function swapOptions(exerciseId: string, reason?: string | null, search?: string): Promise<{ error?: string; data?: { suggested: SwapOption[]; results: SwapOption[] } }> {
  if (!UUID.test(exerciseId)) return { error: "Not found." };
  const { supabase } = await signedIn();
  const cols = "id, name, category, subcategory, tags, measure, video_url";
  const { data: ex } = await supabase.from("exercises").select(cols).eq("id", exerciseId).maybeSingle();
  if (!ex) return { error: "Exercise not found." };
  const term = (search ?? "").trim().slice(0, 60).replace(/[%_,()]/g, " ");
  const [{ data: pool }, { data: found }] = await Promise.all([
    supabase.from("exercises").select(cols).eq("category", ex.category).eq("active", true).limit(400),
    term.length >= 2
      ? supabase.from("exercises").select(cols).eq("active", true).ilike("name", `%${term}%`).order("name").limit(20)
      : Promise.resolve({ data: [] }),
  ]);
  const opt = (e: SimilarInput): SwapOption => ({ id: e.id, name: e.name, sub: subLabel(e.category, e.subcategory), hasVideo: !!e.video_url });
  return {
    data: {
      suggested: rankSimilar(ex as SimilarInput, (pool ?? []) as SimilarInput[], reason).map(opt),
      results: ((found ?? []) as SimilarInput[]).filter((e) => e.id !== exerciseId).map(opt),
    },
  };
}
