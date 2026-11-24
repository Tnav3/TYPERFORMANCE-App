"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOwnWorkout } from "@/app/train/own-actions";

export function DeleteOwnWorkout({ id }: { id: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();
  return sure ? (
    <span className="flex items-center justify-center gap-3 text-sm">
      Delete this workout and everything logged in it?
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await deleteOwnWorkout(id); if (r.ok) router.push("/train"); })} className="min-h-9 font-bold text-brand underline underline-offset-4">
        Delete
      </button>
      <button type="button" onClick={() => setSure(false)} className="min-h-9 text-muted">Keep</button>
    </span>
  ) : (
    <button type="button" onClick={() => setSure(true)} className="min-h-9 text-sm text-muted underline underline-offset-4">
      Delete this workout
    </button>
  );
}
