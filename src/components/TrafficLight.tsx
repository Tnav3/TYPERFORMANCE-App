import type { Light } from "@/lib/load-metrics";
import { STATUS } from "@/lib/colors";

// Status is never colour alone: each light has an icon + a word.
const META: Record<Light, { color: string; icon: string; label: string }> = {
  red: { color: STATUS.critical, icon: "■", label: "Red" },
  amber: { color: STATUS.warning, icon: "▲", label: "Amber" },
  green: { color: STATUS.good, icon: "●", label: "Green" },
  none: { color: STATUS.none, icon: "○", label: "No baseline" },
};

export function TrafficLight({
  level,
  size = "md",
}: {
  level: Light;
  size?: "md" | "lg";
}) {
  const m = META[level];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-bold ${
        size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"
      }`}
      style={{
        borderColor: m.color,
        color: "var(--color-text)",
        background: `${m.color}22`,
      }}
    >
      <span aria-hidden style={{ color: m.color }}>
        {m.icon}
      </span>
      {m.label}
    </span>
  );
}
