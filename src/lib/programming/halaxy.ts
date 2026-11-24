// Plain-text session summary for pasting into a clinical note (e.g. Halaxy SOAP "P").
// No formatting, no emojis: it has to read cleanly in any notes box. Pure.
export interface HalaxyLine {
  label: string; // "A1"
  name: string;
  swappedFrom?: string | null;
  swapReason?: string | null;
  prescribed: string;
  actual: string[]; // "5 × 100 kg"
  setsPlanned?: number | null;
  comment?: string | null;
  text?: boolean; // a notes block
  done?: boolean;
}

export function halaxySummary(s: {
  date: string; // "Wed 25 Nov 2026"
  title: string;
  rpe: number | null;
  minutes: number | null;
  readiness?: number | null;
  lines: HalaxyLine[];
  comment?: string | null;
}): string {
  const out: string[] = [];
  out.push(`Exercise session ${s.date}: ${s.title} (TYPERFORMANCE app).`);
  const head = [
    s.rpe != null && `Session RPE ${s.rpe}/10`,
    s.minutes != null && `${s.minutes} min`,
    s.rpe != null && s.minutes != null && `load ${s.rpe * s.minutes} AU`,
    s.readiness != null && `readiness ${s.readiness}/100`,
  ].filter(Boolean);
  if (head.length) out.push(head.join(", ") + ".");
  for (const l of s.lines) {
    if (l.text) {
      out.push(`${l.label} ${l.name}: ${l.done ? "completed" : "not marked done"}.${l.comment ? ` Client note: ${l.comment}` : ""}`);
      continue;
    }
    let line = `${l.label} ${l.name}`;
    if (l.swappedFrom) line += ` (substituted for ${l.swappedFrom}${l.swapReason ? `, reason: ${l.swapReason.toLowerCase()}` : ""})`;
    line += `. Prescribed ${l.prescribed || "as written"}.`;
    line += l.actual.length ? ` Completed ${l.actual.join(", ")}` : " Not completed";
    if (l.setsPlanned && l.actual.length && l.actual.length < l.setsPlanned) line += ` (${l.actual.length}/${l.setsPlanned} sets)`;
    line += ".";
    if (l.comment) line += ` Client note: ${l.comment}`;
    out.push(line);
  }
  if (s.comment) out.push(`Client comment: ${s.comment}`);
  return out.join("\n");
}
