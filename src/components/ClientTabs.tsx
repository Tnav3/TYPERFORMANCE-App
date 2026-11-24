// One header for every client page: name, quick chat, and tabs across the top.
import Link from "next/link";
import { MessageCircle } from "lucide-react";

export type ClientTab = "overview" | "program" | "progress" | "tests" | "lifestyle" | "mobility" | "fights" | "profile";

const TABS: [ClientTab, string, string][] = [
  ["program", "Calendar", "/program"],
  ["overview", "Overview", ""],
  ["progress", "Progress", "/progress"],
  ["lifestyle", "Habits & food", "/lifestyle"],
  ["tests", "Testing", "/tests"],
  ["mobility", "Mobility", "/mobility"],
  ["fights", "Fights", "/fights"],
  ["profile", "Profile", "/profile"],
];

export function ClientTabs({ id, name, active, sub }: { id: string; name: string; active: ClientTab; sub?: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/coach/clients" className="hidden text-sm text-muted hover:text-text sm:block" aria-label="All clients">
          Clients /
        </Link>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-black text-white">{initials}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black uppercase leading-tight tracking-tight">{name}</h1>
          {sub && <p className="truncate text-sm text-muted">{sub}</p>}
        </div>
        <Link
          href={`/coach/chat/${id}`}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold hover:border-brand"
        >
          <MessageCircle size={16} /> <span className="hidden sm:inline">Message</span>
        </Link>
      </div>
      <nav className="-mx-5 flex gap-1 overflow-x-auto border-b border-line px-5 [scrollbar-width:none]">
        {TABS.map(([k, label, path]) => (
          <Link
            key={k}
            href={`/coach/athlete/${id}${path}`}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-bold ${
              active === k ? "border-brand text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
