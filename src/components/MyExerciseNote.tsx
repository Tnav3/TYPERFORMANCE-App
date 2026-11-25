"use client";
// The client's own setup note on an exercise: rack height, seat position, Keiser settings.
import { useState, useTransition } from "react";
import { NotebookPen } from "lucide-react";
import { setExerciseNote } from "@/app/notes/actions";
import { actionErrorMessage } from "@/lib/action-error";

export function MyExerciseNote({ exerciseId, initial, readOnly }: { exerciseId: string; initial: string | null; readOnly?: boolean }) {
  const [note, setNote] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (readOnly && !note) return null;
  if (!editing)
    return note ? (
      <button type="button" onClick={() => !readOnly && (setDraft(note), setEditing(true))} className="mt-1 flex w-full items-start gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-left text-xs">
        <NotebookPen size={13} className="mt-0.5 shrink-0 text-brand" />
        <span className="whitespace-pre-line">{note}</span>
      </button>
    ) : (
      <button type="button" onClick={() => (setDraft(""), setEditing(true))} className="mt-1 inline-flex min-h-8 items-center gap-1.5 text-xs font-bold text-muted hover:text-text">
        <NotebookPen size={13} /> Add my setup note
      </button>
    );
  return (
    <div className="mt-1 rounded-lg border border-line bg-surface-2 p-2">
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="e.g. Rack hole 7, safeties on 4, seat 3"
        className="w-full resize-none bg-transparent text-sm text-text placeholder:text-muted/60 focus:outline-none"
      />
      {err && <p className="text-xs text-brand">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="min-h-8 px-2 text-xs text-muted">Cancel</button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErr(null);
              try {
                const r = await setExerciseNote(exerciseId, draft);
                if (!r.ok) return setErr(r.error ?? "Couldn't save.");
                setNote(draft.trim());
                setEditing(false);
              } catch (e) {
                setErr(actionErrorMessage(e));
              }
            })
          }
          className="min-h-8 rounded-lg bg-brand px-3 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
