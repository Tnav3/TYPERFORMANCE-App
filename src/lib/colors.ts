// Discipline colours for charts. Validated (dataviz validator, dark mode, surface #151517):
// all checks pass for slots 1–7. Colour follows the discipline (by creation order),
// never its rank, so reordering in Settings doesn't repaint charts.
export const SERIES = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];
export const OTHER = "#6b6b70";

// Status colours (fixed; always shown with an icon + label, never colour alone)
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
  none: "#6b6b70",
};

export function disciplineColors(
  disciplines: { id: string; created_at?: string }[],
): Record<string, string> {
  const byAge = [...disciplines].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  const out: Record<string, string> = {};
  byAge.forEach((d, i) => (out[d.id] = SERIES[i] ?? OTHER));
  return out;
}
