import Link from "next/link";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { addDays } from "@/lib/week";
import { UUID } from "@/lib/programming/server";
import { loadLoggerData } from "@/lib/programming/logger-data";
import { readinessTone } from "@/lib/programming/rewards";
import { WorkoutLogger } from "@/components/WorkoutLogger";
import { Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

type W = { id: string; title: string; workout_date: string };

export default async function TrainTogether({ searchParams }: { searchParams: Promise<{ c?: string | string[]; d?: string; w?: string | string[] }> }) {
  const { supabase } = await requireState(["coach"]);
  const sp = await searchParams;
  const today = todayISO();
  const date = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today;
  const picked = [...new Set((Array.isArray(sp.c) ? sp.c : (sp.c ?? "").split(",")).filter((x) => UUID.test(x)))].slice(0, 4);
  const chosenW = new Set((Array.isArray(sp.w) ? sp.w : (sp.w ?? "").split(",")).filter((x) => UUID.test(x)));

  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "athlete")
    .eq("status", "active")
    .order("full_name");
  const name = new Map((clients ?? []).map((c) => [c.id, c.full_name ?? c.email]));
  const qs = (over: { c?: string[]; d?: string }) => {
    const p = new URLSearchParams();
    const c = over.c ?? picked;
    if (c.length) p.set("c", c.join(","));
    p.set("d", over.d ?? date);
    return `/coach/train?${p}`;
  };

  // ---- Pick who you're training
  if (!picked.length) {
    const todays = await Promise.all(
      (clients ?? []).map(async (c) => {
        const { data } = await supabase.rpc("client_workouts", { p_athlete: c.id, p_from: date, p_to: date });
        return [c.id, ((data ?? []) as W[]).map((w) => w.title)] as const;
      }),
    );
    const byClient = new Map(todays);
    const sorted = [...(clients ?? [])].sort((a, b) => (byClient.get(b.id)?.length ?? 0) - (byClient.get(a.id)?.length ?? 0));
    // Semi-private groups: one tap loads everyone in the group (up to 4)
    const [{ data: groups }, { data: gm }] = await Promise.all([
      supabase.from("groups").select("id, name").eq("archived", false).order("name"),
      supabase.from("group_members").select("group_id, athlete_id"),
    ]);
    const active = new Set((clients ?? []).map((c) => c.id));
    const groupChips = (groups ?? [])
      .map((g) => ({ ...g, ids: (gm ?? []).filter((m) => m.group_id === g.id && active.has(m.athlete_id)).map((m) => m.athlete_id) }))
      .filter((g) => g.ids.length >= 1 && g.ids.length <= 4);
    return (
      <Screen wide>
        <Heading sub="Log your clients' sets while you train them. Pick 1 on a phone, up to 4 on an iPad.">Train together</Heading>
        {groupChips.length > 0 && (
          <div className="mb-4 max-w-2xl">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">Start a group session</p>
            <div className="flex flex-wrap gap-2">
              {groupChips.map((g) => (
                <Link key={g.id} href={qs({ c: g.ids })} className="flex min-h-12 items-center gap-2 rounded-xl border border-brand/50 bg-brand/10 px-4 font-extrabold">
                  {g.name} <span className="text-xs font-normal text-muted">{g.ids.length} people</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        <form className="max-w-2xl">
          <input type="hidden" name="d" value={date} />
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {sorted.length === 0 && <p className="p-4 text-sm text-muted">No active clients yet.</p>}
            {sorted.map((c) => {
              const ws = byClient.get(c.id) ?? [];
              return (
                <label key={c.id} className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-2 has-[:checked]:bg-brand/10">
                  <input type="checkbox" name="c" value={c.id} className="h-6 w-6 accent-[var(--color-brand)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold">{c.full_name ?? c.email}</span>
                    <span className={`block truncate text-sm ${ws.length ? "text-text" : "text-muted"}`}>{ws.length ? ws.join(" · ") : "Nothing planned today"}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <button className="mt-4 min-h-14 w-full rounded-2xl bg-brand text-lg font-black uppercase tracking-wide text-white">Start session</button>
          <p className="mt-2 text-center text-xs text-muted">Only the first 4 ticked are used.</p>
        </form>
      </Screen>
    );
  }

  // ---- Live session: one panel per client
  const panels = await Promise.all(
    picked.map(async (id) => {
      const { data } = await supabase.rpc("client_workouts", { p_athlete: id, p_from: date, p_to: date });
      const ws = (data ?? []) as W[];
      const current = ws.find((w) => chosenW.has(w.id)) ?? ws[0] ?? null;
      const d = current ? await loadLoggerData(supabase, current.id, id) : null;
      return { id, ws, current, d };
    }),
  );

  return (
    <div className="px-3 pb-10 pt-4 lg:px-6">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-black uppercase tracking-tight">Train together</h1>
        <div className="flex items-center rounded-xl border border-line">
          <Link href={qs({ d: addDays(date, -1) })} className="flex h-11 w-11 items-center justify-center text-lg text-muted" aria-label="Previous day">‹</Link>
          <Link href={qs({ d: today })} className="flex h-11 items-center px-2 text-sm font-bold">{date === today ? "Today" : formatDate(date)}</Link>
          <Link href={qs({ d: addDays(date, 1) })} className="flex h-11 w-11 items-center justify-center text-lg text-muted" aria-label="Next day">›</Link>
        </div>
        <Link href={`/coach/train?d=${date}`} className="flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-bold">Change clients</Link>
      </header>
      {panels.length > 1 && <p className="mb-2 text-xs text-muted md:hidden">Swipe sideways to switch client →</p>}

      <div className={`-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 md:mx-0 md:grid md:overflow-visible md:px-0 ${panels.length > 1 ? "md:grid-cols-2" : ""}`}>
        {panels.map(({ id, ws, current, d }) => (
          <section key={id} className="w-[calc(100vw-2.5rem)] shrink-0 snap-start rounded-2xl border border-line bg-surface md:w-auto">
            <div className="sticky top-0 z-10 flex items-center gap-2 rounded-t-2xl border-b border-line bg-surface/95 px-3 py-2 backdrop-blur">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-black text-white">
                {String(name.get(id) ?? "?").split(/\s+/).map((x: string) => x[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <Link href={`/coach/athlete/${id}/program`} className="block truncate font-black uppercase leading-tight">{name.get(id) ?? "Client"}</Link>
                <span className="block truncate text-xs text-muted">{current ? current.title : "Nothing planned"}</span>
              </span>
              {d?.ready && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-black ${readinessTone(d.ready.score) === "ok" ? "bg-ok/15 text-ok" : readinessTone(d.ready.score) === "warn" ? "bg-warn/15 text-warn" : "bg-brand/15 text-brand"}`}>
                  Ready {d.ready.score}
                </span>
              )}
              <Link href={qs({ c: picked.filter((x) => x !== id) })} className="flex h-9 w-9 items-center justify-center text-muted" aria-label="Remove from session">✕</Link>
            </div>
            {ws.length > 1 && (
              <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
                {ws.map((w) => (
                  <Link
                    key={w.id}
                    href={`${qs({})}&w=${[...panels.map((p) => (p.id === id ? w.id : p.current?.id)).filter(Boolean)].join(",")}`}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${w.id === current?.id ? "bg-brand text-white" : "border border-line text-muted"}`}
                  >
                    {w.title}
                  </Link>
                ))}
              </div>
            )}
            <div className={`max-h-[calc(100dvh-11rem)] overflow-y-auto p-3 ${panels.length > 2 ? "md:max-h-[calc((100dvh-9rem)/2)]" : ""}`}>
              {!current || !d ? (
                <div className="py-10 text-center text-sm text-muted">
                  Nothing planned {date === today ? "today" : `on ${formatDate(date)}`}.
                  <Link href={`/coach/athlete/${id}/program`} className="mt-2 block font-bold text-brand">Add a workout on their calendar →</Link>
                </div>
              ) : d.items.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">This workout has no exercises yet.</p>
              ) : (
                <WorkoutLogger
                  key={current.id}
                  workoutId={current.id}
                  athleteId={id}
                  embedded
                  blocks={d.blocks}
                  comment={d.log?.comment ?? ""}
                  finished={d.finished}
                  rpe={d.log?.session_rpe ?? null}
                  lastRpe={d.lastRpe}
                  duration={d.log?.duration_min ?? null}
                  readOnly={false}
                />
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
