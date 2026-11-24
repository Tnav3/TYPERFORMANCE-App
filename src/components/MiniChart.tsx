import type { Point } from "@/lib/programming/widgets";

/** Tiny server-rendered chart: bars for weekly totals (current week faded), a line for measurements. */
export function MiniChart({ points, kind, className = "" }: { points: Point[]; kind: "bars" | "line"; className?: string }) {
  const W = 160;
  const H = 44;
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  if (!vals.length) return <div className={`h-11 rounded-md bg-surface-2 ${className}`} aria-hidden />;
  const max = Math.max(...vals);
  const min = kind === "line" ? Math.min(...vals) : 0;
  const span = max - min || 1;
  const y = (v: number) => H - 3 - ((v - min) / span) * (H - 8);
  if (kind === "bars") {
    const bw = W / points.length;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={`h-11 w-full ${className}`} aria-hidden preserveAspectRatio="none">
        {points.map((p, i) => {
          const h = p.value ? Math.max(2, ((p.value - min) / span) * (H - 6)) : 2;
          return (
            <rect
              key={p.label}
              x={i * bw + bw * 0.18}
              y={H - h}
              width={bw * 0.64}
              height={h}
              rx={2}
              className={i === points.length - 1 ? "fill-brand/35" : "fill-brand"}
            />
          );
        })}
      </svg>
    );
  }
  const pts = points
    .map((p, i) => (p.value == null ? null : [(i / Math.max(1, points.length - 1)) * (W - 6) + 3, y(p.value)]))
    .filter((p): p is number[] => p != null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-11 w-full ${className}`} aria-hidden preserveAspectRatio="none">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="stroke-brand" vectorEffect="non-scaling-stroke" />
      {pts.length > 0 && <line x1={pts[pts.length - 1][0]} y1={pts[pts.length - 1][1]} x2={pts[pts.length - 1][0]} y2={pts[pts.length - 1][1]} strokeWidth={8} strokeLinecap="round" className="stroke-brand" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
