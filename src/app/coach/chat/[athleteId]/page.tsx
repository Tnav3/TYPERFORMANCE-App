import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { ChatThread, type ChatMessage } from "@/components/ChatThread";
import { MESSAGE_COLUMNS } from "@/lib/chat-media";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CoachThreadPage({ params }: { params: Promise<{ athleteId: string }> }) {
  const { supabase, user } = await requireState(["coach"]);
  const { athleteId } = await params;
  const [{ data: client }, { data }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, feat_chat, status").eq("id", athleteId).maybeSingle(),
    supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (!client) notFound();
  return (
    <Screen>
      <BackLink href="/coach/chat" label="Inbox" />
      <Heading
        sub={
          <Link href={`/coach/athlete/${athleteId}`} className="underline underline-offset-4">
            Open profile
          </Link>
        }
      >
        {client.full_name ?? client.email}
      </Heading>
      {client.feat_chat === false && (
        <p className="mb-3 rounded-xl bg-surface-2 p-3 text-sm text-muted">
          Chat is switched off for this client, so they won&apos;t see new messages until you switch it on.
        </p>
      )}
      <ChatThread athleteId={athleteId} me={user!.id} initial={((data ?? []) as unknown as ChatMessage[]).reverse()} isCoach />
    </Screen>
  );
}
