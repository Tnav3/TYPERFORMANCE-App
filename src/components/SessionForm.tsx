"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import {
  saveSession,
  deleteSession,
  type SessionFormState,
} from "@/app/week/actions";
import type { CatalogDiscipline } from "@/lib/catalog";
import { DURATION_PRESETS, RPE_LABELS, sessionLoad } from "@/lib/scales";
import { dayMonth, dayShort } from "@/lib/week";
import { Alert, Button } from "./ui";
import { useClearableErrors } from "@/lib/use-clearable-errors";

export interface ExistingSession {
  id: string;
  session_date: string;
  start_time: string;
  duration_min: number;
  discipline_id: string;
  session_type_id: string;
  rpe: number;
  notes: string | null;
}

function Chip({
  selected,
  disabled,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-12 rounded-xl border px-3 font-semibold transition disabled:opacity-30 ${
        selected
          ? "border-brand bg-brand/15 text-text"
          : "border-line bg-surface-2 text-muted"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  error,
  children,
}: {
  title: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
        {title}
      </h2>
      {children}
      {error && <p className="mt-1.5 text-sm text-brand">{error}</p>}
    </section>
  );
}

export function SessionForm({
  week,
  days,
  today,
  catalog,
  existing,
  defaultDay,
}: {
  week: string;
  days: string[];
  today: string;
  catalog: CatalogDiscipline[];
  existing?: ExistingSession;
  defaultDay?: string;
}) {
  const [state, action, pending] = useActionState<SessionFormState, FormData>(
    saveSession,
    {},
  );
  const [, startTransition] = useTransition();
  const { err, clear } = useClearableErrors(state, state.errors ?? {});

  const [date, setDate] = useState(
    existing?.session_date ?? defaultDay ?? (days.includes(today) ? today : ""),
  );
  const [time, setTime] = useState(existing?.start_time.slice(0, 5) ?? "");
  const [disc, setDisc] = useState(existing?.discipline_id ?? "");
  const [type, setType] = useState(existing?.session_type_id ?? "");
  const initialDur = existing?.duration_min;
  const [duration, setDuration] = useState<number | null>(initialDur ?? null);
  const [custom, setCustom] = useState(
    initialDur != null && !DURATION_PRESETS.includes(initialDur),
  );
  const [rpe, setRpe] = useState<number | null>(existing?.rpe ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Show active disciplines/types, plus whatever this session already uses
  // Hide disciplines with no active session types (e.g. one the coach just added)
  const disciplines = catalog.filter(
    (d) =>
      (d.active && d.types.some((t) => t.active)) ||
      d.id === existing?.discipline_id,
  );
  const types = useMemo(
    () =>
      (catalog.find((d) => d.id === disc)?.types ?? []).filter(
        (t) => t.active || t.id === existing?.session_type_id,
      ),
    [catalog, disc, existing?.session_type_id],
  );

  const load = rpe && duration ? sessionLoad(rpe, duration) : null;

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    startTransition(() => action(fd));
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate>
        {state.message && <Alert>{state.message}</Alert>}
        {existing && <input type="hidden" name="id" value={existing.id} />}
        <input type="hidden" name="session_date" value={date} />
        <input type="hidden" name="discipline_id" value={disc} />
        <input type="hidden" name="session_type_id" value={type} />
        <input type="hidden" name="duration_min" value={duration ?? ""} />
        <input type="hidden" name="rpe" value={rpe ?? ""} />

        <Section title="Day" error={err("session_date")}>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => (
              <Chip
                key={d}
                selected={date === d}
                disabled={d > today}
                onClick={() => {
                  setDate(d);
                  clear("session_date");
                }}
                className="px-0 py-1.5"
              >
                <span className="block text-xs">{dayShort(d)}</span>
                <span className="block text-sm">
                  {dayMonth(d).split(" ")[0]}
                </span>
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Discipline" error={err("discipline_id")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {disciplines.map((d) => (
              <Chip
                key={d.id}
                selected={disc === d.id}
                onClick={() => {
                  if (disc !== d.id) setType("");
                  setDisc(d.id);
                  clear("discipline_id");
                }}
              >
                {d.name}
              </Chip>
            ))}
          </div>
        </Section>

        {disc && (
          <Section title="What did you do?" error={err("session_type_id")}>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => (
                <Chip
                  key={t.id}
                  selected={type === t.id}
                  onClick={() => {
                    setType(t.id);
                    clear("session_type_id");
                  }}
                >
                  {t.name}
                </Chip>
              ))}
            </div>
          </Section>
        )}

        <Section title="Duration (minutes)" error={err("duration_min")}>
          <div className="grid grid-cols-4 gap-2">
            {DURATION_PRESETS.map((m) => (
              <Chip
                key={m}
                selected={!custom && duration === m}
                onClick={() => {
                  setCustom(false);
                  setDuration(m);
                  clear("duration_min");
                }}
              >
                {m}
              </Chip>
            ))}
            <Chip
              selected={custom}
              onClick={() => setCustom(true)}
              className="col-span-2"
            >
              Other
            </Chip>
          </div>
          {custom && (
            <input
              inputMode="numeric"
              placeholder="Minutes, e.g. 50"
              defaultValue={custom && duration ? String(duration) : ""}
              onChange={(ev) => {
                const n = parseInt(ev.target.value, 10);
                setDuration(Number.isFinite(n) ? n : null);
                clear("duration_min");
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text focus:border-brand focus:outline-none"
            />
          )}
        </Section>

        <Section title="How hard was it? (RPE)" error={err("rpe")}>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-4xl font-black">{rpe ?? "–"}</span>
              <span className="text-right">
                <span className="block font-extrabold">
                  {rpe ? RPE_LABELS[rpe].label : "Slide to rate"}
                </span>
                <span className="block text-sm text-muted">
                  {rpe
                    ? RPE_LABELS[rpe].hint
                    : "Whole session, not your hardest round"}
                </span>
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={rpe ?? 5}
              onChange={(ev) => {
                setRpe(Number(ev.target.value));
                clear("rpe");
              }}
              onPointerDown={() => {
                if (rpe == null) setRpe(5);
                clear("rpe");
              }}
              aria-label="Session RPE"
              className={`h-10 w-full accent-brand ${rpe == null ? "opacity-40" : ""}`}
            />
            <div className="flex justify-between text-xs text-muted">
              <span>1 Very easy</span>
              <span>10 Max</span>
            </div>
          </div>
        </Section>

        <Section title="Notes (optional)" error={err("notes")}>
          <textarea
            name="notes"
            value={notes}
            onChange={(ev) => {
              setNotes(ev.target.value);
              clear("notes");
            }}
            maxLength={300}
            rows={2}
            placeholder="e.g. 5 x 3 min rounds, partner was heavier"
            className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none"
          />
        </Section>

        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {err("start_time") && (
            <p className="mx-auto mb-1.5 max-w-md text-sm text-brand">
              {err("start_time")}
            </p>
          )}
          <div className="mx-auto flex max-w-md items-end gap-3">
            <label className="w-[7.5rem] shrink-0">
              <span className="block text-xs uppercase tracking-widest text-muted">
                Start time
              </span>
              <input
                type="time"
                name="start_time"
                value={time}
                aria-invalid={!!err("start_time")}
                onChange={(ev) => {
                  setTime(ev.target.value);
                  clear("start_time");
                }}
                className={`mt-0.5 min-h-12 w-full rounded-xl border bg-surface-2 px-2 text-text focus:border-brand focus:outline-none ${
                  err("start_time") || !time ? "border-warn/70" : "border-line"
                }`}
              />
            </label>
            <div className="w-14 shrink-0">
              <p className="text-xs uppercase tracking-widest text-muted">
                Load
              </p>
              <p className="flex min-h-12 items-center text-xl font-black">
                {load ?? "–"}
              </p>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : existing ? "Update" : "Save"}
            </Button>
          </div>
        </div>
      </form>

      {existing && (
        <form action={deleteSession} className="mb-4">
          <input type="hidden" name="id" value={existing.id} />
          <input type="hidden" name="week" value={week} />
          {confirmDelete ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Keep it
              </Button>
              <Button type="submit" variant="danger">
                Yes, delete
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirmDelete(true)}
            >
              Delete session
            </Button>
          )}
        </form>
      )}
      {/* room for the fixed save bar */}
      <div className="h-36" aria-hidden />
    </>
  );
}
