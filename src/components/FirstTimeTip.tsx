"use client";
import { useState, useTransition } from "react";
import { Lightbulb } from "lucide-react";
import { dismissTip } from "@/app/tutorial/actions";

/** One-time "how to use this" card at the top of a feature. */
export function FirstTimeTip({
  tipKey,
  title,
  body,
}: {
  tipKey: string;
  title: string;
  body: string;
}) {
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();
  if (!open) return null;
  return (
    <div className="mb-4 rounded-2xl border border-brand/60 bg-brand/10 p-4">
      <div className="flex items-start gap-3">
        <Lightbulb
          size={20}
          className="mt-0.5 shrink-0 text-brand"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{title}</p>
          <p className="mt-1 text-sm leading-relaxed">{body}</p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              startTransition(() => dismissTip(tipKey));
            }}
            className="mt-3 min-h-10 rounded-lg bg-brand px-4 text-sm font-extrabold uppercase tracking-wide text-white"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
