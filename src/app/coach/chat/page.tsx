import Link from "next/link";
import { requireState } from "@/lib/session";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default async function InboxPage() {
  const { supabase, user } = await requireState(["coach"]);
  const [{ data: msgs }, { data: clients }] = await Promise.all([
    supabase
      .from("messages")
      .select("athlete_id, sender_id, body, created_at, read_at, attachment_kind")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("profiles").select("id, full_name, email").eq("role", "athlete").eq("status", "active").order("full_name"),
  ]);
  const latest = new Map<string, { body: string; created_at: string; mine: boolean }>();
  const unread = new Map<string, number>();
  for (const m of msgs ?? []) {
    if (!latest.has(m.athlete_id)) latest.set(m.athlete_id, { body: m.body || ({ image: "📷 Photo", video: "🎥 Video", audio: "🎤 Voice message", file: "📄 File" } as Record<string, string>)[m.attachment_kind ?? ""] || "", created_at: m.created_at, mine: m.sender_id === user!.id });
    if (m.sender_id !== user!.id && !m.read_at) unread.set(m.athlete_id, (unread.get(m.athlete_id) ?? 0) + 1);
  }
  const rows = (clients ?? [])
    .map((c) => ({ ...c, last: latest.get(c.id), unread: unread.get(c.id) ?? 0 }))
    .sort((a, b) => b.unread - a.unread || (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? "") || (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  return (
    <Screen wide>
      <BackLink href="/coach" label="Dashboard" />
      <Heading>Inbox</Heading>
      <Link href="/coach/messages" className="mb-4 flex min-h-12 items-center justify-between rounded-xl border border-line bg-surface-2 px-4 font-extrabold">
        Scheduled &amp; recurring messages <span aria-hidden>→</span>
      </Link>
      <div className="space-y-2">
        {rows.map((r) => (
          <Link key={r.id} href={`/coach/chat/${r.id}`} className="block">
            <Card className={`!p-3 hover:border-muted ${r.unread ? "border-brand/60" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{r.full_name ?? r.email}</p>
                  <p className="truncate text-sm text-muted">
                    {r.last ? `${r.last.mine ? "You: " : ""}${r.last.body}` : "No messages yet"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {r.unread > 0 && (
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">
                      {r.unread}
                    </span>
                  )}
                  {r.last && <p className="text-xs text-muted">{when.format(new Date(r.last.created_at))}</p>}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Screen>
  );
}
