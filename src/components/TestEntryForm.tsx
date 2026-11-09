"use client";
import { useActionState, useState, useTransition } from "react";
import { saveTestEntry, type EntryState } from "@/app/tests/actions";
import { createClient } from "@/lib/supabase/client";
import { TEST_FIELDS, USES_BODYWEIGHT, derivedFor } from "@/lib/testing";
import { useClearableErrors } from "@/lib/use-clearable-errors";
import { Alert, Button } from "./ui";

const MAX_BYTES = 50 * 1024 * 1024;
const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export function TestEntryForm({
  testKey,
  athleteId,
  today,
  defaultBodyweight,
  allowVideo = true,
}: {
  testKey: string;
  athleteId: string;
  today: string;
  defaultBodyweight: number | null;
  allowVideo?: boolean;
}) {
  const fields = TEST_FIELDS[testKey];
  const [state, action, pending] = useActionState<EntryState, FormData>(
    saveTestEntry,
    {},
  );
  const [, startTransition] = useTransition();
  const { err, clear } = useClearableErrors(state, state.errors ?? {});
  const [vals, setVals] = useState<Record<string, string>>({});
  const [bw, setBw] = useState(
    defaultBodyweight != null ? String(defaultBodyweight) : "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [dismissed, setDismissed] = useState<EntryState | null>(null);
  const showBw = USES_BODYWEIGHT.has(testKey);

  // Live preview of the derived numbers
  const numeric = Object.fromEntries(
    Object.entries(vals)
      .map(([k, v]) => [k, Number(v.replace(",", "."))])
      .filter(([, n]) => Number.isFinite(n as number) && (n as number) > 0),
  ) as Record<string, number>;
  const bwNum = Number(bw.replace(",", "."));
  const preview = derivedFor(
    testKey,
    numeric,
    Number.isFinite(bwNum) && bwNum > 0 ? bwNum : null,
  );

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setUploadError(null);
    const fd = new FormData(ev.currentTarget);
    if (file) {
      if (file.size > MAX_BYTES)
        return setUploadError(
          "Clip is over 50 MB. Trim it to just your best attempt.",
        );
      setUploading(true);
      const ext = (file.name.split(".").pop() || "mp4")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const path = `${athleteId}/${testKey}-${Date.now()}.${ext}`;
      const { error } = await createClient()
        .storage.from("test-videos")
        .upload(path, file, { contentType: file.type || undefined });
      setUploading(false);
      if (error)
        return setUploadError(
          "Video upload failed. You can save without it and try again.",
        );
      fd.set("video_path", path);
    }
    startTransition(() => action(fd));
  }

  if (state.saved && !pending && dismissed !== state) {
    return (
      <div>
        <Alert tone="ok">Result saved{file ? " with your clip" : ""}.</Alert>
        <Button
          variant="ghost"
          onClick={() => {
            setVals({});
            setFile(null);
            setFormKey((k) => k + 1);
            setDismissed(state);
          }}
        >
          Enter another result
        </Button>
      </div>
    );
  }

  return (
    <form key={formKey} onSubmit={onSubmit} noValidate>
      {state.message && <Alert>{state.message}</Alert>}
      {uploadError && <Alert>{uploadError}</Alert>}
      <input type="hidden" name="test_key" value={testKey} />
      <input type="hidden" name="athlete_id" value={athleteId} />

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-semibold">Test date</span>
        <input
          type="date"
          name="tested_on"
          defaultValue={today}
          max={today}
          onChange={() => clear("tested_on")}
          className={inputCls}
        />
        {err("tested_on") && (
          <span className="mt-1 block text-sm text-brand">
            {err("tested_on")}
          </span>
        )}
      </label>

      {fields.map((f) => (
        <label key={f.key} className="mb-4 block">
          <span className="mb-1.5 block text-sm font-semibold">
            {f.label}
            {f.unit && (
              <span className="font-normal text-muted"> ({f.unit})</span>
            )}
            {!f.required && (
              <span className="font-normal text-muted"> · optional</span>
            )}
          </span>
          <input
            name={f.key}
            inputMode={f.step === 1 ? "numeric" : "decimal"}
            value={vals[f.key] ?? ""}
            onChange={(e) => {
              setVals((v) => ({ ...v, [f.key]: e.target.value }));
              clear(f.key);
              clear("_");
            }}
            className={inputCls}
          />
          {err(f.key) && (
            <span className="mt-1 block text-sm text-brand">{err(f.key)}</span>
          )}
        </label>
      ))}
      {err("_") && <Alert>{err("_")}</Alert>}

      {showBw && (
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-semibold">
            Bodyweight on the day{" "}
            <span className="font-normal text-muted">
              (kg · for relative scores)
            </span>
          </span>
          <input
            name="bodyweight_kg"
            inputMode="decimal"
            value={bw}
            onChange={(e) => {
              setBw(e.target.value);
              clear("bodyweight_kg");
            }}
            className={inputCls}
          />
          {err("bodyweight_kg") && (
            <span className="mt-1 block text-sm text-brand">
              {err("bodyweight_kg")}
            </span>
          )}
        </label>
      )}

      {preview.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {preview.map((p) => (
            <div
              key={p.label}
              className="rounded-xl border border-line bg-surface p-3"
            >
              <p className="text-[11px] uppercase tracking-widest text-muted">
                {p.label}
              </p>
              <p className="font-black">{p.value}</p>
            </div>
          ))}
        </div>
      )}

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-semibold">
          Notes · optional
        </span>
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          className={`${inputCls} py-3`}
          placeholder="e.g. felt flat, slipped on 2nd attempt"
        />
      </label>

      {allowVideo && (
        <label className="mb-5 block">
          <span className="mb-1.5 block text-sm font-semibold">
            Clip of your best attempt · optional{" "}
            <span className="font-normal text-muted">(max 50 MB)</span>
          </span>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-surface-2 file:px-4 file:font-bold file:text-text"
          />
          {file && (
            <span
              className={`mt-1 block text-xs ${file.size > MAX_BYTES ? "text-brand" : "text-muted"}`}
            >
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
            </span>
          )}
        </label>
      )}

      <Button type="submit" disabled={pending || uploading}>
        {uploading ? "Uploading clip…" : pending ? "Saving…" : "Save result"}
      </Button>
    </form>
  );
}
