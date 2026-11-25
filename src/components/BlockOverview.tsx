// Coach's block overview for one client (TrainHeroic-style): pick a block, see every week
// as a row and every day as a column, with each workout's exercises listed. Click a
// workout to edit that one day; block-wide tools (rename, move, swap) sit in the header.
import Link from "next/link";
import { Printer } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, mondayOf } from "@/lib/week";
import { formatDate } from "@/lib/dates";
import { formatPrescription, formatSetPlan, itemLabel } from "@/lib/prescription";
import { addBlockDay, renameAssignment, setBlockLength, shiftAssignment, swapInAssignment, unassign } from "@/app/coach/workouts/actions";

type Assignment = { id: string; program_name: string; start_date: string };
type W = { id: string; workout_date: string; title: string };
type Item = {
  workout_id: string; kind: string; block: string; slot: number; position: number; exercise_id: string | null; title: string | null;
  sets: number | null; reps: string | null; load_type: string | null; percent: number | null; rpe: number | null; load_kg: number | null;
  set_plan: { r: string; p?: number; e?: number; k?: number }[] | null; exercises: { name: string } | null;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const input = "min-h-10 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-sm text-text";

function lineText(i: Item) {
  const rx = i.set_plan?.length
    ? formatSetPlan(i.set_plan)
    : formatPrescription({ sets: i.sets, reps: i.reps, load_type: i.load_type as never, percent: i.percent != null ? Number(i.percent) : null, rpe: i.rpe != null ? Number(i.rpe) : null, load_kg: i.load_kg != null ? Number(i.load_kg) : null, rest_sec: null, tempo: null });
  return rx;
}

export async function BlockOverview({
  supabase,
  athleteId,
  assignments,
  selected,
  today,
  back,
}: {
  supabase: SupabaseClient;
  athleteId: string;
  assignments: Assignment[];
  selected?: string;
  today: string;
  back: string;
}) {
  if (!assignments.length)
    return (
      <section id="overview" className="mb-6 rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">
        No blocks yet. Build or import one below and it shows here week by week.
      </section>
    );

  // Date range of every block (from its workouts), to label current / next / done
  const ids = assignments.map((a) => a.id);
  const { data: allW } = await supabase.from("workouts").select("assignment_id, workout_date").eq("athlete_id", athleteId).in("assignment_id", ids);
  const range = new Map<string, { from: string; to: string }>();
  for (const w of allW ?? []) {
    const r = range.get(w.assignment_id as string);
    const d = w.workout_date as string;
    range.set(w.assignment_id as string, r ? { from: d < r.from ? d : r.from, to: d > r.to ? d : r.to } : { from: d, to: d });
  }
  const status = (a: Assignment) => {
    const r = range.get(a.id) ?? { from: a.start_date, to: a.start_date };
    return today < r.from ? "next" : today > r.to ? "done" : "current";
  };
  const ordered = [...assignments].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const pick =
    assignments.find((a) => a.id === selected) ??
    ordered.find((a) => status(a) === "current") ??
    ordered.find((a) => status(a) === "next") ??
    ordered[ordered.length - 1];
  const r = range.get(pick.id) ?? { from: pick.start_date, to: pick.start_date };

  const [{ data: ws }, { data: logs }] = await Promise.all([
    supabase.from("workouts").select("id, workout_date, title").eq("assignment_id", pick.id).eq("athlete_id", athleteId).order("workout_date").order("position"),
    supabase.from("workout_logs").select("workout_id, completed_at").eq("athlete_id", athleteId).gte("workout_date", r.from).lte("workout_date", r.to),
  ]);
  const workouts = (ws ?? []) as W[];
  const { data: itemRows } = workouts.length
    ? await supabase
        .from("workout_items")
        .select("workout_id, kind, block, slot, position, exercise_id, title, sets, reps, load_type, percent, rpe, load_kg, set_plan, exercises(name)")
        .in("workout_id", workouts.map((w) => w.id))
        .order("position")
    : { data: [] };
  const items = (itemRows ?? []) as unknown as Item[];
  const byWorkout = new Map<string, Item[]>();
  for (const i of items) byWorkout.set(i.workout_id, [...(byWorkout.get(i.workout_id) ?? []), i]);
  const done = new Map((logs ?? []).map((l) => [l.workout_id as string, !!l.completed_at]));

  const firstMon = mondayOf(r.from);
  const usedWeeks = Math.max(1, Math.floor((Date.parse(mondayOf(r.to)) - Date.parse(firstMon)) / 604800000) + 1);
  // One spare week after the last so the block can be extended; an empty block gets one to start in.
  const weekCount = workouts.length ? usedWeeks : 1;
  const gridWeeks = workouts.length ? usedWeeks + 1 : 1;
  const curWeek = today >= r.from && today <= addDays(r.to, 6) ? Math.floor((Date.parse(mondayOf(today)) - Date.parse(firstMon)) / 604800000) + 1 : null;
  const byDate = new Map<string, W[]>();
  for (const w of workouts) byDate.set(w.workout_date, [...(byDate.get(w.workout_date) ?? []), w]);

  // Exercises in this block, for the swap form
  const exInBlock = [...new Map(items.filter((i) => i.exercise_id && i.exercises).map((i) => [i.exercise_id!, i.exercises!.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const upcoming = workouts.filter((w) => w.workout_date >= today && !done.get(w.id));
  const tag = { current: "Current", next: "Up next", done: "Finished" } as const;

  const Card = ({ w }: { w: W }) => {
    const its = byWorkout.get(w.id) ?? [];
    const sizes = new Map<string, number>();
    for (const i of its) sizes.set(i.block, (sizes.get(i.block) ?? 0) + 1);
    const state = done.get(w.id) ? "done" : w.workout_date < today ? "missed" : "planned";
    return (
      <Link
        href={`/coach/workouts/${w.id}?ret=programming&block=${pick.id}`}
        className={`block rounded-xl border bg-surface p-2 text-left transition hover:border-brand ${state === "done" ? "border-ok/50" : state === "missed" ? "border-brand/50" : "border-line"}`}
      >
        <p className="flex items-center gap-1.5 text-xs font-black uppercase leading-tight">
          <span className={`h-2 w-2 shrink-0 rounded-full ${state === "done" ? "bg-ok" : state === "missed" ? "bg-brand" : "bg-text/50"}`} />
          <span className="truncate">{w.title}</span>
        </p>
        <ul className="mt-1 space-y-0.5">
          {its.slice(0, 7).map((i, k) => (
            <li key={k} className="text-[11px] leading-snug">
              {i.kind === "exercise" ? (
                <>
                  <span className="font-bold text-muted">{itemLabel(i, sizes.get(i.block) ?? 1)} </span>
                  <span className="font-semibold">{i.exercises?.name ?? "Exercise"}</span>
                  <span className="block text-muted">{lineText(i)}</span>
                </>
              ) : (
                <span className="italic text-muted">{i.title}</span>
              )}
            </li>
          ))}
          {its.length > 7 && <li className="text-[11px] font-bold text-muted">+{its.length - 7} more</li>}
          {its.length === 0 && <li className="text-[11px] text-muted">Empty: tap to add exercises</li>}
        </ul>
      </Link>
    );
  };

  const blockBack = `${back}?block=${pick.id}`;
  const AddDay = ({ date, wide }: { date: string; wide?: boolean }) =>
    date < today ? null : (
      <form action={addBlockDay}>
        <input type="hidden" name="assignment_id" value={pick.id} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="back" value={blockBack} />
        <button
          aria-label={`Add a day on ${formatDate(date)}`}
          className={`flex w-full items-center justify-center rounded-lg border border-dashed border-line text-muted transition hover:border-brand hover:text-brand ${wide ? "min-h-10 text-xs font-bold" : "min-h-14 text-lg"}`}
        >
          {wide ? `+ ${DAYS[(new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7]} ${formatDate(date)}` : "+"}
        </button>
      </form>
    );

  return (
    <section id="overview" className="mb-6 scroll-mt-4">
      {/* Block picker */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {ordered.map((a) => {
          const st = status(a);
          const on = a.id === pick.id;
          return (
            <Link
              key={a.id}
              href={`${back}?block=${a.id}#overview`}
              scroll={false}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left ${on ? "border-brand bg-brand/10" : "border-line bg-surface"}`}
            >
              <span className={`block text-[10px] font-black uppercase tracking-widest ${st === "current" ? "text-brand" : "text-muted"}`}>{tag[st]}</span>
              <span className="block max-w-[14rem] truncate text-sm font-extrabold">{a.program_name}</span>
              <span className="block text-[11px] text-muted">{formatDate((range.get(a.id) ?? { from: a.start_date }).from)}</span>
            </Link>
          );
        })}
      </div>

      {/* Block header + tools */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="min-w-0">
          <p className={`text-xs font-black uppercase tracking-widest ${status(pick) === "current" ? "text-brand" : "text-muted"}`}>{tag[status(pick)]} block</p>
          <h2 className="truncate text-xl font-black uppercase">{pick.program_name}</h2>
          <p className="text-sm text-muted">
            {formatDate(r.from)} to {formatDate(r.to)} · {weekCount} week{weekCount === 1 ? "" : "s"}
            {curWeek ? ` · now in week ${curWeek}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {workouts.length > 0 && (
            <Link
              href={`/coach/athlete/${athleteId}/programming/print?block=${pick.id}`}
              target="_blank"
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 font-bold"
              title="Print or save as PDF for a physio or email"
            >
              <Printer size={16} aria-hidden /> PDF
            </Link>
          )}
          <details data-popover className="relative">
            <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-xl border border-line bg-surface-2 px-3 font-bold">Swap an exercise</summary>
            <div className="absolute right-0 z-30 mt-2 w-[min(92vw,380px)] rounded-2xl border border-line bg-surface p-3 shadow-2xl">
              <form action={swapInAssignment} className="space-y-2">
                <input type="hidden" name="assignment_id" value={pick.id} />
                <input type="hidden" name="back" value={`${back}?block=${pick.id}`} />
                <select name="from" required defaultValue="" className={input} aria-label="Replace">
                  <option value="" disabled>Replace…</option>
                  {exInBlock.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                </select>
                <input name="to" list="swap-ex" required placeholder="With…" className={input} aria-label="With" />
                <select name="workout_id" defaultValue="" className={input} aria-label="Where">
                  <option value="">Every upcoming day in this block</option>
                  {upcoming.map((w) => <option key={w.id} value={w.id}>Only {formatDate(w.workout_date)} · {w.title}</option>)}
                </select>
                <button className="min-h-10 w-full rounded-xl bg-brand font-extrabold uppercase text-white">Swap</button>
                <p className="text-[11px] text-muted">Logged workouts never change. To edit anything else on one day, tap that day below.</p>
              </form>
            </div>
          </details>
          {workouts.length > 0 && (
            <details data-popover className="relative">
              <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-xl border border-line bg-surface-2 px-3 font-bold">
                Length · {weekCount} wk{weekCount === 1 ? "" : "s"}
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-[min(92vw,340px)] rounded-2xl border border-line bg-surface p-3 shadow-2xl">
                <form action={setBlockLength} className="space-y-2">
                  <input type="hidden" name="assignment_id" value={pick.id} />
                  <input type="hidden" name="back" value={blockBack} />
                  <label className="flex items-center justify-between gap-3 text-sm font-bold">
                    Run this block for
                    <select name="weeks" defaultValue={weekCount} className={`${input} !w-28`} aria-label="Weeks">
                      {Array.from({ length: Math.max(16, weekCount + 8) }, (_, k) => k + 1).map((n) => (
                        <option key={n} value={n}>{n} week{n === 1 ? "" : "s"}</option>
                      ))}
                    </select>
                  </label>
                  <button className="min-h-10 w-full rounded-xl bg-brand font-extrabold uppercase text-white">Set length</button>
                  <p className="text-[11px] leading-snug text-muted">
                    Longer copies week {weekCount} into each new week, so tweak the loads after. Shorter removes upcoming days past the new end. Logged sessions never change.
                  </p>
                </form>
              </div>
            </details>
          )}
          <details data-popover className="relative">
            <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-xl border border-line bg-surface-2 px-3 font-bold">Move / rename</summary>
            <div className="absolute right-0 z-30 mt-2 w-[min(92vw,340px)] space-y-3 rounded-2xl border border-line bg-surface p-3 shadow-2xl">
              <form action={renameAssignment} className="flex gap-1">
                <input type="hidden" name="assignment_id" value={pick.id} />
                <input type="hidden" name="back" value={`${back}?block=${pick.id}`} />
                <input name="name" defaultValue={pick.program_name} required minLength={2} maxLength={60} className={input} aria-label="Block name" />
                <button className="min-h-10 shrink-0 rounded-xl bg-brand px-3 text-xs font-extrabold text-white">Rename</button>
              </form>
              <div>
                <p className="mb-1 text-xs text-muted">Move what&apos;s left (logged days stay put)</p>
                <div className="flex flex-wrap gap-1.5">
                  {[[-7, "−1 week"], [-1, "−1 day"], [1, "+1 day"], [7, "+1 week"]].map(([d, l]) => (
                    <form key={d} action={shiftAssignment}>
                      <input type="hidden" name="assignment_id" value={pick.id} />
                      <input type="hidden" name="back" value={`${back}?block=${pick.id}`} />
                      <input type="hidden" name="from" value={today} />
                      <input type="hidden" name="days" value={d} />
                      <button className="min-h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-xs font-bold">{l}</button>
                    </form>
                  ))}
                </div>
              </div>
              <form action={unassign}>
                <input type="hidden" name="assignment_id" value={pick.id} />
                <input type="hidden" name="back" value={back} />
                <button className="text-xs font-bold text-brand underline underline-offset-4">Remove upcoming workouts of this block</button>
              </form>
            </div>
          </details>
        </div>
      </div>

      {!workouts.length && (
        <p className="mb-3 rounded-xl border border-dashed border-brand/50 bg-brand/5 p-3 text-sm">
          This block has no days yet. Tap <b>+</b> on a day to add a session, then add exercises. Copy weeks forward from inside the day once week 1 is built.
        </p>
      )}

      {/* Weeks × days */}
      <div className="overflow-x-auto">
        <div className="hidden min-w-[900px] md:block">
          <div className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] gap-1.5 px-1 pb-1 text-center text-[11px] font-black uppercase tracking-widest text-muted">
            <span />
            {DAYS.map((d) => <span key={d}>{d}</span>)}
          </div>
          {Array.from({ length: gridWeeks }, (_, wk) => {
            const mon = addDays(firstMon, wk * 7);
            const isCur = curWeek === wk + 1;
            const spare = wk >= weekCount;
            return (
              <div key={wk} className={`mb-1.5 ${spare ? "opacity-70 hover:opacity-100" : ""} grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] gap-1.5 rounded-xl p-1 ${isCur ? "bg-brand/10 ring-1 ring-brand/40" : ""}`}>
                <div className="pt-1 text-xs">
                  <p className={`font-black uppercase ${isCur ? "text-brand" : ""}`}>Week {wk + 1}</p>
                  <p className="text-[10px] text-muted">{spare ? "Add a week" : formatDate(mon)}</p>
                </div>
                {DAYS.map((_, d) => {
                  const date = addDays(mon, d);
                  const list = byDate.get(date) ?? [];
                  return (
                    <div key={d} className={`min-h-16 space-y-1.5 rounded-lg ${date === today ? "outline outline-1 outline-brand/60" : ""}`}>
                      {list.map((w) => <Card key={w.id} w={w} />)}
                      {list.length === 0 && <AddDay date={date} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phone: week by week, training days only */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: gridWeeks }, (_, wk) => {
          const mon = addDays(firstMon, wk * 7);
          const isCur = curWeek === wk + 1;
          const days = DAYS.map((_, d) => addDays(mon, d)).filter((d) => byDate.has(d));
          const free = DAYS.map((_, d) => addDays(mon, d)).filter((d) => !byDate.has(d) && d >= today);
          return (
            <details key={wk} open={isCur || (!curWeek && wk === 0) || !workouts.length} className={`rounded-2xl border p-3 ${isCur ? "border-brand/60 bg-brand/5" : "border-line bg-surface"}`}>
              <summary className="cursor-pointer list-none font-black uppercase">
                <span className={isCur ? "text-brand" : ""}>Week {wk + 1}</span>
                <span className="ml-2 text-xs font-normal normal-case text-muted">{formatDate(mon)} · {days.length} session{days.length === 1 ? "" : "s"}{isCur ? " · this week" : ""}</span>
              </summary>
              <div className="mt-2 space-y-2">
                {days.map((d) => (
                  <div key={d}>
                    <p className={`mb-1 text-[11px] font-black uppercase tracking-widest ${d === today ? "text-brand" : "text-muted"}`}>{DAYS[(new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7]} {formatDate(d)}</p>
                    <div className="space-y-1.5">{(byDate.get(d) ?? []).map((w) => <Card key={w.id} w={w} />)}</div>
                  </div>
                ))}
                {free.length > 0 && (
                  <details className="rounded-xl border border-dashed border-line p-2">
                    <summary className="cursor-pointer list-none text-xs font-bold text-muted">+ Add a day this week</summary>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">{free.map((d) => <AddDay key={d} date={d} wide />)}</div>
                  </details>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
