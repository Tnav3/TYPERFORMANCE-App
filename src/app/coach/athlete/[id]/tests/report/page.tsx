// Client assessment report: pick the testing dates to include, and every test and mobility
// measure from those dates is shown with its trend and the change from the first picked date.
// White, print-ready layout to hand to the client or save as PDF.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { getEntries, getTestDefs } from "@/lib/test-data";
import { getRomEntries, getRomMeasures } from "@/lib/mobility-data";
import { buildReport, reportTally, testingDates, type ReportRow } from "@/lib/assessment-report";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const RED = "#D2141E";
const GREEN = "#1f9d55";
const fmt = (n: number) => (Math.abs(n) >= 100 ? String(Math.round(n)) : String(Math.round(n * 100) / 100));

function Bars({ row }: { row: ReportRow }) {
  const max = Math.max(...row.points.map((p) => Math.abs(p.value)), 1);
  const w = 30;
  const gap = 10;
  const h = 56;
  return (
    <svg width={row.points.length * (w + gap)} height={h + 28} role="img" aria-label={`${row.name} over time`}>
      {row.points.map((p, i) => {
        const bh = Math.max(3, (Math.abs(p.value) / max) * h);
        const last = i === row.points.length - 1;
        return (
          <g key={p.date} transform={`translate(${i * (w + gap)},0)`}>
            <rect x={0} y={h - bh + 12} width={w} height={bh} rx={4} fill={last ? (row.better === false ? "#888" : RED) : "#cfcfcf"} />
            <text x={w / 2} y={h - bh + 8} textAnchor="middle" fontSize="10" fontWeight="700" fill="#282828">{fmt(p.value)}</text>
            <text x={w / 2} y={h + 24} textAnchor="middle" fontSize="9" fill="#666">{formatDate(p.date).replace(/ \d{4}$/, "")}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default async function AssessmentReport({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string | string[] }>;
}) {
  const { supabase, profile } = await requireState(["coach"]);
  const { id } = await params;
  const sp = await searchParams;
  const [{ data: client }, defs, entries, measures, rom] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle(),
    getTestDefs(supabase),
    getEntries(supabase, id),
    getRomMeasures(supabase),
    getRomEntries(supabase, id),
  ]);
  if (!client) notFound();
  const all = testingDates(entries, rom);
  const asked = (Array.isArray(sp.d) ? sp.d : sp.d ? [sp.d] : []).filter((d) => ISO.test(d) && all.includes(d));
  // Default: the latest testing date and the one before it
  const picked = (asked.length ? asked : all.slice(0, 2)).sort();
  const sections = buildReport(picked, defs, entries, measures, rom);
  const tally = reportTally(sections);
  const name = client.full_name ?? client.email;
  const what = (d: string) => {
    const t = entries.filter((e) => e.tested_on === d).length;
    const m = rom.filter((r) => r.measured_on === d).length;
    return [t ? `${t} test${t === 1 ? "" : "s"}` : "", m ? `${m} mobility` : ""].filter(Boolean).join(" · ");
  };

  return (
    <div className="print-sheet min-h-dvh bg-white px-4 py-6 text-[#282828] sm:px-8">
      <form className="no-print mx-auto mb-6 max-w-4xl rounded-2xl border border-[#ddd] bg-[#f6f6f6] p-3 text-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Link href={`/coach/athlete/${id}/tests`} className="font-bold underline underline-offset-4">← Back to tests</Link>
          <span className="flex-1" />
          <PrintButton light />
        </div>
        <p className="mb-2 font-bold">Testing dates to include <span className="font-normal text-[#666]">(changes are measured from the earliest ticked date)</span></p>
        {all.length === 0 ? (
          <p className="text-[#666]">No tests or mobility screens recorded yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {all.map((d) => (
              <label key={d} className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#ddd] bg-white px-3 py-2">
                <input type="checkbox" name="d" value={d} defaultChecked={picked.includes(d)} className="h-4 w-4 accent-[#D2141E]" />
                <span><strong>{formatDate(d)}</strong> <span className="text-xs text-[#666]">{what(d)}</span></span>
              </label>
            ))}
          </div>
        )}
        <button className="mt-3 min-h-10 rounded-xl bg-[#D2141E] px-4 font-extrabold uppercase text-white">Update report</button>
      </form>

      <div className="mx-auto max-w-4xl">
        <header className="mb-5 flex items-center gap-4 border-b-4 border-[#D2141E] pb-4" style={{ display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" className="h-12 w-12" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#D2141E]">TYPERFORMANCE · Performance report</p>
            <h1 className="text-2xl font-black uppercase leading-tight">{name}</h1>
            <p className="text-sm">{picked.length ? picked.map(formatDate).join("  →  ") : "No dates picked"}</p>
          </div>
          <div className="text-right text-xs text-[#666]">
            <p>Coach: {profile.full_name ?? "TYPERFORMANCE"}</p>
            <p>Printed {formatDate(todayISO())}</p>
          </div>
        </header>

        {tally.compared > 0 && (
          <section className="print-avoid mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#f4fbf7] p-4 text-center">
              <p className="text-3xl font-black" style={{ color: GREEN }}>{tally.improved}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-[#666]">Improved</p>
            </div>
            <div className="rounded-2xl bg-[#fff5f5] p-4 text-center">
              <p className="text-3xl font-black" style={{ color: RED }}>{tally.declined}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-[#666]">Went down</p>
            </div>
            <div className="rounded-2xl bg-[#f6f6f6] p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#666]">Biggest wins</p>
              {tally.best.length ? tally.best.map((r) => (
                <p key={r.key} className="text-sm"><strong>{r.name}</strong> <span style={{ color: GREEN }}>{r.changePct! > 0 ? "+" : ""}{r.changePct}%</span></p>
              )) : <p className="text-sm text-[#666]">None yet</p>}
            </div>
          </section>
        )}

        {sections.length === 0 && <p className="py-10 text-center text-[#666]">Nothing recorded on the picked dates.</p>}
        {sections.map((s) => (
          <section key={s.title} className="mb-6">
            <h2 className="mb-2 border-b-2 border-[#282828] pb-1 text-lg font-black uppercase">{s.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {s.rows.map((r) => (
                <div key={r.key} className="print-avoid rounded-2xl border border-[#e3e3e3] p-3">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="text-sm font-black uppercase leading-tight">{r.name}</p>
                    {r.changePct != null && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-xs font-black text-white"
                        style={{ background: r.better === true ? GREEN : r.better === false ? RED : "#999" }}
                      >
                        {r.changePct > 0 ? "▲" : r.changePct < 0 ? "▼" : ""} {r.changePct > 0 ? "+" : ""}{r.changePct}%
                      </span>
                    )}
                  </div>
                  <p className="mb-1 text-xs text-[#666]">
                    {r.last ? <>Latest <strong className="text-[#282828]">{fmt(r.last.value)} {r.unit}</strong></> : null}
                    {r.first && r.last && r.first.date !== r.last.date ? <> · was {fmt(r.first.value)} on {formatDate(r.first.date)}</> : null}
                  </p>
                  <Bars row={r} />
                </div>
              ))}
            </div>
          </section>
        ))}

        <footer className="mt-8 border-t border-[#ddd] pt-3 text-[11px] text-[#666]">
          Green means better, red means it went the other way. For sway, landing force and asymmetry, lower is better. Prepared by {profile.full_name ?? "your coach"} at TYPERFORMANCE.
        </footer>
      </div>
    </div>
  );
}
