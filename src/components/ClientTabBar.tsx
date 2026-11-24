"use client";
// Phone-style tab bar for clients: Home · Train · Chat · Nutrition · Progress · More.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, House, Menu, MessageCircle, TrendingUp, Utensils } from "lucide-react";

export function ClientTabBar({ train, chat, progress, chatBadge, moreBadge, food = null }: { train: boolean; chat: boolean; progress: boolean; chatBadge: number; moreBadge: number; food?: string | null }) {
  const path = usePathname();
  const tabs = [
    { href: "/", label: "Home", Icon: House, on: path === "/" || path === "/athlete", show: true, badge: 0 },
    { href: "/train", label: "Train", Icon: Dumbbell, on: path === "/train", show: train, badge: 0 },
    { href: "/chat", label: "Chat", Icon: MessageCircle, on: path.startsWith("/chat"), show: chat, badge: chatBadge },
    { href: food ?? "/nutrition", label: "Nutrition", Icon: Utensils, on: !!food && (path.startsWith("/meal-plan") || path.startsWith("/macros") || path.startsWith("/nutrition")), show: !!food, badge: 0 },
    { href: "/train/history", label: "Progress", Icon: TrendingUp, on: path.startsWith("/train/history"), show: progress, badge: 0 },
    { href: "/more", label: "More", Icon: Menu, on: path === "/more", show: true, badge: moreBadge },
  ].filter((t) => t.show);
  return (
    <>
      <div className="h-20" aria-hidden />
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.on ? "page" : undefined}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold ${t.on ? "text-brand" : "text-muted"}`}
            >
              <t.Icon size={24} strokeWidth={t.on ? 2.6 : 2.1} />
              {t.label}
              {t.badge > 0 && (
                <span className="absolute left-1/2 top-2 ml-2 min-w-5 rounded-full bg-brand px-1.5 text-center text-[10px] font-black leading-5 text-white">{t.badge}</span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
