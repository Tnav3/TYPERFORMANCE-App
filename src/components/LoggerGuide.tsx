"use client";
// First-workout walkthrough: dims the screen and points at one real control at a time.
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { dismissTip } from "@/app/tutorial/actions";
import { guideSteps, type GuideStep } from "@/lib/logger-guide";

const PAD = 6;
const el = (t: string) => document.querySelector<HTMLElement>(`[data-guide="${t}"]`);

export function LoggerGuide() {
  const [steps, setSteps] = useState<GuideStep[] | null>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);

  // Start once an exercise with sets is on screen (a warm-up text block may come first),
  // then work out which steps apply to this workout
  useEffect(() => {
    if (steps) return;
    const t = setInterval(() => {
      if (el("set")) {
        clearInterval(t);
        setTimeout(() => setSteps(guideSteps((x) => !!el(x))), 300);
      }
    }, 500);
    return () => clearInterval(t);
  }, [steps]);

  const step = steps?.[i];
  const measure = useCallback(() => {
    const e = step && el(step.target);
    setBox(e ? e.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    const e = step && el(step.target);
    if (!e) return;
    const r = e.getBoundingClientRect();
    const fixed = getComputedStyle(e.closest(".fixed") ?? document.body).position === "fixed";
    if (!fixed && (r.top < 80 || r.bottom > window.innerHeight - 260)) e.scrollIntoView({ block: "center" });
    measure();
    const t = setTimeout(measure, 350); // after smooth scroll settles
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [step, measure]);

  const done = useCallback(() => {
    setSteps([]);
    dismissTip("logger");
  }, []);

  useEffect(() => {
    if (!step) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && done();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [step, done]);

  if (!steps || !step) return null;
  const last = i === steps.length - 1;
  // Card goes below the target if there's room, otherwise above
  const below = box ? box.bottom + 220 < window.innerHeight : true;
  const cardTop = box ? (below ? box.bottom + PAD + 10 : undefined) : undefined;
  const cardBottom = box && !below ? window.innerHeight - box.top + PAD + 10 : undefined;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      {/* Click-blocker + spotlight */}
      <div className="absolute inset-0" />
      {box ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-brand transition-all duration-200"
          style={{ left: box.left - PAD, top: box.top - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2, boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/70" />
      )}
      <div
        className="absolute inset-x-3 mx-auto max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-2xl"
        style={{ top: cardTop, bottom: cardBottom ?? (cardTop == null ? 24 : undefined) }}
      >
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">First workout · {i + 1} of {steps.length}</p>
          {!last && (
            <button type="button" onClick={done} className="min-h-9 px-1 text-xs font-bold text-muted underline underline-offset-4">
              Skip
            </button>
          )}
        </div>
        <h2 id="guide-title" className="text-lg font-black uppercase leading-tight">{step.title}</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed">{step.body}</p>
        <div className="mt-3 flex gap-2">
          {i > 0 && (
            <button type="button" onClick={() => setI(i - 1)} className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold">
              Back
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => (last ? done() : setI(i + 1))}
            className="min-h-11 flex-1 rounded-xl bg-brand text-sm font-extrabold uppercase text-white"
          >
            {last ? "Start training" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
