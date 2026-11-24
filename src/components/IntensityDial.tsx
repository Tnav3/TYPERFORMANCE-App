"use client";
// Session intensity 1–10: a big slider with the number and its meaning, plus last session for comparison.
import { useState } from "react";

const LABELS = ["Very light", "Very easy", "Easy", "Steady", "Moderate", "Moderate+", "Hard", "Very hard", "Near max", "Max effort"];
const tone = (v: number) => (v <= 3 ? "text-ok" : v <= 6 ? "text-warn" : "text-brand");

export function IntensityDial({ name, initial, last, disabled }: { name: string; initial: number | null; last: { rpe: number; date: string } | null; disabled?: boolean }) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-bold">How hard was this session?</p>
          <p className="text-sm text-muted">Rate the whole session, not your hardest set.</p>
        </div>
        <p className={`text-right ${v ? tone(v) : "text-muted"}`} aria-live="polite">
          <span className="block text-4xl font-black leading-none tabular-nums">{v ?? "–"}</span>
          <span className="text-xs font-bold">{v ? LABELS[v - 1] : "Slide to rate"}</span>
        </p>
      </div>
      <input type="hidden" name={name} value={v ?? ""} />
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={v ?? 5}
        disabled={disabled}
        onChange={(e) => setV(Number(e.target.value))}
        onClick={(e) => setV(Number((e.target as HTMLInputElement).value))}
        aria-label="Session intensity, 1 to 10"
        aria-valuetext={v ? `${v}, ${LABELS[v - 1]}` : "Not rated"}
        className={`intensity-range mt-3 w-full ${v ? "" : "opacity-60"}`}
      />
      <div className="mt-1 grid grid-cols-10 text-center text-[11px] font-bold text-muted">
        {LABELS.map((_, i) => (
          <button key={i} type="button" disabled={disabled} onClick={() => setV(i + 1)} className={`min-h-8 ${v === i + 1 ? tone(i + 1) : ""}`}>
            {i + 1}
          </button>
        ))}
      </div>
      {last && (
        <p className="mt-1 text-xs text-muted">
          Last session: <b className={tone(last.rpe)}>{last.rpe}</b> ({LABELS[last.rpe - 1].toLowerCase()}) on {last.date}
        </p>
      )}
    </div>
  );
}
