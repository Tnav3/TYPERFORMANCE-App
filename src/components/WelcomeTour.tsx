"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { finishTutorial } from "@/app/tutorial/actions";
import type { TourStep } from "@/lib/tutorial";

/** Full-screen, skippable welcome walkthrough shown once. */
export function WelcomeTour({ steps }: { steps: TourStep[] }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus(), [i]);
  if (!open || steps.length === 0) return null;

  const step = steps[i];
  const last = i === steps.length - 1;
  const close = () => {
    setOpen(false);
    startTransition(() => finishTutorial());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/90 p-4 backdrop-blur sm:items-center"
    >
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {i + 1} of {steps.length}
          </p>
          {!last && (
            <button
              type="button"
              onClick={close}
              className="min-h-10 px-2 text-sm font-bold text-muted underline underline-offset-4"
            >
              Skip tour
            </button>
          )}
        </div>
        <h2
          id="tour-title"
          ref={titleRef}
          tabIndex={-1}
          className="text-2xl font-black uppercase leading-tight tracking-tight outline-none"
        >
          {step.title}
        </h2>
        <p className="mt-3 min-h-24 text-[15px] leading-relaxed">{step.body}</p>
        <div className="mt-5 flex gap-1.5" aria-hidden>
          {steps.map((s, k) => (
            <span
              key={s.key}
              className={`h-1.5 flex-1 rounded-full ${k <= i ? "bg-brand" : "bg-surface-2"}`}
            />
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI(i - 1)}
              className="min-h-12 flex-1 rounded-xl border border-line bg-surface-2 font-extrabold uppercase tracking-wide"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? close() : setI(i + 1))}
            className="min-h-12 flex-[2] rounded-xl bg-brand font-extrabold uppercase tracking-wide text-white"
          >
            {last ? "Let's go" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
