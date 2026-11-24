import { requireFeature } from "@/lib/session";
import { ChatThread, type ChatMessage } from "@/components/ChatThread";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientChatPage() {
  const { supabase, user } = await requireFeature(["athlete"], "chat");
  const { data } = await supabase
    .from("messages")
    .select("id, athlete_id, sender_id, body, created_at, read_at, announcement")
    .eq("athlete_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading>Coach chat</Heading>
      <ChatThread athleteId={user!.id} me={user!.id} initial={((data ?? []) as ChatMessage[]).reverse()} />
    </Screen>
  );
}
