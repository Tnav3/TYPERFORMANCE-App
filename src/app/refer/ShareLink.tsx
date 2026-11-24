"use client";
import { useState } from "react";
import { Copy, Share2 } from "lucide-react";

export function ShareLink({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  return (
    <div className="space-y-2">
      <p className="break-all rounded-xl border border-line bg-surface-2 px-3 py-3 font-mono text-sm">{url}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard blocked */
            }
          }}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line font-bold"
        >
          <Copy size={18} /> {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={() => navigator.share?.({ title, text: title, url }).catch(() => {})}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand font-extrabold text-white"
        >
          <Share2 size={18} /> Share
        </button>
      </div>
    </div>
  );
}
