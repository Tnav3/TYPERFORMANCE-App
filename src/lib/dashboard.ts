// Server-side data for the coach dashboard.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, mondayOf } from "./week";
import {
  trafficLight,
  weeklyTotals,
  emptyWeek,
  type Light,
  type SessionLite,
  type WeekTotals,
} from "./load-metrics";
import type { Profile } from "./types";

export interface CheckinLite {
  athlete_id: string;
  week_start: string;
  wellness: number;
  bodyweight_kg: number | string | null;
  niggle: boolean;
  niggle_note: string | null;
}

export interface DashboardRow {
  profile: Profile & { discipline: { name: string } | null };
  light: Light;
  reasons: string[];
  changePct: number | null;
  lastWeek: WeekTotals;
  prevWeek: WeekTotals;
  thisWeek: WeekTotals;
  lastCheckin: CheckinLite | null; // for the last completed week
  latestCheckin: CheckinLite | null; // most recent of this/last week (drives niggle)
  latestBodyweight: number | null;
}

/**
 * The light compares the LAST COMPLETED week with the week before it.
 * (This week is still in progress, so comparing it would always look like a drop.)
 */
export async function getDashboard(supabase: SupabaseClient, todayISO: string) {
  const thisWeek = mondayOf(todayISO);
  const lastWeek = addDays(thisWeek, -7);
  const prevWeek = addDays(thisWeek, -14);
  const since = addDays(thisWeek, -7 * 8); // for latest bodyweight

  const [{ data: profiles }, { data: sessions }, { data: checkins }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*, discipline:disciplines(name)")
        .eq("role", "athlete")
        .order("full_name", { ascending: true, nullsFirst: false }),
      supabase
        .from("training_sessions")
        .select(
          "athlete_id, week_start, discipline_id, session_type_id, duration_min, load_au",
        )
        .in("week_start", [thisWeek, lastWeek, prevWeek]),
      supabase
        .from("weekly_checkins")
        .select(
          "athlete_id, week_start, wellness, bodyweight_kg, niggle, niggle_note",
        )
        .gte("week_start", since)
        .order("week_start", { ascending: false }),
    ]);

  const totals = weeklyTotals((sessions ?? []) as SessionLite[]);
  const cks = (checkins ?? []) as CheckinLite[];
  const all = (profiles ?? []) as DashboardRow["profile"][];

  const rows: DashboardRow[] = all
    .filter((p) => p.status === "active")
    .map((p) => {
      const t = totals.get(p.id);
      const get = (w: string) => t?.get(w) ?? emptyWeek();
      const mine = cks.filter((c) => c.athlete_id === p.id); // newest first
      const latestCheckin =
        mine.find(
          (c) => c.week_start === thisWeek || c.week_start === lastWeek,
        ) ?? null;
      const lastCheckin = mine.find((c) => c.week_start === lastWeek) ?? null;
      const bw = mine.find((c) => c.bodyweight_kg != null)?.bodyweight_kg;
      const tl = trafficLight(
        get(lastWeek).load,
        get(prevWeek).load,
        !!latestCheckin?.niggle,
      );
      return {
        profile: p,
        light: tl.level,
        reasons: tl.reasons,
        changePct: tl.changePct,
        lastWeek: get(lastWeek),
        prevWeek: get(prevWeek),
        thisWeek: get(thisWeek),
        lastCheckin,
        latestCheckin,
        latestBodyweight: bw != null ? Number(bw) : null,
      };
    });

  return {
    rows,
    pending: all.filter((p) => p.status === "pending"),
    inactive: all.filter((p) => p.status === "inactive"),
    weeks: { thisWeek, lastWeek, prevWeek },
  };
}
