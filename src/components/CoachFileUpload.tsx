"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addCoachFile } from "@/app/coach/files/actions";
import { extFor, fmtBytes, MAX_BYTES } from "@/lib/chat-media";

export function CoachFileUpload() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function up(f: File) {
    setError(null);
    if (f.size > MAX_BYTES) return setError(`That file is ${fmtBytes(f.size)}. The limit is 50 MB.`);
    setBusy(true);
    const path = `library/${crypto.randomUUID()}.${extFor(f.type, f.name)}`;
    const { error: e } = await createClient().storage.from("coach-files").upload(path, f, { contentType: f.type });
    const r = e ? { ok: false, error: "Upload failed. PDFs, images and MP4 only." } : await addCoachFile({ name: f.name.replace(/\.[^.]+$/, ""), path, mime: f.type, size: f.size });
    setBusy(false);
    if (!r.ok) setError(r.error ?? "Upload failed.");
    else router.refresh();
  }
  return (
    <div>
      <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png,video/mp4" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) up(f); }} />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line font-extrabold disabled:opacity-60">
        <Upload size={18} /> {busy ? "Uploading…" : "Upload a file (PDF, image or MP4)"}
      </button>
      {error && <p className="mt-1 text-sm font-bold text-brand">{error}</p>}
    </div>
  );
}
