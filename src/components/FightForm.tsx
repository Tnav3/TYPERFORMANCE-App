"use client";
import { useActionState, useState, useTransition } from "react";
import { saveFight, type FightState } from "@/app/fights/actions";
import { MAX_ROUNDS, RESULT_LABEL, type FightResult } from "@/lib/fights";
import { Alert, Button } from "./ui";

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text focus:border-brand focus:outline-none";

export function FightForm({
  athleteId,
  defaultDate,
  today,
}: {
  athleteId?: string;
  defaultDate: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<FightState, FormData>(
    saveFight,
    {},
  );
  const [, startTransition] = useTransition();
  const [date, setDate] = useState(defaultDate);
  const [result, setResult] = useState<FightResult | "">("");
  const [rounds, setRounds] = useState(3);
  const [shown, setShown] = useState<FightState | null>(null);
  const live = shown === state ? {} : state;

  if (live.saved)
    return (
      <div>
        <Alert tone="ok">Fight saved.</Alert>
        <button
          type="button"
          onClick={() => {
            setShown(state);
            setResult("");
          }}
          className="mt-3 min-h-12 w-full rounded-xl border border-line bg-surface-2 text-sm font-extrabold uppercase tracking-wide"
        >
          Log another fight
        </button>
      </div>
    );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {athleteId && <input type="hidden" name="athlete_id" value={athleteId} />}
      <input type="hidden" name="result" value={result} />
      <input type="hidden" name="rounds" value={rounds} />

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-semibold">Fight date</span>
        <input
          type="date"
          name="fought_on"
          max={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputCls}
        />
        {live.errors?.date && (
          <span className="mt-1 block text-sm text-brand">
            {live.errors.date}
          </span>
        )}
      </label>

      <fieldset className="mb-4">
        <legend className="mb-1.5 text-sm font-semibold">Result</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["win", "loss", "draw"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={result === r}
              onClick={() => setResult(r)}
              className={`min-h-12 rounded-xl border text-sm font-extrabold uppercase tracking-wide ${
                result === r
                  ? r === "win"
                    ? "border-ok bg-ok text-black"
                    : r === "loss"
                      ? "border-brand bg-brand text-white"
                      : "border-warn bg-warn text-black"
                  : "border-line bg-surface-2 text-muted"
              }`}
            >
              {RESULT_LABEL[r]}
            </button>
          ))}
        </div>
        {live.errors?.result && (
          <span className="mt-1 block text-sm text-brand">
            {live.errors.result}
          </span>
        )}
      </fieldset>

      <div className="mb-5">
        <span className="mb-1.5 block text-sm font-semibold">
          Rounds the fight went
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="One less round"
            onClick={() => setRounds((n) => Math.max(1, n - 1))}
            className="min-h-12 min-w-12 rounded-xl border border-line bg-surface-2 text-xl font-black"
          >
            −
          </button>
          <span
            className="min-w-12 text-center text-3xl font-black"
            aria-live="polite"
          >
            {rounds}
          </span>
          <button
            type="button"
            aria-label="One more round"
            onClick={() => setRounds((n) => Math.min(MAX_ROUNDS, n + 1))}
            className="min-h-12 min-w-12 rounded-xl border border-line bg-surface-2 text-xl font-black"
          >
            +
          </button>
          <span className="text-sm text-muted">
            e.g. stopped in round 2 = 2
          </span>
        </div>
        {live.errors?.rounds && (
          <span className="mt-1 block text-sm text-brand">
            {live.errors.rounds}
          </span>
        )}
      </div>

      {live.message && <Alert>{live.message}</Alert>}
      <Button disabled={pending}>{pending ? "Saving…" : "Save fight"}</Button>
    </form>
  );
}
