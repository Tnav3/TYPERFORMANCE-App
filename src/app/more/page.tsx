import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Camera,
  ChevronRight,
  CircleHelp,
  Sparkles,
  MessageSquareWarning,
  ClipboardCheck,
  ClipboardList,
  Gift,
  ListChecks,
  MessageCircle,
  PersonStanding,
  Salad,
  Scale,
  TrendingUp,
  Trophy,
  UserRound,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { hasFeature } from "@/lib/features";
import { clientMenu, type MenuIcon } from "@/lib/client/menu";
import { ClientTabBar } from "@/components/ClientTabBar";
import { Heading, Screen, SignOutButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const ICONS: Record<MenuIcon, LucideIcon> = {
  chat: MessageCircle,
  checkin: ClipboardCheck,
  progress: TrendingUp,
  week: CalendarDays,
  weighin: Scale,
  habits: ListChecks,
  macros: Utensils,
  mealplan: Salad,
  photos: Camera,
  testing: ClipboardList,
  mobility: PersonStanding,
  tools: Wrench,
  fights: Trophy,
  refer: Gift,
};

export default async function MorePage() {
  const { supabase, user, profile } = await requireState(["athlete"]);
  const m = await clientMenu(supabase, profile, user!.id, todayISO());
  // Chat and Progress already have their own tabs
  const items = m.items.filter((i) => i.href !== "/chat" && i.href !== "/train/history");

  return (
    <Screen>
      <Heading>More</Heading>
      {items.length > 0 ? (
        <div className="mb-6 grid grid-cols-3 gap-2.5">
          {items.map((i) => {
            const Icon = ICONS[i.icon];
            return (
              <Link
                key={i.href}
                href={i.href}
                className="relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 p-2 text-center active:bg-surface"
              >
                <Icon size={26} className="text-brand" />
                <span className="text-sm font-bold leading-tight">{i.label}</span>
                {i.badge ? <span className="absolute right-2 top-2 min-w-5 rounded-full bg-brand px-1.5 text-center text-[10px] font-black leading-5 text-white">{i.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mb-6 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">Your coach hasn&apos;t switched on any extras yet.</p>
      )}

      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {[
          ["/notifications", "Notifications", Bell],
          ["/profile", "My profile", UserRound],
          ["/faq", "Help", CircleHelp],
          ["/whats-new", "What's new", Sparkles],
          ["/feedback?from=/more", "Report a problem or idea", MessageSquareWarning],
        ].map(([href, label, Icon]) => {
          const I = Icon as LucideIcon;
          return (
            <Link key={href as string} href={href as string} className="flex min-h-14 items-center gap-3 px-4">
              <I size={20} className="text-muted" />
              <span className="flex-1 font-semibold">{label as string}</span>
              <ChevronRight size={18} className="text-muted" />
            </Link>
          );
        })}
      </div>
      <div className="mt-6 flex justify-center">
        <SignOutButton />
      </div>
      <ClientTabBar train={hasFeature(profile, "program")} chat={m.chatOn} progress={m.programOn} chatBadge={m.unreadChat} moreBadge={m.formsDue} food={m.food} />
    </Screen>
  );
}
