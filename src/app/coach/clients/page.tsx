import Link from "next/link";
import { requireState } from "@/lib/session";
import { activityTone, lastSeenLabel } from "@/lib/activity";
import { Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const show = sp.show === "all" ? "all" : "active";
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, status, last_seen_at")
    .eq("role", "athlete")
    .order("full_name", { nullsFirst: false });
  const now = new Date();
  const rows = (data ?? []).filter(
    (c) =>
      (show === "all" || c.status === "active") &&
      (!q || (c.full_name ?? "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q)),
  );

  return (
    <Screen wide>
      <Heading sub="Tap a client to see their calendar, progress and profile.">Clients</Heading>
      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search by name or email"
          className="min-h-12 flex-1 rounded-xl border border-line bg-surface-2 px-4 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none"
          aria-label="Search clients"
        />
        {show === "all" && <input type="hidden" name="show" value="all" />}
        <button className="min-h-12 rounded-xl bg-brand px-5 font-extrabold uppercase tracking-wide text-white">Search</button>
      </form>
      <div className="mb-3 flex gap-2 text-sm">
        {(["active", "all"] as const).map((k) => (
          <Link
            key={k}
            href={`/coach/clients?show=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`min-h-10 content-center rounded-full px-4 font-bold ${show === k ? "bg-text text-ink" : "border border-line text-muted"}`}
          >
            {k === "active" ? "Active" : "Everyone"}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">No clients match.</p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((c) => {
            const tone = activityTone(c.last_seen_at, now);
            const initials = (c.full_name ?? c.email)
              .split(/\s+/)
              .map((w: string) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <Link key={c.id} href={`/coach/athlete/${c.id}/program`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-surface-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-black text-brand">{initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">{c.full_name ?? c.email}</span>
                  <span className="block truncate text-sm text-muted">
                    {c.status !== "active" ? `${c.status} · ` : ""}
                    <span className={tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-brand"}>
                      {lastSeenLabel(c.last_seen_at, now)}
                    </span>
                  </span>
                </span>
                <span className="text-muted" aria-hidden>›</span>
              </Link>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
