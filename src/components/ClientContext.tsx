// What to keep in mind while programming this client: injuries, competitions, notes,
// plus what the app has picked up (niggles in check-ins, pain swaps, fight camp).
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayISO } from "@/lib/dates";
import { addDays } from "@/lib/week";
import { fightCountdown } from "@/lib/fight";
import { addFlag, resolveFlag } from "@/app/coach/flags/actions";
import { DEFAULT_STALE_WEEKS, weeksSince } from "@/lib/programming/stale-max";

const ICON: Record<string, string> = { injury: "🩹", competition: "🥊", note: "📌" };
const box = "h-9 min-w-0 rounded-lg border border-line bg-surface-2 px-2 text-sm text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export async function ClientContext({ athleteId }: { athleteId: string }) {
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: flags }, { data: p }, { data: checks }, { data: swaps }] = await Promise.all([
    supabase.from("client_flags").select("id, kind, title, detail, event_date").eq("athlete_id", athleteId).eq("active", true).order("kind").order("created_at"),
    supabase.from("profiles").select("next_fight_date, weight_class, weight_class_limit_kg").eq("id", athleteId).maybeSingle(),
    supabase.from("weekly_checkins").select("week_start, niggle_note").eq("athlete_id", athleteId).eq("niggle", true).gte("week_start", addDays(today, -35)).order("week_start", { ascending: false }).limit(3),
    supabase
      .from("item_logs")
      .select("swap_note, swapped_at, workout_logs!inner(athlete_id)")
      .eq("workout_logs.athlete_id", athleteId)
      .eq("swap_reason", "pain")
      .gte("swapped_at", `${addDays(today, -30)}T00:00:00Z`)
      .order("swapped_at", { ascending: false })
      .limit(3),
  ]);
  const { data: myNotes } = await supabase
    .from("client_notes")
    .select("id, title, body, exercises(name)")
    .eq("athlete_id", athleteId)
    .order("updated_at", { ascending: false })
    .limit(12);
  // Lifts whose newest e1RM is older than the cut-off: due a re-test (RPE build-up) before % loads.
  const [{ data: maxRows }, { data: st }] = await Promise.all([
    supabase.from("lift_maxes").select("lift_key, saved_on, lifts(name, active)").eq("athlete_id", athleteId).order("created_at", { ascending: false }),
    supabase.from("app_settings").select("stale_max_weeks").maybeSingle(),
  ]);
  const cut = st?.stale_max_weeks ?? DEFAULT_STALE_WEEKS;
  const seen = new Set<string>();
  const old: string[] = [];
  for (const m of (maxRows ?? []) as unknown as { lift_key: string; saved_on: string; lifts: { name: string; active: boolean } | null }[]) {
    if (seen.has(m.lift_key)) continue;
    seen.add(m.lift_key);
    const wk = weeksSince(m.saved_on, today);
    if (wk >= cut && m.lifts?.active !== false) old.push(`${m.lifts?.name ?? m.lift_key} (${wk} wks)`);
  }
  const notes = (myNotes ?? []) as unknown as { id: string; title: string | null; body: string; exercises: { name: string } | null }[];
  const fight = fightCountdown(p?.next_fight_date ?? null, today);
  const auto: string[] = [];
  if (fight && !fight.past) auto.push(`🥊 Fight ${fight.label}${p?.weight_class ? ` · ${p.weight_class}` : ""}${p?.weight_class_limit_kg ? ` (${Number(p.weight_class_limit_kg)} kg)` : ""}`);
  for (const c of checks ?? []) auto.push(`⚠️ Niggle w/c ${formatDate(c.week_start)}${c.niggle_note ? `: ${c.niggle_note}` : ""}`);
  for (const s of swaps ?? []) auto.push(`↔️ Swapped for pain ${formatDate(String(s.swapped_at).slice(0, 10))}${s.swap_note ? `: ${s.swap_note}` : ""}`);
  if (old.length) auto.push(`🕰️ Old maxes, re-test with an RPE build-up: ${old.slice(0, 5).join(", ")}${old.length > 5 ? ` +${old.length - 5} more` : ""}`);
  const list = flags ?? [];

  return (
    <details className="group mb-4 rounded-2xl border border-line bg-surface" open={list.length + auto.length > 0}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2 text-sm">
        <span className="font-black uppercase tracking-wide">Keep in mind</span>
        <span className="truncate text-muted">
          {list.length + auto.length === 0 ? "Nothing flagged" : [...list.map((f) => f.title), ...auto.map((a) => a.replace(/^\S+\s/, "").split(":")[0])].join(" · ")}
        </span>
        <span className="ml-auto text-muted group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-1.5 px-4 pb-3">
        {list.map((f) => (
          <div key={f.id} className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span aria-hidden>{ICON[f.kind]}</span>
            <div className="min-w-0 flex-1">
              <span className="font-semibold">{f.title}</span>
              {f.event_date && <span className="text-muted"> · {formatDate(f.event_date)}</span>}
              {f.detail && <p className="text-xs text-muted">{f.detail}</p>}
            </div>
            <form action={resolveFlag}>
              <input type="hidden" name="id" value={f.id} />
              <input type="hidden" name="athlete_id" value={athleteId} />
              <button className="text-xs text-muted underline" title="Mark resolved">Resolved</button>
            </form>
          </div>
        ))}
        {auto.map((a) => <p key={a} className="px-1 text-xs text-muted">{a}</p>)}
        {notes.length > 0 && (
          <details className="px-1 text-xs">
            <summary className="cursor-pointer text-muted">📝 Their own notes ({notes.length})</summary>
            <ul className="mt-1 space-y-1">
              {notes.map((n) => (
                <li key={n.id}>
                  <b>{n.exercises?.name ?? n.title ?? "Note"}:</b> <span className="text-muted">{n.body}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <form action={addFlag} className="flex flex-wrap gap-2 pt-1">
          <input type="hidden" name="athlete_id" value={athleteId} />
          <select name="kind" className={`${box} w-32`} aria-label="Type">
            <option value="injury">🩹 Injury</option>
            <option value="competition">🥊 Competition</option>
            <option value="note">📌 Note</option>
          </select>
          <input name="title" required maxLength={80} placeholder="e.g. L shoulder, no overhead" className={`${box} flex-1 basis-48`} />
          <input name="detail" maxLength={600} placeholder="Detail (optional)" className={`${box} flex-1 basis-48`} />
          <input name="event_date" type="date" className={`${box} w-40`} aria-label="Date (optional)" />
          <button className="h-9 rounded-lg bg-brand px-3 text-sm font-bold text-white">Add</button>
        </form>
      </div>
    </details>
  );
}
