import { requireFeature } from "@/lib/session";
import { ChatThread, type ChatMessage } from "@/components/ChatThread";
import { MESSAGE_COLUMNS } from "@/lib/chat-media";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientChatPage() {
  const { supabase, user } = await requireFeature(["athlete"], "chat");
  const { data } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("athlete_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading>Coach chat</Heading>
      <ChatThread athleteId={user!.id} me={user!.id} initial={((data ?? []) as unknown as ChatMessage[]).reverse()} />
    </Screen>
  );
}
