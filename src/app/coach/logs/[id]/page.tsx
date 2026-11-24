import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { formatPrescription, itemLabel } from "@/lib/prescription";
import { byBlock, ITEM_COLUMNS, type ItemFields, type ItemLog, type SetLog } from "@/lib/programming/types";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

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
    supabase.from("workout_items").select(`${ITEM_COLUMNS}, exercises(name, measure)`).eq("workout_id", log.workout_id).order("position"),
    supabase.from("set_logs").select("*").eq("log_id", id).order("set_no"),
    supabase.from("item_logs").select("*").eq("log_id", id),
  ]);
  if (!log.coach_seen_at && log.completed_at)
    await supabase.from("workout_logs").update({ coach_seen_at: new Date().toISOString() }).eq("id", id);

  const who = (log.profiles as { full_name: string | null; email: string }).full_name ?? log.profiles.email;
  const w = log.workouts as { id: string; title: string } | null;
  const setList = (sets ?? []) as SetLog[];
  const notes = new Map(((itemLogs ?? []) as ItemLog[]).map((l) => [l.item_id, l]));
  const list = (items ?? []) as unknown as (ItemFields & { exercises: { name: string; measure: string } | null })[];
  const unit: Record<string, string> = { time: "s", distance: "m", calories: "cal" };

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
              const done = setList.filter((s) => s.item_id === it.id);
              const n = notes.get(it.id);
              return (
                <div key={it.id} className="mb-3 last:mb-0">
                  <p className="font-bold">
                    <span className="mr-2 text-brand">{itemLabel(it, blk.length)}</span>
                    {it.kind === "text" ? it.title ?? "Notes" : it.exercises?.name}
                    {it.kind === "text" && <span className="ml-2 text-sm text-muted">{n?.done ? "✓ done" : "not ticked"}</span>}
                  </p>
                  {it.kind === "exercise" && (
                    <>
                      <p className="text-sm text-muted">
                        Prescribed:{" "}
                        {formatPrescription({
                          ...it,
                          percent: it.percent != null ? Number(it.percent) : null,
                          rpe: it.rpe != null ? Number(it.rpe) : null,
                          load_kg: it.load_kg != null ? Number(it.load_kg) : null,
                        }) || "—"}
                      </p>
                      <p className="text-sm">
                        Actual:{" "}
                        {done.length
                          ? done
                              .map((s) =>
                                s.value != null
                                  ? `${Number(s.value)}${unit[it.exercises?.measure ?? ""] ?? ""}`
                                  : `${s.reps ?? "?"}${s.load_kg != null ? ` × ${Number(s.load_kg)}kg` : ""}`,
                              )
                              .join(", ")
                          : <span className="text-warn">nothing logged</span>}
                        {it.sets && done.length > 0 && done.length < it.sets && (
                          <span className="ml-2 text-warn">({done.length}/{it.sets} sets)</span>
                        )}
                      </p>
                    </>
                  )}
                  {n?.comment && <p className="mt-1 rounded-lg bg-surface-2 px-3 py-2 text-sm">“{n.comment}”</p>}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </Screen>
  );
}
