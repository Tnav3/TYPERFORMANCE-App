"use client";
// Crops to a square, shrinks to 512px JPEG in the browser, uploads to the person's own folder.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setAvatar } from "@/app/profile/about-actions";
import { Avatar } from "./Avatar";

async function squareJpeg(file: File, size = 512): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
}

export function AvatarUploader({ userId, name, path }: { userId: string; name: string; path: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const blob = await squareJpeg(file);
      const p = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: up } = await createClient().storage.from("avatars").upload(p, blob, { contentType: "image/jpeg" });
      if (up) throw up;
      const r = await setAvatar(p);
      if (!r.ok) setError(r.error);
      else router.refresh();
    } catch {
      setError("That photo didn't upload. Try a JPG or PNG.");
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} path={path} size="lg" />
      <div className="space-y-1">
        <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-extrabold ${busy ? "opacity-60" : ""}`}>
          {busy ? "Uploading…" : path ? "Change photo" : "Add a photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {path && !busy && (
          <button type="button" onClick={async () => { setBusy(true); await setAvatar(null); setBusy(false); router.refresh(); }} className="block text-xs font-bold text-muted underline underline-offset-4">
            Remove photo
          </button>
        )}
        {error && <p className="text-sm font-bold text-brand">{error}</p>}
      </div>
    </div>
  );
}
