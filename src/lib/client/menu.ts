// What a client can open, given their switched-on features. Used by the tab bar and the More page.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasFeature } from "@/lib/features";
import { toolsFor } from "@/lib/tools";
import { currentDue, type Repeat } from "@/lib/forms";
import { addDays } from "@/lib/week";
import type { Profile } from "@/lib/types";

export type MenuIcon =
  | "chat" | "checkin" | "progress" | "weighin" | "habits" | "macros" | "mealplan" | "photos"
  | "testing" | "mobility" | "tools" | "fights" | "refer" | "week";

export interface MenuItem {
  href: string;
  label: string;
  icon: MenuIcon;
  badge?: number;
}

export async function clientMenu(supabase: SupabaseClient, profile: Profile, userId: string, today: string) {
  const chatOn = hasFeature(profile, "chat");
  const programOn = hasFeature(profile, "program");
  const [{ count: unreadChat }, { data: fAsg }, { data: fResp }, { data: offer }] = await Promise.all([
    chatOn
      ? supabase.from("messages").select("id", { count: "exact", head: true }).eq("athlete_id", userId).neq("sender_id", userId).is("read_at", null)
      : Promise.resolve({ count: 0 }),
    supabase.from("form_assignments").select("id, form_id, repeat, starts_on, forms(archived)").eq("athlete_id", userId).eq("active", true),
    supabase.from("form_responses").select("form_id, due_on").eq("athlete_id", userId).gte("due_on", addDays(today, -62)),
    supabase.from("referral_offers").select("id").eq("active", true).limit(1).maybeSingle(),
  ]);
  const forms = (fAsg ?? []).filter((a) => !(a.forms as unknown as { archived: boolean } | null)?.archived);
  const formsDue = forms.filter((a) => {
    const due = currentDue({ repeat: a.repeat as Repeat, starts_on: a.starts_on }, today);
    return !!due && !(fResp ?? []).some((r) => r.form_id === a.form_id && r.due_on === due);
  }).length;

  const all: [boolean, MenuItem][] = [
    [chatOn, { href: "/chat", label: "Chat", icon: "chat", badge: unreadChat ?? 0 }],
    [forms.length > 0, { href: "/forms", label: "Check-ins", icon: "checkin", badge: formsDue }],
    [programOn, { href: "/train/history", label: "Progress", icon: "progress" }],
    [hasFeature(profile, "checkin"), { href: "/week", label: "Log training", icon: "week" }],
    [hasFeature(profile, "bodyweight"), { href: "/bodyweight", label: "Weigh-in", icon: "weighin" }],
    [hasFeature(profile, "habits"), { href: "/habits", label: "Habits", icon: "habits" }],
    [hasFeature(profile, "macros"), { href: "/macros", label: "Macros", icon: "macros" }],
    [hasFeature(profile, "mealplan"), { href: "/meal-plan", label: "Meal plan", icon: "mealplan" }],
    [hasFeature(profile, "photos"), { href: "/photos", label: "Photos", icon: "photos" }],
    [hasFeature(profile, "testing"), { href: "/tests", label: "Testing", icon: "testing" }],
    [hasFeature(profile, "mobility"), { href: "/mobility", label: "Mobility", icon: "mobility" }],
    [toolsFor(profile).length > 0, { href: "/tools", label: "Tools", icon: "tools" }],
    [hasFeature(profile, "fights"), { href: "/fights", label: "My fights", icon: "fights" }],
    [!!offer, { href: "/refer", label: "Refer a friend", icon: "refer" }],
  ];
  const items = all.filter(([on]) => on).map(([, i]) => i);
  return { items, chatOn, programOn, unreadChat: unreadChat ?? 0, formsDue };
}
