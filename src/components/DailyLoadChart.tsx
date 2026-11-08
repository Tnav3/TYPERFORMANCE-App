"use client";
import { useState } from "react";
import { useWidth } from "@/lib/use-width";
import type { DayTotals } from "@/lib/load-metrics";

const DAY = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  timeZone: "UTC",
});
const NUM = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  timeZone: "UTC",
});
const d = (iso: string) => new Date(iso + "T00:00:00Z");

/**
 * 7-day view: daily load as bars stacked by discipline.
 * Bars (not a line) because each day stands alone and rest days are real zeros.
 */
export function DailyLoadChart({
  days,
  disciplines,
  today,
}: {
  days: DayTotals[];
  disciplines: { id: string; name: string; color: string }[];
  today: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const lastLogged = days.map((x) => x.load > 0).lastIndexOf(true);
  const todayIdx = days.findIndex((x) => x.date === today);
  const [active, setActive] = useState(
    lastLogged >= 0 ? lastLogged : Math.max(0, todayIdx),
  );

  const W = width,
    H = 180,
    padL = 38,
    padB = 34,
    padT = 8;
  const max = Math.max(100, ...days.map((x) => x.load));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const plotH = H - padB - padT;
  const bw = (W - padL) / days.length;
  const barW = Math.min(34, bw * 0.6);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const used = disciplines.filter((ds) =>
    days.some((x) => (x.byDiscipline[ds.id] ?? 0) > 0),
  );
  const a = days[active];
  const color = (id: string) =>
    disciplines.find((x) => x.id === id)?.color ?? "#6b6b70";

  return (
    <div ref={ref}>
      {used.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {used.map((ds) => (
            <span key={ds.id} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: ds.color }}
              />
              {ds.name}
            </span>
          ))}
        </div>
      )}

      {a && (
        <div className="mb-2 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <span className="font-extrabold">
            {DAY.format(d(a.date))} {NUM.format(d(a.date))}
          </span>
          {a.load > 0 ? (
            <>
              <span>
                Load <b>{a.load}</b>
              </span>
              <span className="text-muted">
                {a.count} session{a.count === 1 ? "" : "s"} · {a.minutes} min
              </span>
              <span className="flex flex-wrap gap-x-3 text-muted">
                {used
                  .filter((ds) => (a.byDiscipline[ds.id] ?? 0) > 0)
                  .map((ds) => (
                    <span key={ds.id}>
                      {ds.name} {a.byDiscipline[ds.id]}
                    </span>
                  ))}
              </span>
            </>
          ) : (
            <span className="text-muted">
              {a.date > today ? "Not yet" : "Rest / nothing logged"}
            </span>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label="Daily training load this week"
      >
        {Array.from({ length: top / step + 1 }, (_, i) => i * step).map((v) => (
          <g key={v}>
            <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="#2a2a2e" />
            <text
              x={padL - 6}
              y={y(v) + 4}
              textAnchor="end"
              fontSize={11}
              fill="#a1a1aa"
            >
              {v}
            </text>
          </g>
        ))}
        {days.map((day, i) => {
          const cx = padL + bw * i + bw / 2;
          const segs = disciplines
            .map((ds) => ({ id: ds.id, load: day.byDiscipline[ds.id] ?? 0 }))
            .filter((s) => s.load > 0);
          // any discipline not in the list (shouldn't happen) still counts in the total
          const known = segs.reduce((s, x) => s + x.load, 0);
          if (day.load > known)
            segs.push({ id: "other", load: day.load - known });
          let acc = 0;
          const future = day.date > today;
          return (
            <g
              key={day.date}
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={padL + bw * i}
                y={padT}
                width={bw}
                height={plotH + padB}
                fill="transparent"
              />
              {i === active && (
                <rect
                  x={padL + bw * i + 2}
                  y={padT}
                  width={bw - 4}
                  height={plotH}
                  fill="#ffffff"
                  opacity={0.04}
                  rx={6}
                />
              )}
              {segs.map((s, j) => {
                const y0 = y(acc);
                acc += s.load;
                const y1 = y(acc);
                const isTop = j === segs.length - 1;
                return isTop ? (
                  <path
                    key={s.id}
                    d={roundedTop(cx - barW / 2, y1, barW, y0 - y1, 4)}
                    fill={color(s.id)}
                  />
                ) : (
                  <rect
                    key={s.id}
                    x={cx - barW / 2}
                    y={y1 + 2}
                    width={barW}
                    height={Math.max(0, y0 - y1 - 2)}
                    fill={color(s.id)}
                  />
                );
              })}
              {day.load === 0 && !future && (
                <text
                  x={cx}
                  y={y(0) - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#6b6b70"
                >
                  rest
                </text>
              )}
              <text
                x={cx}
                y={H - 18}
                textAnchor="middle"
                fontSize={11}
                fontWeight={i === active ? 800 : 400}
                fill={i === active ? "#f5f5f5" : future ? "#5a5a60" : "#a1a1aa"}
              >
                {DAY.format(d(day.date))}
              </text>
              <text
                x={cx}
                y={H - 5}
                textAnchor="middle"
                fontSize={10}
                fill={day.date === today ? "#d31820" : "#6b6b70"}
              >
                {day.date === today ? "Today" : NUM.format(d(day.date))}
              </text>
            </g>
          );
        })}
        <line x1={padL} x2={W} y1={y(0)} y2={y(0)} stroke="#a1a1aa" />
      </svg>

      <details className="mt-1 text-sm">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="py-1 pr-3">Day</th>
              <th className="py-1 pr-3">Sessions</th>
              <th className="py-1 pr-3">Minutes</th>
              <th className="py-1">Load</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date} className="border-t border-line">
                <td className="py-1 pr-3">
                  {DAY.format(d(day.date))} {NUM.format(d(day.date))}
                </td>
                <td className="py-1 pr-3">{day.count}</td>
                <td className="py-1 pr-3">{day.minutes}</td>
                <td className="py-1 font-bold">{day.load}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
