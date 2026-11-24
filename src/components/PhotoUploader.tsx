"use client";
// Uploads a progress photo straight to private storage, then records it.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordPhoto } from "@/app/lifestyle-actions";

export function PhotoUploader({ userId, today }: { userId: string; today: string }) {
  const router = useRouter();
  const [pose, setPose] = useState("front");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("That photo is over 10 MB.");
      setBusy(false);
      return;
    }
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${today}-${pose}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error: up } = await createClient().storage.from("progress-photos").upload(path, file, { contentType: file.type || "image/jpeg" });
    if (up) {
      setError("Upload failed. Check your connection and try again.");
      setBusy(false);
      return;
    }
    const r = await recordPhoto({ path, pose, takenOn: today });
    setBusy(false);
    if (!r.ok) setError(r.error);
    else router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {["front", "side", "back"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPose(p)}
            className={`min-h-11 rounded-xl border text-sm font-bold capitalize ${pose === p ? "border-brand bg-brand text-white" : "border-line text-muted"}`}
          >
            {p}
          </button>
        ))}
      </div>
      <label className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-brand font-extrabold uppercase text-white ${busy ? "opacity-60" : ""}`}>
        {busy ? "Uploading…" : `Add ${pose} photo`}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </label>
      {error && <p className="text-sm text-brand">{error}</p>}
    </div>
  );
}
