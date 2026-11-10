import { Medal } from "lucide-react";
import {
  LEVEL_COLOR,
  LEVEL_LABEL,
  STANDARD_METRICS,
  formatMetric,
  levelOf,
  nextTarget,
  type Level,
  type Standard,
} from "@/lib/standards";
import { Card } from "./ui";

/** Small medal badge for lists. */
export function LevelBadge({ level }: { level: Level }) {
  if (level === "below") return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-black"
      style={{ background: LEVEL_COLOR[level] }}
    >
      <Medal size={12} strokeWidth={2.5} aria-hidden />
      {LEVEL_LABEL[level]}
    </span>
  );
}

/** Bronze → Silver → Gold track with the athlete's result marked on it. */
export function StandardsCard({
  testKey,
  standard,
  value,
  needsSex,
}: {
  testKey: string;
  standard: Standard | null;
  value: number | null;
  needsSex?: boolean;
}) {
  const m = STANDARD_METRICS[testKey];
  if (!m) return null;

  if (needsSex)
    return (
      <Card className="mb-4">
        <h2 className="text-lg font-black uppercase">Standards</h2>
        <p className="mt-1 text-sm text-muted">
          Add your sex in{" "}
          <a
            href="/profile"
            className="font-bold text-text underline underline-offset-4"
          >
            your profile
          </a>{" "}
          to see Bronze, Silver and Gold targets for this test.
        </p>
      </Card>
    );
  if (!standard) return null;

  const marks = (["bronze", "silver", "gold"] as const).filter(
    (l) => standard[l] != null,
  );
  const pts = marks.map((l) => standard[l] as number);
  // Scale: a little below the lowest mark to a little above the highest
  const lo = Math.min(...pts, value ?? Infinity);
  const hi = Math.max(...pts, value ?? -Infinity);
  const pad = (hi - lo || hi || 1) * 0.15;
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const pos = (n: number) => `${((n - min) / (max - min)) * 100}%`;
  const level = value != null ? levelOf(value, standard) : null;
  const next = value != null ? nextTarget(value, standard) : null;

  return (
    <Card className="mb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase leading-tight">
            Standards
          </h2>
          <p className="text-xs text-muted">{m.label}</p>
        </div>
        {level && level !== "below" && <LevelBadge level={level} />}
      </div>

      {/* Track */}
      <div
        className="relative mb-9 mt-9 h-2 rounded-full bg-surface-2"
        role="img"
        aria-label={`Bronze ${standard.bronze ?? "not set"}, Silver ${standard.silver ?? "not set"}, Gold ${standard.gold ?? "not set"}${value != null ? `, you ${value}` : ""}`}
      >
        {marks.map((l, i) => {
          const from = standard[l] as number;
          const to =
            i < marks.length - 1 ? (standard[marks[i + 1]] as number) : max;
          return (
            <span
              key={l}
              className="absolute top-0 h-2"
              style={{
                left: pos(from),
                width: `calc(${pos(to)} - ${pos(from)})`,
                background: LEVEL_COLOR[l],
                opacity: 0.85,
              }}
            />
          );
        })}
        {marks.map((l) => (
          <span
            key={`t-${l}`}
            className="absolute top-3 -translate-x-1/2 whitespace-nowrap text-center text-[11px] leading-tight"
            style={{ left: pos(standard[l] as number) }}
          >
            <span
              className="block font-extrabold uppercase"
              style={{ color: LEVEL_COLOR[l] }}
            >
              {l}
            </span>
            <span className="text-muted">
              {(standard[l] as number).toFixed(m.dp)}
            </span>
          </span>
        ))}
        {value != null && (
          <span
            className="absolute -top-8 -translate-x-1/2 text-center"
            style={{ left: pos(value) }}
          >
            <span className="block whitespace-nowrap rounded-md bg-text px-1.5 py-0.5 text-[11px] font-black text-black">
              You {value.toFixed(m.dp)}
            </span>
            <span className="mx-auto block h-4 w-0.5 bg-text" />
          </span>
        )}
      </div>

      {value == null ? (
        <p className="text-sm text-muted">
          {m.needsBodyweight
            ? "Enter a result with your bodyweight to see where you sit."
            : "Enter a result to see where you sit."}
        </p>
      ) : next ? (
        <p className="text-sm">
          <b>Next: {LEVEL_LABEL[next.level]}</b> at{" "}
          {formatMetric(next.at, testKey)}{" "}
          <span className="text-muted">
            ({formatMetric(next.gap, testKey).replace(/^/, "+")} to go)
          </span>
        </p>
      ) : (
        <p className="text-sm font-bold">
          You&apos;ve hit Gold. Keep pushing your own best.
        </p>
      )}
      {standard.source && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted underline underline-offset-4">
            Where these numbers come from
          </summary>
          <p className="mt-1 text-xs text-muted">{standard.source}</p>
        </details>
      )}
    </Card>
  );
}
