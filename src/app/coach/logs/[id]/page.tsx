import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { formatPrescription, itemLabel } from "@/lib/prescription";
import { byBlock, ITEM_COLUMNS, SWAP_REASONS, type ItemFields, type ItemLog, type SetLog } from "@/lib/programming/types";
import { halaxySummary, type HalaxyLine } from "@/lib/programming/halaxy";
import { CopyText } from "@/components/CopyText";
import { BackLink, Card, Heading, Screen } from "@/components/ui";
import { DEFAULT_UNITS, describeSet, fieldsFor, type Units } from "@/lib/programming/fields";

export const dynamic = "force-dynamic";

export default async function CoachLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const { data: log } = await supabase
    .from("workout_logs")
    .select("*, profiles(full_name, email), workouts(id, title, notes)")
    .eq("id", id)
    .maybeSingle();
  if (!log) notFound();
  const [{ data: items }, { data: sets }, { data: itemLogs }] = await Promise.all([
    supabase.from("workout_items").select(`${ITEM_COLUMNS}, exercises(name, measure, fields, weight_unit, distance_unit, speed_unit)`).eq("workout_id", log.workout_id).order("position"),
    supabase.from("set_logs").select("*").eq("log_id", id).order("set_no"),
    supabase.from("item_logs").select("*").eq("log_id", id),
  ]);
  const { data: ready } = await supabase
    .from("readiness")
    .select("score, sleep, energy, soreness, stress, motivation, sleep_hours")
    .eq("athlete_id", log.athlete_id)
    .eq("checked_on", log.workout_date)
    .maybeSingle();
  if (!log.coach_seen_at && log.completed_at)
    await supabase.from("workout_logs").update({ coach_seen_at: new Date().toISOString() }).eq("id", id);

  const who = (log.profiles as { full_name: string | null; email: string }).full_name ?? log.profiles.email;
  const w = log.workouts as { id: string; title: string } | null;
  const setList = (sets ?? []) as SetLog[];
  const notes = new Map(((itemLogs ?? []) as ItemLog[]).map((l) => [l.item_id, l]));
  const list = (items ?? []) as unknown as (ItemFields & { exercises: { name: string; measure: string; fields?: string[] | null } | null })[];
  const swapIds = [...notes.values()].map((n) => n.swap_exercise_id).filter((x): x is string => !!x);
  const { data: swapRows } = swapIds.length
    ? await supabase.from("exercises").select("id, name, measure, fields, weight_unit, distance_unit, speed_unit").in("id", swapIds)
    : { data: [] };
  const swapEx = new Map((swapRows ?? []).map((e) => [e.id as string, e]));
  const reasonLabel = (r: string | null | undefined) => SWAP_REASONS.find((x) => x[0] === r)?.[1] ?? null;
  /** The exercise actually done (swap if any) and how each logged set reads. */
  const detail = (it: (typeof list)[number], blkLen: number) => {
    const n = notes.get(it.id);
    const swapped = n?.swap_exercise_id ? swapEx.get(n.swap_exercise_id) : null;
    const ex = (swapped ?? it.exercises ?? { measure: "load" }) as { name?: string; measure: string; fields?: string[] | null };
    const u = { ...DEFAULT_UNITS, ...Object.fromEntries(Object.entries(ex).filter(([k, v]) => k.endsWith("_unit") && v)) } as Units;
    const done = setList.filter((x) => x.item_id === it.id);
    const actual = done.map(
      (x) =>
        describeSet(
          { reps: x.reps, load_kg: x.load_kg != null ? Number(x.load_kg) : null, value: x.value != null ? Number(x.value) : null, metrics: x.metrics ?? {} },
          fieldsFor(ex, it),
          u,
        ) || "done",
    );
    const prescribed =
      formatPrescription({
        ...it,
        percent: it.percent != null ? Number(it.percent) : null,
        rpe: it.rpe != null ? Number(it.rpe) : null,
        load_kg: it.load_kg != null ? Number(it.load_kg) : null,
        velocity: it.velocity != null ? Number(it.velocity) : null,
      }) || "";
    return {
      label: itemLabel(it, blkLen),
      name: it.kind === "text" ? it.title ?? "Notes" : (swapped?.name as string | undefined) ?? it.exercises?.name ?? "Exercise",
      swappedFrom: swapped ? it.exercises?.name ?? null : null,
      swapReason: swapped ? reasonLabel(n?.swap_reason) : null,
      swapNote: swapped ? n?.swap_note ?? null : null,
      prescribed,
      actual,
      setsPlanned: it.sets,
      comment: n?.comment ?? null,
      text: it.kind === "text",
      done: !!n?.done,
    };
  };
  const halaxyLines: HalaxyLine[] = byBlock(list).flatMap(([, blk]) => blk.map((it) => detail(it, blk.length)));
  // Hidden timer (migration 067): first entry to first finish. Ignore anything over 5 hours (left open overnight).
  const trackedRaw = log.first_completed_at ? (Date.parse(log.first_completed_at) - Date.parse(log.created_at)) / 60000 : null;
  const tracked = trackedRaw != null && trackedRaw >= 1 && trackedRaw <= 300 ? Math.round(trackedRaw) : null;
  const summaryText = halaxySummary({
    date: new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(log.workout_date + "T00:00:00Z")),
    title: w?.title ?? "Workout",
    rpe: log.completed_at ? log.session_rpe : null,
    minutes: log.completed_at ? log.duration_min : null,
    readiness: ready?.score ?? null,
    lines: halaxyLines,
    comment: log.comment,
  });

  return (
    <Screen wide>
      <BackLink href="/coach/feed" label="Feed" />
      <Heading
        sub={`${formatDate(log.workout_date)} · ${log.completed_at ? `RPE ${log.session_rpe} · ${log.duration_min} min · load ${log.session_rpe * log.duration_min}` : "in progress"}`}
      >
        {who}: {w?.title ?? "Workout"}
      </Heading>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href={`/coach/athlete/${log.athlete_id}/program?from=${log.workout_date}`} className="underline underline-offset-4">Calendar</Link>
        <Link href={`/coach/athlete/${log.athlete_id}/progress`} className="underline underline-offset-4">Progress</Link>
        <Link href={`/coach/chat/${log.athlete_id}`} className="font-bold text-brand">Reply in chat →</Link>
        {w && <Link href={`/coach/workouts/${w.id}`} className="underline underline-offset-4">Edit workout</Link>}
      </div>
      {tracked != null && (
        <p className="mb-3 text-sm text-muted" title="Only you see this">
          ⏱ Tracked time <b className="text-text">{tracked} min</b> (first entry → finished)
          {log.duration_min != null && Math.abs(tracked - log.duration_min) >= 10 && <> · they entered {log.duration_min} min</>}
          <span className="ml-1 text-xs">· coach only</span>
        </p>
      )}
      <div className="mb-4 lg:max-w-xl">
        <CopyText text={summaryText} label="Copy for Halaxy (SOAP plan)" />
      </div>
      {ready && (
        <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${ready.score >= 70 ? "border-ok/50" : ready.score >= 50 ? "border-warn/50" : "border-brand/50"}`}>
          <span className="font-black">Readiness {ready.score}</span> · sleep {ready.sleep}/5
          {ready.sleep_hours != null && ` (${Number(ready.sleep_hours)} h)`} · energy {ready.energy}/5 · soreness {ready.soreness}/5 · stress{" "}
          {ready.stress}/5 · motivation {ready.motivation}/5
        </p>
      )}
      {log.comment && (
        <Card className="mb-4 !p-4">
          <p className="text-xs uppercase tracking-widest text-muted">Their comment</p>
          <p className="mt-1 whitespace-pre-line">{log.comment}</p>
        </Card>
      )}
      <div className="space-y-3">
        {byBlock(list).map(([letter, blk]) => (
          <section key={letter} className="rounded-2xl border border-line bg-surface p-3">
            {blk.map((it) => {
              const d = detail(it, blk.length);
              return (
                <div key={it.id} className="mb-3 last:mb-0">
                  <p className="font-bold">
                    <span className="mr-2 text-brand">{d.label}</span>
                    {d.name}
                    {d.text && <span className="ml-2 text-sm text-muted">{d.done ? "✓ done" : "not ticked"}</span>}
                  </p>
                  {d.swappedFrom && (
                    <p className="text-xs">
                      <span className="rounded-md bg-warn/15 px-1.5 py-0.5 font-bold text-warn">Swapped</span>{" "}
                      <span className="text-muted">for {d.swappedFrom}{d.swapReason && ` · ${d.swapReason}`}{d.swapNote && ` · “${d.swapNote}”`}</span>
                    </p>
                  )}
                  {!d.text && (
                    <>
                      <p className="text-sm text-muted">Prescribed: {d.prescribed || "—"}</p>
                      <p className="text-sm">
                        Actual: {d.actual.length ? d.actual.join(", ") : <span className="text-warn">nothing logged</span>}
                        {d.setsPlanned && d.actual.length > 0 && d.actual.length < d.setsPlanned && (
                          <span className="ml-2 text-warn">({d.actual.length}/{d.setsPlanned} sets)</span>
                        )}
                      </p>
                    </>
                  )}
                  {d.comment && <p className="mt-1 rounded-lg bg-surface-2 px-3 py-2 text-sm">“{d.comment}”</p>}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </Screen>
  );
}
