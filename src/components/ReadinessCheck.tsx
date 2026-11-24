"use client";
// Pre-session readiness questionnaire (TrainHeroic-style). Five taps + hours slept.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveReadiness } from "@/app/train/actions";
import { readinessAdvice, readinessScore, readinessTone } from "@/lib/programming/rewards";

const QUESTIONS = [
  { key: "sleep", label: "Sleep quality", low: "Terrible", high: "Great" },
  { key: "energy", label: "Energy", low: "Drained", high: "Buzzing" },
  { key: "soreness", label: "Muscle soreness", low: "None", high: "Very sore" },
  { key: "stress", label: "Stress", low: "Relaxed", high: "Very stressed" },
  { key: "motivation", label: "Motivation to train", low: "None", high: "Fired up" },
] as const;
type Key = (typeof QUESTIONS)[number]["key"];

export function ReadinessCheck() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Partial<Record<Key, number>>>({});
  const [hours, setHours] = useState("");
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (hidden) return null;
  const complete = QUESTIONS.every((q) => answers[q.key]);
  const score = complete ? readinessScore(answers as Record<Key, number>) : null;

  return (
    <section className="mb-5 rounded-2xl border border-brand/50 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-tight">Readiness check</h2>
        <button type="button" onClick={() => setHidden(true)} className="min-h-11 px-2 text-sm text-muted underline underline-offset-4">
          Skip
        </button>
      </div>
      <div className="space-y-4">
        {QUESTIONS.map((q) => (
          <fieldset key={q.key}>
            <legend className="mb-1.5 text-sm font-semibold">{q.label}</legend>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [q.key]: v }))}
                  aria-pressed={answers[q.key] === v}
                  className={`min-h-12 rounded-xl border text-lg font-black transition ${
                    answers[q.key] === v ? "border-brand bg-brand text-white" : "border-line bg-surface-2 text-muted"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="mt-0.5 flex justify-between text-[11px] text-muted">
              <span>{q.low}</span>
              <span>{q.high}</span>
            </div>
          </fieldset>
        ))}
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Hours slept (optional)</span>
          <input
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 7.5"
            className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-text focus:border-brand focus:outline-none"
          />
        </label>
      </div>
      {score != null && (
        <p className={`mt-3 text-sm ${readinessTone(score) === "ok" ? "text-ok" : readinessTone(score) === "warn" ? "text-warn" : "text-brand"}`}>
          <span className="text-2xl font-black">{score}</span> / 100 · {readinessAdvice(score)}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
      <button
        type="button"
        disabled={!complete || pending}
        onClick={() =>
          start(async () => {
            const r = await saveReadiness({
              ...(answers as Record<Key, number>),
              sleepHours: hours.trim() ? Number(hours.replace(",", ".")) : null,
            });
            if (r.ok) router.refresh();
            else setError(r.error);
          })
        }
        className="mt-4 min-h-12 w-full rounded-xl bg-brand font-extrabold uppercase tracking-wide text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Start workout"}
      </button>
    </section>
  );
}
