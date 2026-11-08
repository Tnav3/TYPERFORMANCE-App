"use client";
import { useState } from "react";
import { useWidth } from "@/lib/use-width";

/** Bodyweight per week with the weight-class limit as a dashed reference line. */
export function WeightChart({
  points,
  limit,
}: {
  points: { week: string; label: string; kg: number | null }[];
  limit: number | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const withData = points.filter((p) => p.kg != null) as {
    week: string;
    label: string;
    kg: number;
  }[];
  const [active, setActive] = useState<number | null>(
    withData.length
      ? points.indexOf(withData[withData.length - 1] as never)
      : null,
  );
  if (withData.length === 0)
    return <p className="text-sm text-muted">No bodyweights logged yet.</p>;

  const W = width,
    H = 170,
    padL = 40,
    padB = 26,
    padT = 14;
  const vals = withData.map((p) => p.kg).concat(limit != null ? [limit] : []);
  const lo = Math.floor(Math.min(...vals) - 1);
  const hi = Math.ceil(Math.max(...vals) + 1);
  const plotH = H - padB - padT;
  const bw = (W - padL) / points.length;
  const labelEvery = bw < 44 ? 2 : 1; // thin x labels on narrow screens
  const x = (i: number) => padL + bw * i + bw / 2;
  const y = (v: number) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
  const path = points
    .map((p, i) => (p.kg == null ? null : `${x(i)},${y(p.kg)}`))
    .filter(Boolean)
    .join(" L");
  const a = active != null ? points[active] : null;

  return (
    <div ref={ref}>
      <div className="mb-2 flex min-h-10 flex-wrap items-center gap-x-4 rounded-xl bg-surface-2 px-3 py-2 text-sm">
        {a?.kg != null ? (
          <>
            <span className="font-extrabold">Week of {a.label}</span>
            <span>
              <b>{a.kg} kg</b>
            </span>
            {limit != null && (
              <span className="text-muted">
                {a.kg - limit > 0
                  ? `${Math.round((a.kg - limit) * 10) / 10} kg over`
                  : `${Math.round((limit - a.kg) * 10) / 10} kg under`}{" "}
                {limit} kg limit
              </span>
            )}
          </>
        ) : (
          <span className="text-muted">Tap a point</span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Bodyweight by week"
      >
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="#2a2a2e" />
            <text
              x={padL - 6}
              y={y(v) + 4}
              textAnchor="end"
              fontSize={11}
              fill="#a1a1aa"
            >
              {Math.round(v * 10) / 10}
            </text>
          </g>
        ))}
        {limit != null && (
          <g>
            <line
              x1={padL}
              x2={W}
              y1={y(limit)}
              y2={y(limit)}
              stroke="#a1a1aa"
              strokeDasharray="5 4"
              strokeWidth={1.5}
            />
            <text
              x={padL + 4}
              y={y(limit) - 5}
              textAnchor="start"
              fontSize={11}
              fill="#a1a1aa"
            >
              Limit {limit} kg
            </text>
          </g>
        )}
        <path
          d={`M${path}`}
          fill="none"
          stroke="#3987e5"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g
            key={p.week}
            onMouseEnter={() => p.kg != null && setActive(i)}
            onClick={() => p.kg != null && setActive(i)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={padL + bw * i}
              y={padT}
              width={bw}
              height={plotH + padB}
              fill="transparent"
            />
            {p.kg != null && (
              <circle
                cx={x(i)}
                cy={y(p.kg)}
                r={i === active ? 6 : 4.5}
                fill="#3987e5"
                stroke="#151517"
                strokeWidth={2}
              />
            )}
            <text
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={11}
              fill={i === active ? "#f5f5f5" : "#a1a1aa"}
            >
              {i % labelEvery === 0 || i === active ? p.label : ""}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
