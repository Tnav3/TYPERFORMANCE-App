import { formatPrescription, itemLabel } from "@/lib/prescription";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { addDays } from "@/lib/week";
import type { Program } from "@/lib/programming/types";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";
import {
  assignProgram,
  copyWeek,
  deleteProgram,
  openDay,
  swapInProgram,
  updateProgram,
} from "../actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

/** Next Monday (or today if it is Monday) — the usual program start. */
function nextMonday(today: string) {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sun
  return addDays(today, dow === 1 ? 0 : (8 - dow) % 7);
}

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; copied?: string; swapped?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const { error, copied, swapped } = await searchParams;
  const [{ data: program }, { data: days }, { data: clients }, { data: groups }, { data: assigned }] =
    await Promise.all([
      supabase.from("programs").select("*").eq("id", id).maybeSingle<Program>(),
      supabase
        .from("program_days")
        .select("id, week_no, day_no, title, program_items(id, position, kind, exercise_id, title, block, slot, sets, reps, load_type, percent, rpe, load_kg, velocity, exercises(name))")
        .eq("program_id", id),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "athlete")
        .eq("status", "active")
        .order("full_name"),
      supabase.from("groups").select("id, name").eq("archived", false).order("name"),
      supabase
        .from("assignments")
        .select("id, start_date, athlete_id, group_id, profiles(full_name), groups(name)")
        .eq("program_id", id)
        .order("start_date", { ascending: false })
        .limit(10),
    ]);
  if (!program) notFound();
  const { data: allExercises } = await supabase.from("exercises").select("id, name").eq("active", true).order("name");
  const usedMap = new Map<string, string>();
  for (const d of (days ?? []) as unknown as { program_items: { exercise_id: string | null; exercises: { name: string } | null }[] }[])
    for (const i of d.program_items) if (i.exercise_id && i.exercises) usedMap.set(i.exercise_id, i.exercises.name);
  const usedExercises = [...usedMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  type DayRow = {
    id: string;
    week_no: number;
    day_no: number;
    title: string | null;
    program_items: {
      id: string;
      position: number;
      kind: string;
      title: string | null;
      block: string;
      slot: number;
      sets: number | null;
      reps: string | null;
      load_type: string | null;
      percent: number | null;
      rpe: number | null;
      load_kg: number | null;
      velocity: number | null;
      exercises: { name: string } | null;
    }[];
  };
  const byKey = new Map<string, DayRow>();
  for (const d of (days ?? []) as unknown as DayRow[]) {
    d.program_items.sort((a, b) => a.position - b.position);
    byKey.set(`${d.week_no}-${d.day_no}`, d);
  }
  const usedDays = [1, 2, 3, 4, 5, 6, 7].filter((d) => [...byKey.keys()].some((k) => k.endsWith(`-${d}`) && byKey.get(k)!.program_items.length));
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeks = Array.from({ length: program.weeks }, (_, i) => i + 1);
  const today = todayISO();

  return (
    <Screen wide>
      <BackLink href="/coach/programs" label="Programs" />
      <Heading sub={[program.tag, `${program.weeks} weeks`].filter(Boolean).join(" · ")}>
        {program.name}
      </Heading>
      {error && <Alert>{error}</Alert>}
      {copied && <Alert tone="ok">Copied to {copied}.</Alert>}
      {swapped && <Alert tone="ok">Swapped on {swapped} line{swapped === "1" ? "" : "s"}. Sets, reps and progression kept.</Alert>}

      {/* Assign */}
      <details className="mb-6 rounded-2xl border border-line bg-surface p-4" open={(assigned ?? []).length === 0}>
        <summary className="cursor-pointer font-extrabold">Assign to a client or group{(assigned ?? []).length ? ` · used ${(assigned ?? []).length}×` : ""}</summary>
        <div className="mt-3">
        <form action={assignProgram} className="grid gap-2 sm:grid-cols-[1fr_11rem_auto]">
          <input type="hidden" name="program_id" value={program.id} />
          <select name="target" required defaultValue="" className={input} aria-label="Client or group">
            <option value="" disabled>
              Client or group…
            </option>
            {(groups ?? []).length > 0 && (
              <optgroup label="Groups">
                {(groups ?? []).map((g) => (
                  <option key={g.id} value={`g:${g.id}`}>
                    {g.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Clients">
              {(clients ?? []).map((c) => (
                <option key={c.id} value={`a:${c.id}`}>
                  {c.full_name ?? c.email}
                </option>
              ))}
            </optgroup>
          </select>
          <input name="start" type="date" required defaultValue={nextMonday(today)} className={input} aria-label="Start date" />
          <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">
            Assign
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Day 1 lands on the start date. Later edits to this template don&apos;t change workouts already assigned.
        </p>
        {(assigned ?? []).length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {(assigned ?? []).map((a) => {
              const who = a.athlete_id
                ? (a.profiles as unknown as { full_name: string | null } | null)?.full_name
                : (a.groups as unknown as { name: string } | null)?.name;
              const href = a.athlete_id
                ? `/coach/athlete/${a.athlete_id}/program?from=${a.start_date}`
                : `/coach/groups/${a.group_id}?from=${a.start_date}`;
              return (
                <li key={a.id}>
                  <Link href={href} className="underline underline-offset-4">
                    {who ?? "Client"} from {a.start_date}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </details>

      <p className="mb-3 text-xs text-muted">
        Day 1 = the start date (usually a Monday). Tap any day to edit it. {usedDays.length ? `Training days: ${usedDays.map((d) => DAY_NAMES[d - 1]).join(", ")}.` : ""}
      </p>

      {/* Week grid */}
      <div className="space-y-6">
        {weeks.map((w) => (
          <section key={w} id={`week-${w}`} className="scroll-mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Week {w}</h2>
              {w < program.weeks && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted">Copy / progress →</summary>
                  <form action={copyWeek} className="mt-2 space-y-2 rounded-xl border border-line bg-surface p-3">
                    <input type="hidden" name="program_id" value={program.id} />
                    <input type="hidden" name="from" value={w} />
                    <label className="flex items-center gap-2">
                      To week
                      <select name="to" defaultValue={w + 1} className={`${input} !w-20`}>
                        {weeks.filter((x) => x !== w).map((x) => (
                          <option key={x} value={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="progress" defaultChecked className="h-5 w-5 accent-[var(--color-brand)]" />
                      Apply progression
                    </label>
                    <div className="grid grid-cols-4 gap-2 text-xs text-muted">
                      <label>% load<input name="pct" defaultValue="2.5" inputMode="decimal" className={input} /></label>
                      <label>RPE<input name="rpe" defaultValue="0" inputMode="decimal" className={input} /></label>
                      <label>Sets<input name="sets" defaultValue="0" inputMode="numeric" className={input} /></label>
                      <label>kg<input name="kg" defaultValue="0" inputMode="decimal" className={input} /></label>
                    </div>
                    <p className="text-xs text-muted">Replaces whatever is in the target week.</p>
                    <button className={smallBtn}>Copy week {w}</button>
                  </form>
                </details>
              )}
            </div>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[1100px] lg:grid-cols-7">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const day = byKey.get(`${w}-${d}`);
                const items = day?.program_items ?? [];
                const size = new Map<string, number>();
                for (const i of items) size.set(i.block, (size.get(i.block) ?? 0) + 1);
                return (
                  <form key={d} action={openDay} className={items.length ? "" : "hidden sm:block"}>
                    <input type="hidden" name="program_id" value={program.id} />
                    <input type="hidden" name="week" value={w} />
                    <input type="hidden" name="day" value={d} />
                    <button
                      className={`h-full min-h-28 w-full rounded-xl border p-2.5 text-left text-xs transition ${
                        items.length ? "border-line bg-surface hover:border-brand" : "border-dashed border-line/60 text-muted hover:border-muted"
                      }`}
                    >
                      <span className="mb-1 flex items-baseline justify-between gap-1">
                        <span className="font-bold text-text">Day {d} <span className="font-normal text-muted">{DAY_NAMES[d - 1]}</span></span>
                        <span className="text-[10px] text-muted">Edit</span>
                      </span>
                      {items.length ? (
                        <>
                          {day?.title && <span className="mb-1 block font-semibold text-brand">{day.title}</span>}
                          {items.map((i) => (
                            <span key={i.id} className="block leading-snug">
                              <span className="font-bold text-brand">{i.kind === "exercise" ? itemLabel(i, size.get(i.block) ?? 1) : i.block}</span>{" "}
                              <span className="text-text">{i.kind === "text" ? i.title ?? "Notes" : i.exercises?.name}</span>
                              {i.kind === "exercise" && (
                                <span className="block pl-5 text-muted">
                                  {formatPrescription({ ...i, load_type: (i.load_type ?? "none") as never, percent: i.percent != null ? Number(i.percent) : null, rpe: i.rpe != null ? Number(i.rpe) : null, load_kg: i.load_kg != null ? Number(i.load_kg) : null, velocity: i.velocity != null ? Number(i.velocity) : null })}
                                </span>
                              )}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="block">Rest · tap to add</span>
                      )}
                    </button>
                  </form>
                );
              })}
            </div>
            </div>
          </section>
        ))}
      </div>

      {/* Swap */}
      {usedExercises.length > 0 && (
        <details className="mt-8 rounded-2xl border border-line bg-surface p-4">
          <summary className="cursor-pointer font-extrabold">Swap an exercise everywhere</summary>
          <form action={swapInProgram} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="program_id" value={program.id} />
            <select name="from" required defaultValue="" className={input} aria-label="Replace">
              <option value="" disabled>Replace…</option>
              {usedExercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input name="to" list="swap-list" required placeholder="With…" className={input} aria-label="With" />
            <button className={smallBtn}>Swap</button>
            <datalist id="swap-list">
              {(allExercises ?? []).map((e) => <option key={e.id} value={e.name} />)}
            </datalist>
          </form>
          <p className="mt-1 text-xs text-muted">Every week and day of this template. Sets, reps, % and progression stay the same. Already-assigned workouts aren&apos;t changed (swap those from the client&apos;s Program page).</p>
        </details>
      )}

      {/* Details */}
      <details className="mt-8 rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-extrabold">Program details</summary>
        <form action={updateProgram} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={program.id} />
          <input name="name" defaultValue={program.name} maxLength={80} required className={input} aria-label="Name" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-muted">
              Weeks
              <input name="weeks" type="number" min={1} max={52} defaultValue={program.weeks} className={input} />
            </label>
            <label className="text-sm text-muted">
              Tag
              <input name="tag" defaultValue={program.tag ?? ""} maxLength={40} className={input} />
            </label>
          </div>
          <textarea name="description" defaultValue={program.description ?? ""} rows={3} maxLength={2000} placeholder="Description (coach only)" className={`${input} py-2`} />
          <label className="block text-sm text-muted">
            Instructions for clients (optional): how to run it, warm-up, picking loads, missed sessions
            <textarea name="instructions" defaultValue={(program as Program & { instructions?: string | null }).instructions ?? ""} rows={5} maxLength={5000} className={`${input} py-2`} />
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="reveal_weekly" defaultChecked={(program as Program & { reveal_weekly?: boolean }).reveal_weekly} className="h-5 w-5 accent-[var(--color-brand)]" />
            Clients only see one week at a time (the current Monday–Sunday)
          </label>
          <p className="text-xs text-muted">Both are copied when you assign, so set them before assigning.</p>
          <p className="text-xs text-muted">Reducing weeks deletes the days past the new end.</p>
          <button className={smallBtn}>Save details</button>
        </form>
        <form action={deleteProgram} className="mt-6 flex gap-2">
          <input type="hidden" name="id" value={program.id} />
          <input name="confirm" placeholder="Type DELETE" className={input} aria-label="Type DELETE to confirm" />
          <button className={`${smallBtn} !border-brand/60 !text-brand`}>Delete program</button>
        </form>
        <p className="mt-1 text-xs text-muted">Workouts already assigned are kept.</p>
      </details>
    </Screen>
  );
}
