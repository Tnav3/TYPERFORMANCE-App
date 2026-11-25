"use client";
// Tap an exercise name → a pop-up with the demo video, how-to, and the client's own history.
// Kept to three parts so it stays easy to read: video, numbers, last sessions.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Lightbulb, MessageSquare, X } from "lucide-react";
import { parseCues } from "@/lib/cues";
import { embedUrl } from "@/lib/programming/video";
import { exerciseCard, type ExerciseCard } from "@/app/train/exercise-actions";

const dateFmt = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

export function ExerciseSheet({
  exerciseId,
  name,
  athleteId,
  historyHref,
  onClose,
}: {
  exerciseId: string;
  name: string;
  athleteId?: string;
  historyHref?: string;
  onClose: () => void;
}) {
  const [card, setCard] = useState<ExerciseCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    exerciseCard(exerciseId, athleteId).then((r) => {
      if (!live) return;
      if (r.error) setError(r.error);
      else setCard(r.data!);
    });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      live = false;
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [exerciseId, athleteId, onClose]);

  const src = card?.videoUrl ? embedUrl(card.videoUrl) : null;
  const sections = parseCues(card?.cues);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={name}>
      <button className="absolute inset-0 bg-black/70" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface/95 px-5 py-3 backdrop-blur">
          <h2 className="min-w-0 flex-1 text-lg font-black uppercase leading-tight tracking-tight">{name}</h2>
          <button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted" aria-label="Close">
            <X size={22} />
          </button>
        </div>

        {/* Video */}
        {src ? (
          <div className="aspect-video w-full bg-black">
            <iframe
              src={src}
              title={`${name} demo`}
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full"
            />
          </div>
        ) : card?.videoUrl ? (
          <a href={card.videoUrl} target="_blank" rel="noopener noreferrer" className="mx-5 mt-4 block font-bold text-brand">
            Watch the demo →
          </a>
        ) : null}

        <div className="space-y-5 px-5 pt-4">
          {!card && !error && <p className="py-6 text-center text-muted">Loading…</p>}
          {error && <p className="py-6 text-center text-muted">{error}</p>}

          {card && (
            <>
              {/* Numbers */}
              <div className={`grid gap-2 ${card.showE1rm ? "grid-cols-3" : "grid-cols-2"}`}>
                {card.showE1rm && <Stat label="Est. 1RM" value={card.bestE1rm ? `${card.bestE1rm.kg} kg` : "—"} sub={card.bestE1rm ? dateFmt(card.bestE1rm.date) : "no data yet"} />}
                <Stat label="Best set" value={card.bestSet ? `${card.bestSet.kg}×${card.bestSet.reps}` : "—"} sub={card.bestSet ? dateFmt(card.bestSet.date) : ""} />
                <Stat label="Last time" value={card.recent[0] ? dateFmt(card.recent[0].date) : "—"} sub={card.totalSessions ? `${card.totalSessions} session${card.totalSessions === 1 ? "" : "s"}` : "first time"} />
              </div>

              {/* How to: steps first, then tips, then anything the coach added */}
              {sections.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">How to do it</h3>
                  {sections.map((sec, i) =>
                    sec.kind === "tip" ? (
                      <div key={i} className="flex gap-2.5 rounded-2xl bg-brand/10 p-3">
                        <Lightbulb size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                        <div className="space-y-1 text-[15px] leading-snug">
                          <p className="text-xs font-bold uppercase tracking-wider text-brand">{sec.items.length > 1 ? "Tips" : "Tip"}</p>
                          {sec.items.map((t, j) => <p key={j}>{t}</p>)}
                        </div>
                      </div>
                    ) : sec.kind === "notes" ? (
                      <div key={i} className="flex gap-2.5 rounded-2xl border border-line p-3">
                        <MessageSquare size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                        <div className="space-y-1 text-[15px] leading-snug">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted">From your coach</p>
                          {sec.items.map((t, j) => <p key={j}>{t}</p>)}
                        </div>
                      </div>
                    ) : sec.numbered ? (
                      <div key={i}>
                        {sec.title && !/^steps?$/i.test(sec.title) && <p className="mb-1.5 text-sm font-bold">{sec.title}</p>}
                        <ol className="space-y-2">
                          {sec.items.map((t, j) => (
                            <li key={j} className="flex gap-3 text-[15px] leading-snug">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-black text-white">{j + 1}</span>
                              <span className="pt-0.5">{t}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : (
                      <div key={i} className="space-y-1 text-[15px] leading-snug">
                        {sec.title && <p className="text-sm font-bold">{sec.title}</p>}
                        {sec.items.map((t, j) => <p key={j}>{t}</p>)}
                      </div>
                    ),
                  )}
                </section>
              )}

              {/* History */}
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Your last sessions</h3>
                {card.recent.length === 0 ? (
                  <p className="text-sm text-muted">Nothing logged yet. Your sets will show here after this workout.</p>
                ) : (
                  <ul className="divide-y divide-line rounded-2xl border border-line">
                    {card.recent.map((r) => (
                      <li key={r.date} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                        <span className="w-14 shrink-0 text-sm font-bold">{dateFmt(r.date)}</span>
                        <span className="min-w-0 flex-1 text-sm">{r.sets}</span>
                        {r.e1rm != null && <span className="shrink-0 text-xs text-muted">e1RM {r.e1rm}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {historyHref && card.totalSessions > 0 && (
                  <Link href={historyHref} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-brand">
                    Full history & chart →
                  </Link>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-black leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
