import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { addDays } from "@/lib/week";
import { planned } from "@/lib/planned-fights";
import { EMPHASIS, PHASE_TEMPLATES, phaseWeeks, weeksOut } from "@/lib/programming/periodisation";
import { SeasonTimeline, type PhaseRow } from "@/components/SeasonTimeline";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { addPhase, deletePhase, deleteSeason, updatePhase, updateSeason } from "../actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

type Phase = PhaseRow & {
  goal: string | null;
  sessions_per_week: number | null;
  sets_per_week: number | null;
  intensity_lo: number | null;
  intensity_hi: number | null;
  conditioning_min: number | null;
  program_id: string | null;
  notes: string | null;
};

function PhaseFields({ p, programs, start }: { p?: Phase; programs: { id: string; name: string }[]; start?: string }) {
  return (
    <div className="space-y-2">
      <input name="name" list="phase-names" defaultValue={p?.name} required maxLength={60} placeholder="Phase name, e.g. Max Strength" className={input} aria-label="Phase name" />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">Start<input type="date" name="start_date" required defaultValue={p?.start_date ?? start} className={input} /></label>
        <label className="text-xs text-muted">End<input type="date" name="end_date" required defaultValue={p?.end_date ?? (start ? addDays(start, 27) : undefined)} className={input} /></label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EMPHASIS.map(([k, label, color]) => (
          <label key={k} className="cursor-pointer">
            <input type="checkbox" name="emphasis" value={k} defaultChecked={p?.emphasis.includes(k)} className="peer sr-only" />
            <span className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs font-bold text-muted peer-checked:text-white" style={{ ["--c" as string]: color }}>
              <span className="mr-1.5 h-2 w-2 rounded-full" style={{ background: color }} />
              {label}
            </span>
          </label>
        ))}
      </div>
      <p className="-mt-1 text-[11px] text-muted">The first ticked emphasis sets the phase colour.</p>
      <input name="goal" defaultValue={p?.goal ?? ""} maxLength={500} placeholder="Goal (e.g. raise trap bar e1RM 10%)" className={input} aria-label="Goal" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-xs text-muted">Sessions/wk<input name="sessions_per_week" inputMode="numeric" defaultValue={p?.sessions_per_week ?? ""} className={input} /></label>
        <label className="text-xs text-muted">Hard sets/wk<input name="sets_per_week" inputMode="numeric" defaultValue={p?.sets_per_week ?? ""} className={input} /></label>
        <label className="text-xs text-muted">%1RM from<input name="intensity_lo" inputMode="numeric" defaultValue={p?.intensity_lo ?? ""} className={input} /></label>
        <label className="text-xs text-muted">%1RM to<input name="intensity_hi" inputMode="numeric" defaultValue={p?.intensity_hi ?? ""} className={input} /></label>
        <label className="text-xs text-muted">Conditioning min/wk<input name="conditioning_min" inputMode="numeric" defaultValue={p?.conditioning_min ?? ""} className={input} /></label>
        <label className="text-xs text-muted">Load : deload
          <select name="load_pattern" defaultValue={p?.load_pattern ?? "3:1"} className={input}>
            {["2:1", "3:1", "4:1", "5:1", "2:0", "3:0", "4:0", "6:0"].map((x) => (
              <option key={x} value={x}>{x.endsWith(":0") ? `${x[0]} wk, no deload` : `${x} weeks`}</option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-xs text-muted">Program for this phase
          <select name="program_id" defaultValue={p?.program_id ?? ""} className={input}>
            <option value="">Not linked</option>
            {programs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      </div>
      <textarea name="notes" defaultValue={p?.notes ?? ""} rows={2} maxLength={2000} placeholder="Notes (key lifts, focus, cut plan…)" className={`${input} py-2`} aria-label="Notes" />
    </div>
  );
}

export default async function SeasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const { error } = await searchParams;
  const { data: season } = await supabase.from("seasons").select("*").eq("id", id).maybeSingle();
  if (!season) notFound();
  const isGroup = !!season.group_id;

  const [{ data: phaseRows }, { data: programs }, { data: owner }, { data: memberRows }, { data: assignRows }] = await Promise.all([
    supabase.from("phases").select("*").eq("season_id", id).order("start_date"),
    supabase.from("programs").select("id, name").eq("archived", false).order("name"),
    isGroup
      ? supabase.from("groups").select("name").eq("id", season.group_id).maybeSingle()
      : supabase.from("profiles").select("full_name, email, next_fight_date, second_fight_date").eq("id", season.athlete_id).maybeSingle(),
    isGroup
      ? supabase.from("group_members").select("profiles(full_name, next_fight_date, second_fight_date)").eq("group_id", season.group_id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("assignments")
      .select("id, program_name, start_date, workouts(workout_date)")
      .eq(isGroup ? "group_id" : "athlete_id", isGroup ? season.group_id : season.athlete_id),
  ]);
  const phases = (phaseRows ?? []) as Phase[];
  const today = todayISO();
  const ownerName = isGroup
    ? (owner as { name: string } | null)?.name
    : ((owner as { full_name: string | null; email: string } | null)?.full_name ?? (owner as { email: string } | null)?.email);
  const fights = isGroup
    ? ((memberRows ?? []) as unknown as { profiles: { full_name: string | null; next_fight_date: string | null; second_fight_date: string | null } }[])
        .flatMap((m) => planned(m.profiles).map((d) => ({ date: d, label: m.profiles.full_name ?? "Member" })))
    : planned((owner ?? {}) as { next_fight_date: string | null; second_fight_date: string | null }).map((d) => ({ date: d, label: "Fight" }));
  const assigned = ((assignRows ?? []) as unknown as { program_name: string; start_date: string; workouts: { workout_date: string }[] }[])
    .filter((a) => a.workouts.length)
    .map((a) => ({ label: a.program_name, start: a.start_date, end: a.workouts.map((w) => w.workout_date).sort().pop()! }));
  const backHref = isGroup ? `/coach/groups/${season.group_id}` : `/coach/athlete/${season.athlete_id}/program`;
  const nextStart = phases.length ? addDays(phases[phases.length - 1].end_date, 1) : today;
  const nextFight = fights.map((f) => f.date).filter((d) => d >= today).sort()[0];
  const programName = new Map((programs ?? []).map((p) => [p.id, p.name]));

  return (
    <Screen wide>
      <BackLink href={backHref} label={ownerName ?? "Back"} />
      <Heading sub={[season.goal, nextFight ? `Next fight ${formatDate(nextFight)} · ${weeksOut(today, nextFight)}` : null].filter(Boolean).join(" · ") || "Training plan"}>
        {season.name}
      </Heading>
      {error && <Alert>{error}</Alert>}
      <datalist id="phase-names">
        {PHASE_TEMPLATES.map((n) => <option key={n} value={n} />)}
      </datalist>

      <Card className="mb-6 !p-4">
        <SeasonTimeline phases={phases} fights={fights} assigned={assigned} today={today} />
      </Card>

      <div className="space-y-3">
        {phases.map((p) => {
          const weeks = phaseWeeks(p.start_date, p.end_date, p.load_pattern);
          const coveredByAssigned = assigned.some((a) => a.start <= p.end_date && a.end >= p.start_date);
          return (
            <details key={p.id} id={`phase-${p.id}`} className="scroll-mt-6 rounded-2xl border border-line bg-surface p-4">
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2">
                <span>
                  <span className="text-lg font-black uppercase tracking-tight">{p.name}</span>
                  <span className="ml-2 text-sm text-muted">
                    {formatDate(p.start_date)} → {formatDate(p.end_date)} · {weeks.length} wk
                  </span>
                </span>
                <span className="text-xs text-muted">
                  {[
                    p.intensity_lo && p.intensity_hi ? `${p.intensity_lo}–${p.intensity_hi}%` : null,
                    p.sessions_per_week ? `${p.sessions_per_week} sess/wk` : null,
                    p.sets_per_week ? `${p.sets_per_week} sets/wk` : null,
                    p.conditioning_min ? `${p.conditioning_min} min cond` : null,
                  ].filter(Boolean).join(" · ")}
                  {!coveredByAssigned && p.end_date >= today && <span className="ml-2 font-bold text-warn">No program assigned</span>}
                </span>
              </summary>
              {p.goal && <p className="mt-2 text-sm">Goal: {p.goal}</p>}
              {p.program_id && (
                <p className="mt-1 text-sm">
                  Program:{" "}
                  <Link href={`/coach/programs/${p.program_id}`} className="font-bold text-brand underline underline-offset-4">
                    {programName.get(p.program_id) ?? "Open"}
                  </Link>
                </p>
              )}
              <form action={updatePhase} className="mt-4">
                <input type="hidden" name="season_id" value={id} />
                <input type="hidden" name="id" value={p.id} />
                <PhaseFields p={p} programs={programs ?? []} />
                <div className="mt-2 flex gap-2">
                  <button className={smallBtn}>Save phase</button>
                </div>
              </form>
              <form action={deletePhase} className="mt-2">
                <input type="hidden" name="season_id" value={id} />
                <input type="hidden" name="id" value={p.id} />
                <button className="text-sm text-brand underline underline-offset-4">Delete phase</button>
              </form>
            </details>
          );
        })}
      </div>

      <Card className="mt-6 !p-4">
        <h2 className="mb-3 font-extrabold">Add a phase</h2>
        <form action={addPhase}>
          <input type="hidden" name="season_id" value={id} />
          <PhaseFields programs={programs ?? []} start={nextStart} />
          <button className="mt-3 min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Add phase</button>
        </form>
      </Card>

      <details className="mt-8 rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-bold">Plan details</summary>
        <form action={updateSeason} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={id} />
          <input name="name" defaultValue={season.name} maxLength={80} required className={input} aria-label="Name" />
          <input name="goal" defaultValue={season.goal ?? ""} maxLength={500} placeholder="Goal for this plan" className={input} aria-label="Goal" />
          <textarea name="notes" defaultValue={season.notes ?? ""} rows={3} maxLength={2000} className={`${input} py-2`} aria-label="Notes" />
          <button className={smallBtn}>Save</button>
        </form>
        <form action={deleteSeason} className="mt-6 flex gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="back" value={backHref} />
          <input name="confirm" placeholder="Type DELETE" className={input} aria-label="Type DELETE to confirm" />
          <button className={`${smallBtn} !border-brand/60 !text-brand`}>Delete plan</button>
        </form>
      </details>
    </Screen>
  );
}
