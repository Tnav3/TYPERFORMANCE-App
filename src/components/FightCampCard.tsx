import type { CampStatus } from "@/lib/fight-camp";

const PH: CampStatus["phase"][] = ["general", "specific", "peak", "fight_week"];

export function FightCampCard({ s, limitKg, coach = false }: { s: CampStatus; limitKg: number | null; coach?: boolean }) {
  const w = s.weight;
  const at = PH.indexOf(s.phase);
  return (
    <section className="mb-5 rounded-2xl border border-brand/60 bg-surface p-4" aria-label="Fight camp">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-brand">Fight camp</h2>
        <span className="text-xs text-muted">Week {s.week} of {s.totalWeeks}</span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-black leading-none">{s.daysOut === 0 ? "Today" : s.daysOut}</p>
          {s.daysOut > 0 && <p className="text-xs text-muted">day{s.daysOut === 1 ? "" : "s"} to go</p>}
        </div>
        <div className="text-right">
          <p className="font-bold">{s.label}</p>
          <p className="max-w-[14rem] text-xs text-muted">{s.focus}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1" aria-hidden>
        {PH.map((p, i) => <div key={p} className={`h-1.5 rounded-full ${at >= 0 && i <= at ? "bg-brand" : s.phase === "fight_day" ? "bg-brand" : "bg-surface-2"}`} />)}
      </div>
      {w && limitKg && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-2 p-2">
            <p className="text-lg font-black">{w.latest}</p>
            <p className="text-[11px] text-muted">kg now</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <p className={`text-lg font-black ${w.overKg <= 0 ? "text-green-400" : ""}`}>{w.overKg > 0 ? `+${w.overKg}` : w.overKg}</p>
            <p className="text-[11px] text-muted">vs {limitKg} kg ({w.overPct > 0 ? "+" : ""}{w.overPct}%)</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <p className={`text-lg font-black ${w.onTrack === true ? "text-green-400" : w.onTrack === false ? "text-yellow-400" : ""}`}>
              {w.trendPerWeek == null ? "?" : `${w.trendPerWeek > 0 ? "+" : ""}${w.trendPerWeek}`}
            </p>
            <p className="text-[11px] text-muted">{w.trendPerWeek == null ? "needs 3 weigh-ins" : "kg/week trend"}</p>
          </div>
        </div>
      )}
      {w?.perWeekNeeded != null && (
        <p className="mt-2 text-xs text-muted">Pace to be within 5% by fight week: about {w.perWeekNeeded} kg a week.</p>
      )}
      {(coach ? s.flags : s.flags.filter((f) => !/weight class limit/.test(f))).map((f) => (
        <p key={f} className="mt-2 rounded-lg bg-yellow-500/10 p-2 text-xs text-yellow-300">{f}</p>
      ))}
    </section>
  );
}
