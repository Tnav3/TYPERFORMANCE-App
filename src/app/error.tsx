"use client";
// Friendly fallback instead of the bare "Application error" screen.
import { useEffect } from "react";
import { actionErrorMessage } from "@/lib/action-error";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  const msg = actionErrorMessage(error);
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-xl font-black uppercase">Hmm, that didn&apos;t load</p>
      <p className="max-w-sm text-muted">{msg}</p>
      <div className="flex gap-3">
        <button onClick={() => window.location.reload()} className="min-h-12 rounded-xl bg-brand px-5 font-extrabold uppercase text-white">Reload</button>
        <button onClick={() => reset()} className="min-h-12 rounded-xl border border-line px-5 font-bold">Try again</button>
      </div>
      <a href="/feedback" className="text-sm text-muted underline">Still stuck? Tell us</a>
    </main>
  );
}
