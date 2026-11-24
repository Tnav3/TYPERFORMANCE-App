// Server wrapper: works out which tabs a client has, then draws the bottom bar.
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientMenu } from "@/lib/client/menu";
import { hasFeature } from "@/lib/features";
import { todayISO } from "@/lib/dates";
import type { Profile } from "@/lib/types";
import { ClientTabBar } from "./ClientTabBar";

export async function ClientNavBar({ supabase, profile, userId }: { supabase: SupabaseClient; profile: Profile; userId: string }) {
  const m = await clientMenu(supabase, profile, userId, todayISO());
  return <ClientTabBar train={hasFeature(profile, "program")} chat={m.chatOn} progress={m.programOn} chatBadge={m.unreadChat} moreBadge={m.formsDue} food={m.food} />;
}
