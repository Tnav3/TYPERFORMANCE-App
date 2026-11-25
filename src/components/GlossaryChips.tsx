"use client";
// Small "?" chips under an exercise for any training terms it uses (AMRAP, tempo, RIR…).
// Tap one for the explanation without leaving the workout.
import { useEffect, useState } from "react";
import Link from "next/link";
import { HelpCircle, X } from "lucide-react";
import type { GlossaryTerm } from "@/lib/glossary";
import { GlossaryBody } from "@/components/GlossaryEntry";

const short = (t: GlossaryTerm) => t.title.replace(/\s*\(.*\)$/, "");

export function GlossaryChips({ terms, backTo }: { terms: GlossaryTerm[]; backTo?: string }) {
  const [open, setOpen] = useState<GlossaryTerm | null>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  if (!terms.length) return null;
  return (
    <>
      <span className="mt-1 flex flex-wrap gap-1.5">
        {terms.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setOpen(t)}
            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 text-xs font-bold text-muted hover:border-brand hover:text-text"
            aria-label={`What is ${short(t)}?`}
          >
            <HelpCircle size={13} className="text-brand" /> {short(t)}
          </button>
        ))}
      </span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={open.title}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-lg font-black uppercase leading-tight">{open.title}</h2>
              <button type="button" onClick={() => setOpen(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <GlossaryBody t={open} />
            <Link href={`/learn${backTo ? `?from=${encodeURIComponent(backTo)}` : ""}`} className="mt-4 inline-block text-sm font-bold text-brand underline underline-offset-4">
              All training terms
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
