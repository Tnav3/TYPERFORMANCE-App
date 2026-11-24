// Season timeline: phases as coloured bars, fights as markers, today line,
// assigned programs underneath (so gaps between plan and reality are obvious).
import { addDays } from "@/lib/week";
import { dayMonth } from "@/lib/week";
import { EMPHASIS_COLOR, phaseWeeks, pos } from "@/lib/programming/periodisation";

export interface PhaseRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  emphasis: string[];
  load_pattern: string;
}

export function SeasonTimeline({
  phases,
  fights,
  assigned,
  today,
}: {
  phases: PhaseRow[];
  fights: { date: string; label: string }[];
  assigned: { label: string; start: string; end: string }[];
  today: string;
}) {
  if (!phases.length && !fights.length)
    return <p className="rounded-xl border border-dashed border-line p-4 text-center text-muted">Add the first phase below.</p>;
  const dates = [
    ...phases.flatMap((p) => [p.start_date, p.end_date]),
    ...fights.map((f) => f.date),
    ...assigned.flatMap((a) => [a.start, a.end]),
    today,
  ].sort();
  const from = addDays(dates[0], -3);
  const to = addDays(dates[dates.length - 1], 3);
  const months: string[] = [];
  for (let d = from.slice(0, 8) + "01"; d <= to; ) {
    if (d >= from) months.push(d);
    const [y, m] = d.split("-").map(Number);
    d = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  }

  return (
    <div className="overflow-x-auto">
      <div className="relative min-w-[640px] pb-2">
        {/* months */}
        <div className="relative h-5 text-[10px] uppercase tracking-widest text-muted">
          {months.map((m) => (
            <span key={m} className="absolute" style={{ left: `${pos(m, from, to)}%` }}>
              {dayMonth(m).split(" ")[1]}
            </span>
          ))}
        </div>
        {/* phases */}
        <div className="relative h-14 rounded-lg bg-surface-2">
          {phases.map((p) => {
            const left = pos(p.start_date, from, to);
            const width = Math.max(1, pos(addDays(p.end_date, 1), from, to) - left);
            const color = EMPHASIS_COLOR.get(p.emphasis[0] ?? "") ?? "#52525b";
            return (
              <a
                key={p.id}
                href={`#phase-${p.id}`}
                className="absolute top-1 bottom-1 overflow-hidden rounded-md px-1.5 py-1 text-[11px] font-bold leading-tight text-white"
                style={{ left: `${left}%`, width: `${width}%`, background: color }}
                title={`${p.name}: ${p.start_date} → ${p.end_date}`}
              >
                <span className="block truncate">{p.name}</span>
                <span className="block truncate font-normal opacity-80">{dayMonth(p.start_date)}</span>
              </a>
            );
          })}
        </div>
        {/* weekly load bars */}
        <div className="relative mt-1 h-10">
          {phases.flatMap((p) =>
            phaseWeeks(p.start_date, p.end_date, p.load_pattern).map((w) => {
              const left = pos(w.start, from, to);
              const width = Math.max(0.5, pos(addDays(w.start, 6), from, to) - left);
              return (
                <span
                  key={`${p.id}-${w.index}`}
                  className={`absolute bottom-0 rounded-sm ${w.kind === "deload" ? "bg-line" : "bg-brand/60"}`}
                  style={{ left: `${left}%`, width: `calc(${width}% - 2px)`, height: `${Math.round(w.rel * 70)}%` }}
                  title={`Week ${w.index}: ${w.kind}`}
                />
              );
            }),
          )}
        </div>
        {/* assigned programs */}
        <div className="relative mt-1 h-6">
          {assigned.map((a, i) => {
            const left = pos(a.start, from, to);
            const width = Math.max(1, pos(addDays(a.end, 1), from, to) - left);
            return (
              <span
                key={i}
                className="absolute top-0 h-5 truncate rounded border border-ok/60 bg-ok/10 px-1 text-[10px] leading-5 text-ok"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`Assigned: ${a.label}`}
              >
                {a.label}
              </span>
            );
          })}
        </div>
        {/* today + fights */}
        <span className="absolute top-5 bottom-0 w-0.5 bg-text/70" style={{ left: `${pos(today, from, to)}%` }} title="Today" />
        {fights.map((f) => (
          <span
            key={f.date}
            className="absolute top-3 -ml-2 flex flex-col items-center"
            style={{ left: `${pos(f.date, from, to)}%` }}
            title={`Fight ${f.date}`}
          >
            <span className="rounded bg-brand px-1 text-[10px] font-black text-white">🥊 {dayMonth(f.date)}</span>
          </span>
        ))}
      </div>
      <p className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted">
        <span>Bars: weekly load (grey = deload)</span>
        <span className="text-ok">Green: programs actually assigned</span>
        <span>White line: today</span>
      </p>
    </div>
  );
}
