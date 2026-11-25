// Printable program for a client: one progression table per training day (weeks across),
// with an optional exercise guide. Coach prints or saves as PDF to share with a physio
// or email to the client.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { buildDayTables, type PrintItem, type PrintWorkout } from "@/lib/programming/print-matrix";
import { parseCues } from "@/lib/cues";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ProgramPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ block?: string; guide?: string; notes?: string }>;
}) {
  const { supabase, profile } = await requireState(["coach"]);
  const { id } = await params;
  const sp = await searchParams;
  const [{ data: client }, { data: blocks }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle(),
    supabase.from("assignments").select("id, program_name, start_date").eq("athlete_id", id).order("start_date", { ascending: false }),
  ]);
  if (!client) notFound();
  const list = blocks ?? [];
  const pick = list.find((b) => b.id === sp.block) ?? list[0];
  const name = client.full_name ?? client.email;
  const guide = sp.guide === "1";
  const showNotes = sp.notes !== "0";

  let workouts: PrintWorkout[] = [];
  let items: (PrintItem & { exercise_id: string | null })[] = [];
  if (pick) {
    const { data: ws } = await supabase
      .from("workouts").select("id, workout_date, title").eq("assignment_id", pick.id).eq("athlete_id", id).order("workout_date").order("position");
    workouts = (ws ?? []) as PrintWorkout[];
    if (workouts.length) {
      const { data: its } = await supabase
        .from("workout_items")
        .select("workout_id, kind, block, slot, position, exercise_id, title, notes, sets, reps, load_type, percent, rpe, load_kg, tempo, rest_sec, set_plan, exercises(name)")
        .in("workout_id", workouts.map((w) => w.id))
        .order("position");
      items = (its ?? []) as unknown as typeof items;
    }
  }
  const from = workouts[0]?.workout_date ?? pick?.start_date ?? todayISO();
  const to = workouts[workouts.length - 1]?.workout_date ?? from;
  const { weeks, days } = buildDayTables(workouts, items, from);

  // Exercise guide: each exercise once, with its numbered steps
  const exIds = [...new Set(items.map((i) => i.exercise_id).filter(Boolean))] as string[];
  const { data: exRows } = guide && exIds.length
    ? await supabase.from("exercises").select("id, name, cues").in("id", exIds)
    : { data: [] as { id: string; name: string; cues: string | null }[] };
  const exGuide = (exRows ?? []).sort((a, b) => a.name.localeCompare(b.name));

  const q = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const cur = { block: pick?.id, guide: guide ? "1" : undefined, notes: showNotes ? undefined : "0", ...over };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };

  return (
    <div className="print-sheet min-h-dvh bg-white px-4 py-6 text-[#282828] sm:px-8">
      {/* Controls (not printed) */}
      <div className="no-print mx-auto mb-6 flex max-w-5xl flex-wrap items-center gap-2 rounded-2xl border border-[#ddd] bg-[#f6f6f6] p-3 text-sm">
        <Link href={`/coach/athlete/${id}/programming${pick ? `?block=${pick.id}` : ""}`} className="font-bold underline underline-offset-4">← Back</Link>
        <span className="mx-1 text-[#999]">|</span>
        {list.map((b) => (
          <Link key={b.id} href={q({ block: b.id })} className={`rounded-lg px-2.5 py-1.5 font-bold ${b.id === pick?.id ? "bg-[#D2141E] text-white" : "border border-[#ddd] bg-white"}`}>
            {b.program_name}
          </Link>
        ))}
        <span className="flex-1" />
        <Link href={q({ guide: guide ? undefined : "1" })} className="rounded-lg border border-[#ddd] bg-white px-2.5 py-1.5 font-bold">
          {guide ? "✓ " : ""}Exercise guide
        </Link>
        <Link href={q({ notes: showNotes ? "0" : undefined })} className="rounded-lg border border-[#ddd] bg-white px-2.5 py-1.5 font-bold">
          {showNotes ? "✓ " : ""}Coach notes
        </Link>
        <PrintButton />
        <p className="w-full text-xs text-[#666]">Print, then choose “Save as PDF” to email it. Landscape fits more weeks.</p>
      </div>

      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex items-center gap-4 border-b-4 border-[#D2141E] pb-4" style={{ display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" className="h-12 w-12" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#D2141E]">TYPERFORMANCE · Training program</p>
            <h1 className="text-2xl font-black uppercase leading-tight">{name}</h1>
            <p className="text-sm">
              {pick ? <><strong>{pick.program_name}</strong> · {formatDate(from)} to {formatDate(to)} · {weeks} week{weeks === 1 ? "" : "s"} · {days.length} day{days.length === 1 ? "" : "s"} a week</> : "No blocks yet"}
            </p>
          </div>
          <div className="text-right text-xs text-[#666]">
            <p>Coach: {profile.full_name ?? "TYPERFORMANCE"}</p>
            <p>Printed {formatDate(todayISO())}</p>
          </div>
        </header>

        {!pick || !days.length ? (
          <p className="py-10 text-center text-[#666]">This block has no sessions yet.</p>
        ) : (
          <>
            <p className="mb-4 text-xs text-[#666]">
              Each table is one training day. Columns are weeks, so you can read how each exercise progresses. Sets × reps, then load (% of 1RM, RPE or kg), tempo and rest where set.
            </p>
            {days.map((d) => (
              <section key={d.key} className="print-avoid mb-6">
                <h2 className="mb-1.5 text-base font-black uppercase">{d.heading}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px] leading-snug">
                    <thead>
                      <tr className="bg-[#282828] text-left text-white">
                        <th className="w-10 px-2 py-1.5">#</th>
                        <th className="min-w-40 px-2 py-1.5">Exercise</th>
                        {Array.from({ length: weeks }, (_, w) => <th key={w} className="px-2 py-1.5">Week {w + 1}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {d.rows.map((r, k) =>
                        r.kind === "exercise" ? (
                          <tr key={k} className="border-b border-[#e3e3e3] align-top odd:bg-[#fafafa]">
                            <td className="px-2 py-1.5 font-black text-[#D2141E]">{r.label}</td>
                            <td className="px-2 py-1.5 font-bold">{r.name}</td>
                            {r.cells.map((c, w) => (
                              <td key={w} className="px-2 py-1.5">
                                {c ? (
                                  <>
                                    {c.name && <span className="block font-bold">{c.name}</span>}
                                    <span>{c.rx || "✓"}</span>
                                    {showNotes && c.note && <span className="mt-0.5 block text-[11px] italic text-[#666]">{c.note}</span>}
                                  </>
                                ) : (
                                  <span className="text-[#bbb]">–</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ) : showNotes ? (
                          <tr key={k} className="border-b border-[#e3e3e3] bg-[#fff5f5]">
                            <td className="px-2 py-1.5 font-black text-[#D2141E]">{r.label}</td>
                            <td colSpan={weeks + 1} className="px-2 py-1.5">
                              <strong>{r.name}</strong>
                              {r.cells.find((c) => c?.rx)?.rx ? ` · ${r.cells.find((c) => c?.rx)!.rx}` : ""}
                            </td>
                          </tr>
                        ) : null,
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )}

        {guide && exGuide.length > 0 && (
          <section className="print-break mt-8">
            <h2 className="mb-3 border-b-2 border-[#D2141E] pb-1 text-lg font-black uppercase">Exercise guide</h2>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {exGuide.map((e) => {
                const secs = parseCues(e.cues).filter((s) => s.kind !== "notes" || showNotes);
                return (
                  <div key={e.id} className="print-avoid text-[12px] leading-snug">
                    <p className="mb-1 font-black uppercase">{e.name}</p>
                    {secs.length === 0 && <p className="text-[#999]">No written instructions yet.</p>}
                    {secs.map((s, i) =>
                      s.numbered ? (
                        <ol key={i} className="list-decimal space-y-0.5 pl-4">{s.items.map((t, j) => <li key={j}>{t}</li>)}</ol>
                      ) : (
                        <p key={i} className="mt-1">
                          <strong className="text-[#D2141E]">{s.kind === "tip" ? "Tip: " : s.kind === "notes" ? "Coach: " : s.title ? `${s.title}: ` : ""}</strong>
                          {s.items.join(" ")}
                        </p>
                      ),
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <footer className="mt-8 border-t border-[#ddd] pt-3 text-[11px] text-[#666]">
          Prepared by {profile.full_name ?? "your coach"} at TYPERFORMANCE for {name}. Loads marked % use the client&apos;s current 1RM. Please contact the coach before changing the program.
        </footer>
      </div>
    </div>
  );
}
