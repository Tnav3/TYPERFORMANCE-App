import { folderOptions, type Folder } from "@/lib/programming/folders";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { addDays, mondayOf } from "@/lib/week";
import { ISO_DATE } from "@/lib/programming/patterns";
import type { Workout } from "@/lib/programming/types";
import { statusFor } from "@/components/WorkoutCalendar";
import { PlanCalendar, type PlanWorkout } from "@/components/PlanCalendar";
import { ClientTabs } from "@/components/ClientTabs";
import { formatPrescription, itemLabel } from "@/lib/prescription";
import { SeasonList } from "@/components/SeasonList";
import { Alert, Screen } from "@/components/ui";
import { shiftAssignment, swapInAssignment, unassign, renameAssignment } from "@/app/coach/workouts/actions";
import { createClientBlock, importBlock } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClientProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; d?: string; view?: string; error?: string; removed?: string; swapped?: string; shifted?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const sp = await searchParams;
  const today = todayISO();
  const view = sp.view === "week" ? "week" : "month";
  const anchor = [sp.d, sp.from].find((x) => x && ISO_DATE.test(x)) ?? today;
  const monthKey = anchor.slice(0, 7);
  const from = view === "week" ? mondayOf(anchor) : mondayOf(`${monthKey}-01`);
  const span = view === "week" ? 7 : 42;
  const to = addDays(from, span - 1);
  const days = Array.from({ length: span }, (_, i) => addDays(from, i));

  const [{ data: client }, { data: workouts }, { data: logs }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("id", id).maybeSingle(),
      supabase.rpc("client_workouts", { p_athlete: id, p_from: from, p_to: to }),
      supabase
        .from("workout_logs")
        .select("workout_id, completed_at")
        .eq("athlete_id", id)
        .gte("workout_date", from)
        .lte("workout_date", to),
    ]);
  if (!client) notFound();
  const wl = (workouts ?? []) as Workout[];
  const { data: folderRows } = await supabase.from("program_folders").select("id, name, parent_id, sort_order");
  const folderLabel = new Map(folderOptions((folderRows ?? []) as Folder[]).map((o) => [o.id, o.label]));
  const [{ data: progs }, { data: items }] = await Promise.all([
    supabase.from("programs").select("id, name, weeks, is_master, folder_id").eq("archived", false).order("is_master", { ascending: false }).order("name"),
    view === "week" && wl.length
      ? supabase
          .from("workout_items")
          .select("workout_id, position, block, slot, kind, title, sets, reps, load_type, percent, rpe, load_kg, velocity, exercises(name)")
          .in("workout_id", wl.map((w) => w.id))
          .order("position")
      : Promise.resolve({ data: [] as never[] }),
  ]);
  type Line = { workout_id: string; position: number; block: string; slot: number; kind: string; title: string | null; sets: number | null; reps: string | null; load_type: string | null; percent: number | null; rpe: number | null; load_kg: number | null; velocity: number | null; exercises: { name: string } | null };
  const lines = new Map<string, string[]>();
  const rowsBy = new Map<string, Line[]>();
  for (const it of (items ?? []) as unknown as Line[]) rowsBy.set(it.workout_id, [...(rowsBy.get(it.workout_id) ?? []), it]);
  for (const [wid, list] of rowsBy) {
    const size = new Map<string, number>();
    for (const it of list) size.set(it.block, (size.get(it.block) ?? 0) + 1);
    lines.set(
      wid,
      list.map((it) =>
        it.kind === "exercise"
          ? `${itemLabel(it, size.get(it.block) ?? 1)} ${it.exercises?.name ?? "Exercise"} ${formatPrescription(it as never)}`.trim()
          : `${it.block} ${it.title ?? "Note"}`,
      ),
    );
  }
  const logBy = new Map((logs ?? []).map((l) => [l.workout_id, l]));
  const name = client.full_name ?? client.email;
  const base = `/coach/athlete/${id}/program`;
  const back = `${base}?view=${view}&d=${anchor}`;
  const step = (n: number) =>
    view === "week" ? addDays(from, 7 * n) : (() => { const [y, m] = monthKey.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return t.toISOString().slice(0, 10); })();
  const fmtL = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-AU", { ...o, timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));
  const nav = {
    prev: `${base}?view=${view}&d=${step(-1)}`,
    next: `${base}?view=${view}&d=${step(1)}`,
    today: `${base}?view=${view}&d=${today}`,
    week: `${base}?view=week&d=${view === "month" ? (monthKey === today.slice(0, 7) ? today : `${monthKey}-01`) : anchor}`,
    month: `${base}?view=month&d=${anchor}`,
    label: view === "week" ? `${fmtL(from, { day: "numeric", month: "short" })} – ${fmtL(to, { day: "numeric", month: "short", year: "numeric" })}` : fmtL(`${monthKey}-01`, { month: "long", year: "numeric" }),
  };
  const planWorkouts: PlanWorkout[] = wl.map((w) => ({
    id: w.id,
    date: w.workout_date,
    title: w.title,
    status: statusFor(w.workout_date, today, logBy.get(w.id)),
    group: !!w.group_id,
    note: w.group_id ? "Group workout" : w.overrides_id ? "Personalised" : undefined,
    lines: lines.get(w.id) ?? [],
  }));

  return (
    <Screen wide>
      <ClientTabs id={id} name={name} active="program" />
      {sp.error && <Alert>{sp.error}</Alert>}
      {sp.swapped && <Alert tone="ok">Swapped on {sp.swapped} upcoming line{sp.swapped === "1" ? "" : "s"}.</Alert>}
      {sp.shifted && <Alert tone="ok">Moved {sp.shifted} upcoming workout{sp.shifted === "1" ? "" : "s"}. Logged ones stayed put.</Alert>}
      {sp.removed && <Alert tone="ok">Removed {sp.removed} upcoming workouts. Past and logged ones are kept.</Alert>}

      <PlanCalendar
        athleteId={id}
        view={view}
        days={days}
        month={view === "month" ? monthKey : undefined}
        today={today}
        workouts={planWorkouts}
        programs={(progs ?? []).map((p) => ({ id: p.id, name: p.name, weeks: p.weeks, master: !!p.is_master, folder: p.folder_id ? folderLabel.get(p.folder_id) ?? null : null }))}
        back={back}
        nav={nav}
      />

    </Screen>
  );
}
