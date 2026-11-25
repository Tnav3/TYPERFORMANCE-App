"use client";
import { useEffect, useState } from "react";
import { sendFeedback } from "@/app/feedback/actions";

export function FeedbackForm({ from }: { from: string }) {
  const [device, setDevice] = useState("");
  const [kind, setKind] = useState("bug");
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ? "installed app" : "browser";
    setDevice(`${navigator.userAgent.slice(0, 200)} · ${window.innerWidth}×${window.innerHeight} · ${standalone}`);
  }, []);
  return (
    <form action={sendFeedback} className="space-y-3">
      <input type="hidden" name="page" value={from} />
      <input type="hidden" name="device" value={device} />
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-3 gap-2">
        {[["bug", "Something's broken"], ["idea", "Idea"], ["other", "Other"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`min-h-12 rounded-xl border px-2 text-sm font-bold ${kind === k ? "border-brand bg-brand text-white" : "border-line"}`}>
            {l}
          </button>
        ))}
      </div>
      <textarea
        name="message"
        required
        minLength={3}
        maxLength={2000}
        rows={6}
        placeholder={kind === "bug" ? "What happened, and what did you expect? e.g. The rest timer stopped when I locked my phone." : "Tell me your idea."}
        className="w-full rounded-xl border border-line bg-surface-2 p-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none"
      />
      <p className="text-xs text-muted">The page you came from, your app version and device type are attached so it&apos;s easier to fix.</p>
      <button className="min-h-12 w-full rounded-xl bg-brand font-extrabold uppercase text-white">Send</button>
    </form>
  );
}
