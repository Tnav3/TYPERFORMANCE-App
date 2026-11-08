"use client";
import { useState } from "react";
import { useWidth } from "@/lib/use-width";
import type { Light } from "@/lib/load-metrics";
import { formatChange } from "@/lib/load-metrics";
import { TrafficLight } from "./TrafficLight";

export interface LoadChartWeek {
  week: string;
  label: string; // "2 Nov"
  total: number;
  segments: { id: string; load: number }[]; // by discipline
  changePct: number | null;
  light: Light;
  isFightWeek?: boolean;
  inProgress?: boolean;
}

/** Weekly load, stacked by discipline. Tap/hover a bar for the breakdown. */
export function LoadChart({
  weeks,
  disciplines,
}: {
  weeks: LoadChartWeek[];
  disciplines: { id: string; name: string; color: string }[];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  // Open on the last COMPLETED week (the current one is still filling up)
  const lastDone = weeks.map((w) => !w.inProgress).lastIndexOf(true);
  const [active, setActive] = useState<number>(
    lastDone >= 0 ? lastDone : weeks.length - 1,
  );
  const W = width,
    H = 220,
    padL = 40,
    padB = 26,
    padT = 10;
  const max = Math.max(100, ...weeks.map((w) => w.total));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const plotH = H - padB - padT;
  const bw = (W - padL) / weeks.length;
  const barW = Math.min(36, bw * 0.62);
  const labelEvery = bw < 44 ? 2 : 1; // thin x labels on narrow screens
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const used = disciplines.filter((d) =>
    weeks.some((w) => w.segments.some((s) => s.id === d.id && s.load > 0)),
  );
  const a = weeks[active];

  return (
    <div ref={ref}>
      {/* Legend (always present for >1 series) */}
      {used.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {used.map((d) => (
            <span key={d.id} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: d.color }}
              />
              {d.name}
            </span>
          ))}
        </div>
      )}

      {/* Readout for the selected week */}
      {a && (
        <div className="mb-2 flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <span className="font-extrabold">
            Week of {a.label}
            {a.inProgress ? " (in progress)" : ""}
          </span>
          <span>
            Load <b>{a.total}</b>{" "}
            {!a.inProgress && (
              <span className="text-muted">{formatChange(a.changePct)}</span>
            )}
          </span>
          {!a.inProgress && <TrafficLight level={a.light} />}
          <span className="flex flex-wrap gap-x-3 text-muted">
            {a.segments
              .filter((s) => s.load > 0)
              .map((s) => {
                const d = disciplines.find((x) => x.id === s.id);
                return (
                  <span key={s.id}>
                    {d?.name ?? "Other"} {s.load}
                  </span>
                );
              })}
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Weekly training load by discipline"
      >
        {/* recessive grid */}
        {Array.from({ length: top / step + 1 }, (_, i) => i * step).map((v) => (
          <g key={v}>
            <line
              x1={padL}
              x2={W}
              y1={y(v)}
              y2={y(v)}
              stroke="#2a2a2e"
              strokeWidth={1}
            />
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
        {weeks.map((w, i) => {
          const cx = padL + bw * i + bw / 2;
          let acc = 0;
          const segs = w.segments.filter((s) => s.load > 0);
          return (
            <g
              key={w.week}
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              style={{ cursor: "pointer" }}
            >
              {/* hit target bigger than the bar */}
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
                const h = Math.max(0, y0 - y1 - (j < segs.length - 1 ? 2 : 0)); // 2px gap between segments
                const isTop = j === segs.length - 1;
                const color = disciplinesColor(disciplines, s.id);
                return isTop ? (
                  <path
                    key={s.id}
                    d={roundedTop(cx - barW / 2, y1, barW, y0 - y1, 4)}
                    fill={color}
                    opacity={w.inProgress ? 0.45 : 1}
                  />
                ) : (
                  <rect
                    key={s.id}
                    x={cx - barW / 2}
                    y={y1 + 2}
                    width={barW}
                    height={h}
                    fill={color}
                    opacity={w.inProgress ? 0.45 : 1}
                  />
                );
              })}
              {w.isFightWeek && (
                <text
                  x={cx}
                  y={padT + 10}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={800}
                  fill="#f5f5f5"
                >
                  FIGHT
                </text>
              )}
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fill={i === active ? "#f5f5f5" : "#a1a1aa"}
              >
                {i % labelEvery === 0 || i === active ? w.label : ""}
              </text>
            </g>
          );
        })}
        <line
          x1={padL}
          x2={W}
          y1={y(0)}
          y2={y(0)}
          stroke="#a1a1aa"
          strokeWidth={1}
        />
      </svg>

      {/* Table view (accessibility / exact numbers) */}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-3">Week</th>
                {used.map((d) => (
                  <th key={d.id} className="py-1 pr-3">
                    {d.name}
                  </th>
                ))}
                <th className="py-1 pr-3">Total</th>
                <th className="py-1">Change</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week} className="border-t border-line">
                  <td className="py-1 pr-3">{w.label}</td>
                  {used.map((d) => (
                    <td key={d.id} className="py-1 pr-3">
                      {w.segments.find((s) => s.id === d.id)?.load ?? 0}
                    </td>
                  ))}
                  <td className="py-1 pr-3 font-bold">{w.total}</td>
                  <td className="py-1">
                    {w.inProgress ? "in progress" : formatChange(w.changePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function disciplinesColor(ds: { id: string; color: string }[], id: string) {
  return ds.find((d) => d.id === id)?.color ?? "#6b6b70";
}

function niceStep(max: number) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  if (h <= 0) return "";
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
