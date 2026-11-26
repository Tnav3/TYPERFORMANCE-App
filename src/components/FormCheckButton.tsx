"use client";

// Client sends a short video of a set to the coach. It lands in their chat thread,
// tagged with the exercise, so the coach can reply with feedback right there.
import { useRef, useState } from "react";
import { Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { extFor, fmtBytes, fmtSec, MAX_BYTES, MAX_VIDEO_SEC, safeName } from "@/lib/chat-media";

function videoSeconds(file: File): Promise<number | null> {
  return new Promise((res) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      res(Number.isFinite(v.duration) ? v.duration : null);
    };
    v.onerror = () => res(null);
    v.src = URL.createObjectURL(file);
  });
}

export function FormCheckButton({ itemId, exerciseName, sets }: { itemId: string; exerciseName: string; sets: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [setNo, setSetNo] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send(file: File) {
    setError(null);
    if (!/^video\/(mp4|quicktime|webm)$/.test(file.type)) return setError("Pick a video (MP4 or MOV).");
    if (file.size > MAX_BYTES) return setError(`That video is ${fmtBytes(file.size)}. Trim it to the rep that matters (under 50 MB).`);
    const sec = await videoSeconds(file);
    if (sec != null && sec > MAX_VIDEO_SEC) return setError(`That video is ${fmtSec(sec)}. Keep it under ${MAX_VIDEO_SEC} seconds.`);
    setState("sending");
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    const me = u.user?.id;
    if (!me) {
      setState("idle");
      return setError("You're signed out. Sign in and try again.");
    }
    const path = `${me}/${crypto.randomUUID()}.${extFor(file.type, file.name)}`;
    const { error: up } = await supabase.storage.from("chat-media").upload(path, file, { contentType: file.type });
    if (up) {
      setState("idle");
      return setError("Upload failed. Check your connection and try again.");
    }
    const body = [`🎥 Form check: ${exerciseName}${setNo ? ` · set ${setNo}` : ""}`, note.trim()].filter(Boolean).join("\n").slice(0, 2000);
    const { error: ins } = await supabase.from("messages").insert({
      athlete_id: me, body, attachment_path: path, attachment_kind: "video", attachment_name: safeName(file.name),
      attachment_size: file.size, duration_sec: sec != null ? Math.round(sec * 10) / 10 : null,
      form_check_item: itemId, form_check_set: setNo || null,
    });
    if (ins) {
      setState("idle");
      return setError(/switched off/.test(ins.message) ? "Chat is switched off for your account." : "Not sent. Try again.");
    }
    setState("sent");
    setOpen(false);
    setNote("");
  }

  if (state === "sent") {
    return (
      <p className="mt-2 text-sm font-bold text-ok">
        ✓ Form check sent. Your coach will reply in <a href="/chat" className="underline underline-offset-4">Messages</a>.{" "}
        <button type="button" className="font-normal text-muted underline" onClick={() => setState("idle")}>Send another</button>
      </p>
    );
  }
  return (
    <div className="mt-2">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-muted">
          <Video size={15} aria-hidden /> Send a form check video
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-sm font-bold">Film one set from side-on, then send it here.</p>
          <div className="flex gap-2">
            <select value={setNo} onChange={(e) => setSetNo(e.target.value ? Number(e.target.value) : "")} className="min-h-11 rounded-xl border border-line bg-surface px-2 text-sm" aria-label="Which set">
              <option value="">Which set?</option>
              {Array.from({ length: Math.max(1, Math.min(sets || 1, 30)) }, (_, i) => <option key={i} value={i + 1}>Set {i + 1}</option>)}
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Anything to look at? (optional)" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm" />
          </div>
          <input ref={input} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void send(f); }} />
          <div className="flex gap-2">
            <button type="button" disabled={state === "sending"} onClick={() => input.current?.click()} className="min-h-11 flex-1 rounded-xl bg-brand text-sm font-extrabold uppercase text-white disabled:opacity-60">
              {state === "sending" ? "Uploading…" : "Film or choose video"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl border border-line px-3 text-sm font-bold">Cancel</button>
          </div>
          <p className="text-xs text-muted">Up to {MAX_VIDEO_SEC} seconds. Trim it to the reps that matter.</p>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-brand">{error}</p>}
    </div>
  );
}
