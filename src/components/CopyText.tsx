"use client";
// One tap to copy a block of text (e.g. a session summary for Halaxy), with a preview.
import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";

export function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers: select the text so the user can copy it by hand
      const ta = document.getElementById("copy-text-fallback") as HTMLTextAreaElement | null;
      ta?.select();
      return;
    }
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <button type="button" onClick={copy} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-extrabold ${done ? "bg-ok text-ink" : "bg-brand text-white"}`}>
        {done ? <Check size={18} /> : <ClipboardCopy size={18} />}
        {done ? "Copied. Paste into your note" : label}
      </button>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Preview</summary>
        <textarea id="copy-text-fallback" readOnly value={text} rows={Math.min(14, text.split("\n").length + 1)} className="mt-2 w-full rounded-xl border border-line bg-surface-2 p-2 font-mono text-xs text-text" />
      </details>
    </div>
  );
}
