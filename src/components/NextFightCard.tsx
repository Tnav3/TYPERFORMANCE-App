"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addPlannedFight, removePlannedFight, type PlannedState } from "@/app/athlete/actions";
import { MAX_PLANNED } from "@/lib/planned-fights";
import { Card } from "./ui";

export type PlannedView = { date: string; label: string; dateLabel: string; past: boolean };

export function NextFightCard({ fights, today }: { fights: PlannedView[]; today: string }) {
  const [state, action, pending] = useActionState<PlannedState, FormData>(addPlannedFight, {});
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");

  // Close the form after a successful add
  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setDate("");
    }
  }, [state.ok]);

  const [first, second] = fights;
  const canAdd = fights.length < MAX_PLANNED;

  return (
    <Card className={`mb-4 ${first?.past ? "border-warn/60" : first ? "border-brand/60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-black uppercase leading-tight tracking-tight">Next fight</p>
        {canAdd && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-mr-1 -mt-1 flex min-h-9 items-center gap-1 rounded-full border border-line bg-surface-2 px-3 text-xs font-extrabold uppercase tracking-wide text-muted hover:text-text"
          >
            <Plus size={14} strokeWidth={3} aria-hidden /> Add fight
          </button>
        )}
      </div>

      {first ? (
        <div className="mt-1 flex items-start justify-between gap-3">
          <div>
            <p className="text-3xl font-black">{first.label}</p>
            <p className="text-sm text-muted">{first.dateLabel}</p>
          </div>
          <RemoveButton date={first.date} label={first.dateLabel} />
        </div>
      ) : (
        !open && <p className="mt-1 text-sm text-muted">No fight booked yet.</p>
      )}

      {second && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-sm">
            <span className="font-bold">Then:</span> {second.dateLabel}{" "}
            <span className="text-muted">· {second.label}</span>
          </p>
          <RemoveButton date={second.date} label={second.dateLabel} />
        </div>
      )}

      {open && (
        <form
          className="mt-3 flex gap-2 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => action(fd));
          }}
        >
          <input
            type="date"
            name="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Fight date"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-text focus:border-brand focus:outline-none"
          />
          <button
            disabled={pending || !date}
            className="min-h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white disabled:opacity-50"
          >
            {pending ? "…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cancel"
            className="min-h-11 min-w-11 shrink-0 rounded-xl border border-line text-muted"
          >
            <X size={16} className="mx-auto" aria-hidden />
          </button>
        </form>
      )}
      {open && state.error && <p className="mt-2 text-sm text-brand">{state.error}</p>}
    </Card>
  );
}

function RemoveButton({ date, label }: { date: string; label: string }) {
  return (
    <form action={removePlannedFight}>
      <input type="hidden" name="date" value={date} />
      <button
        aria-label={`Remove fight on ${label}`}
        className="flex min-h-9 min-w-9 items-center justify-center rounded-full text-muted hover:text-brand"
      >
        <X size={16} aria-hidden />
      </button>
    </form>
  );
}
