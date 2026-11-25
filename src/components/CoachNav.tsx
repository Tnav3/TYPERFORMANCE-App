"use client";
// Coach navigation: fixed side panel on desktop, bottom tab bar + "More" sheet on phones.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  ShoppingBag,
  BookOpen,
  CalendarClock,
  Calculator,
  ClipboardList,
  CreditCard,
  Dumbbell,
  Gift,
  Bell,
  HeartPulse,
  House,
  Menu,
  MessageCircle,
  Settings,
  Trophy,
  Timer,
  Users,
  UsersRound,
  Workflow,
  FolderOpen,
  CalendarCheck,
  MessageSquareWarning,
  Zap,
  X,
  type LucideIcon,
  Utensils,
  Quote,
  PlayCircle,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; badge?: number };

export function CoachNav({ unread, notes = 0 }: { unread: number; notes?: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const groups: [string, Item[]][] = [
    [
      "",
      [
        { href: "/coach", label: "Dashboard", icon: House },
        { href: "/coach/clients", label: "Clients", icon: Users },
        { href: "/coach/train", label: "Train together", icon: Timer },
        { href: "/coach/chat", label: "Inbox", icon: MessageCircle, badge: unread },
        { href: "/coach/feed", label: "Workout feed", icon: Activity },
      ],
    ],
    [
      "Programming",
      [
        { href: "/coach/programs", label: "Programs", icon: Dumbbell },
        { href: "/coach/groups", label: "Groups", icon: UsersRound },
        { href: "/coach/library", label: "Exercise library", icon: BookOpen },
      ],
    ],
    [
      "Clients & messaging",
      [
        { href: "/coach/forms", label: "Check-in forms", icon: ClipboardList },
        { href: "/coach/messages", label: "Announcements & scheduled", icon: CalendarClock },
        { href: "/coach/automations", label: "Automations", icon: Zap },
        { href: "/coach/sequences", label: "Onboarding sequences", icon: Workflow },
        { href: "/coach/files", label: "File library", icon: FolderOpen },
        { href: "/coach/meals", label: "Meal library", icon: Utensils },
        { href: "/coach/quotes", label: "Daily quotes", icon: Quote },
        { href: "/coach/tour", label: "Welcome tour", icon: PlayCircle },
        { href: "/coach/settings/plans", label: "Plans & booking", icon: CalendarCheck },
        { href: "/coach/feedback", label: "Beta feedback", icon: MessageSquareWarning },
      ],
    ],
    [
      "Business",
      [
        { href: "/coach/invites", label: "Invites & payments", icon: CreditCard },
        { href: "/coach/shop", label: "Program shop", icon: ShoppingBag },
        { href: "/coach/referrals", label: "Referrals", icon: Gift },
        { href: "/coach/fights", label: "Competition tracker", icon: Trophy },
      ],
    ],
    [
      "Tools",
      [
        { href: "/calculator", label: "1RM calculator", icon: Calculator },
        { href: "/mas", label: "MAS calculator", icon: HeartPulse },
        { href: "/week", label: "Log my own training", icon: Activity },
      ],
    ],
    [
      "",
      [
        { href: "/notifications", label: "Notifications", icon: Bell, badge: notes },
        { href: "/coach/settings", label: "Settings", icon: Settings },
      ],
    ],
  ];

  const active = (href: string) =>
    href === "/coach" ? path === "/coach" : path === href || path.startsWith(href + "/") || (href === "/coach/clients" && path.startsWith("/coach/athlete"));

  const Row = ({ it, onClick }: { it: Item; onClick?: () => void }) => {
    const on = active(it.href);
    return (
      <Link
        href={it.href}
        onClick={onClick}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
          on ? "bg-brand text-white" : "text-muted hover:bg-surface-2 hover:text-text"
        }`}
      >
        <it.icon size={18} strokeWidth={2.25} />
        <span className="flex-1">{it.label}</span>
        {it.badge ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-black ${on ? "bg-white text-brand" : "bg-brand text-white"}`}>{it.badge}</span>
        ) : null}
      </Link>
    );
  };

  const list = (onClick?: () => void) =>
    groups.map(([title, items], i) => (
      <div key={i} className="mb-4">
        {title && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted/70">{title}</p>}
        <div className="space-y-0.5">
          {items.map((it) => (
            <Row key={it.href} it={it} onClick={onClick} />
          ))}
        </div>
      </div>
    ));

  const tabs: Item[] = [
    { href: "/coach", label: "Home", icon: House },
    { href: "/coach/clients", label: "Clients", icon: Users },
    { href: "/coach/programs", label: "Programs", icon: Dumbbell },
    { href: "/coach/chat", label: "Inbox", icon: MessageCircle, badge: unread },
  ];

  return (
    <>
      {/* Desktop side panel */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <Link href="/coach" className="flex items-center justify-center px-5 pb-2 pt-4" aria-label="TYPERFORMANCE home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full-rev.png" alt="TYPERFORMANCE" width={140} height={67} className="h-auto w-[140px]" />
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-6 pt-2">{list()}</nav>
      </aside>

      {/* Phone bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {tabs.map((t) => {
          const on = active(t.href);
          return (
            <Link key={t.href} href={t.href} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${on ? "text-brand" : "text-muted"}`}>
              <t.icon size={22} strokeWidth={2.25} />
              {t.label}
              {t.badge ? <span className="absolute right-[22%] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" aria-label={`${t.badge} unread`} /> : null}
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-muted">
          <Menu size={22} strokeWidth={2.25} />
          More
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center justify-between">
              <p className="px-3 font-black uppercase tracking-tight">Menu</p>
              <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted" aria-label="Close">
                <X size={22} />
              </button>
            </div>
            {list(() => setOpen(false))}
          </div>
        </div>
      )}
    </>
  );
}
