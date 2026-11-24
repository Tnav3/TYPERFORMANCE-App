// Progress photos grouped by date (signed links, private bucket).
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate } from "@/lib/dates";
import { deletePhoto } from "@/app/lifestyle-actions";

export async function PhotoGallery({ supabase, athleteId, back }: { supabase: SupabaseClient; athleteId: string; back: string }) {
  const { data } = await supabase
    .from("progress_photos")
    .select("id, taken_on, pose, path")
    .eq("athlete_id", athleteId)
    .order("taken_on", { ascending: false })
    .limit(60);
  const rows = data ?? [];
  if (!rows.length) return <p className="text-sm text-muted">No photos yet.</p>;
  const { data: signed } = await supabase.storage.from("progress-photos").createSignedUrls(rows.map((r) => r.path), 3600);
  const url = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) byDate.set(r.taken_on, [...(byDate.get(r.taken_on) ?? []), r]);
  return (
    <div className="space-y-4">
      {[...byDate.entries()].map(([date, list]) => (
        <section key={date}>
          <p className="mb-1 text-xs uppercase tracking-widest text-muted">{formatDate(date)}</p>
          <div className="grid grid-cols-3 gap-2">
            {list.map((p) => (
              <figure key={p.id} className="relative overflow-hidden rounded-xl bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {url.get(p.path) && <img src={url.get(p.path)!} alt={`${p.pose} ${date}`} className="aspect-[3/4] w-full object-cover" loading="lazy" />}
                <figcaption className="flex items-center justify-between px-2 py-1 text-[11px] capitalize text-muted">
                  {p.pose}
                  <form action={deletePhoto}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="back" value={back} />
                    <button className="min-h-8 px-1 underline">Delete</button>
                  </form>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
