"use client";
import { useActionState, useState, useTransition } from "react";
import { saveCoachNote, type NoteState } from "@/app/coach/actions";

export function CoachNoteForm({
  athleteId,
  week,
  initial,
}: {
  athleteId: string;
  week: string;
  initial: { note: string; visible_to_athlete: boolean } | null;
}) {
  const [state, action, pending] = useActionState<NoteState, FormData>(
    saveCoachNote,
    {},
  );
  const [, startTransition] = useTransition();
  const [text, setText] = useState(initial?.note ?? "");
  const [visible, setVisible] = useState(initial?.visible_to_athlete ?? false);
  // What was last sent; only counts as the saved baseline once the server confirms
  const [sent, setSent] = useState({
    text: initial?.note ?? "",
    visible: initial?.visible_to_athlete ?? false,
  });
  const baseline = state.saved
    ? sent
    : {
        text: initial?.note ?? "",
        visible: initial?.visible_to_athlete ?? false,
      };
  const dirty =
    text.trim() !== baseline.text.trim() || visible !== baseline.visible;

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    setSent({ text, visible });
    startTransition(() => action(fd));
  }

  return (
    <form onSubmit={onSubmit} className="mt-3">
      <input type="hidden" name="athlete_id" value={athleteId} />
      <input type="hidden" name="week_start" value={week} />
      <textarea
        name="note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Coach note for this week…"
        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-brand focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="visible"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="h-5 w-5 accent-brand"
          />
          Show to athlete
        </label>
        <div className="flex items-center gap-3">
          {state.message && (
            <span className="text-xs text-brand">{state.message}</span>
          )}
          {!dirty && state.saved && !pending && (
            <span className="text-xs text-ok">Saved</span>
          )}
          <button
            disabled={!dirty || pending}
            className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase tracking-wide text-white disabled:opacity-30"
          >
            {pending ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>
    </form>
  );
}
