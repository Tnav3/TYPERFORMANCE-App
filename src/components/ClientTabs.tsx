import { PopoverCloser } from "@/components/PopoverCloser";
// One header for every client page: name, quick chat, and tabs across the top.
import Link from "next/link";
import { Eye, MessageCircle, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "./Avatar";

export type ClientTab = "overview" | "program" | "programming" | "progress" | "forms" | "tests" | "lifestyle" | "meals" | "mobility" | "fights" | "profile";

const TABS: [ClientTab, string, string][] = [
  ["overview", "Overview", ""],
  ["program", "Calendar", "/program"],
  ["programming", "Programming", "/programming"],
  ["progress", "Progress", "/progress"],
  ["forms", "Check-ins", "/forms"],
  ["lifestyle", "Habits & food", "/lifestyle"],
  ["meals", "Meal plan", "/meal-plans"],
  ["tests", "Testing", "/tests"],
  ["mobility", "Mobility", "/mobility"],
  ["fights", "Fights", "/fights"],
  ["profile", "Profile", "/profile"],
];
const PRIMARY = 4; // shown on phones; the rest go under "More"

export async function ClientTabs({ id, name, active, sub }: { id: string; name: string; active: ClientTab; sub?: string }) {
  const supabase = await createClient();
  const { data: me } = await supabase.from("profiles").select("avatar_path, nickname, goal_text").eq("id", id).maybeSingle();
  const line = sub ?? [me?.nickname && `\u201c${me.nickname}\u201d`, me?.goal_text && `Goal: ${me.goal_text}`].filter(Boolean).join(" · ");
  const moreActive = TABS.slice(PRIMARY).find(([k]) => k === active)?.[1] ?? null;
  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/coach/clients" className="hidden text-sm text-muted hover:text-text sm:block" aria-label="All clients">
          Clients /
        </Link>
        {/* Plain link: a route handler sets the view-as cookie */}
        <a href={`/view-as/${id}`} className="group relative shrink-0" title="See their app" aria-label={`See ${name}'s app`}>
          <Avatar name={name} path={me?.avatar_path} />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink bg-surface-2 text-text group-hover:bg-brand">
            <Eye size={11} />
          </span>
        </a>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black uppercase leading-tight tracking-tight">{name}</h1>
          {line && <p className="truncate text-sm text-muted">{line}</p>}
        </div>
        <Link
          href={`/coach/train?c=${id}`}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-brand px-3 text-sm font-extrabold text-white"
        >
          <Timer size={16} /> <span className="hidden sm:inline">Train now</span>
        </Link>
        <Link
          href={`/coach/chat/${id}`}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold hover:border-brand"
        >
          <MessageCircle size={16} /> <span className="hidden sm:inline">Message</span>
        </Link>
      </div>
      <PopoverCloser />
      <nav className="-mx-5 flex items-stretch gap-0 border-b border-line px-5 lg:flex-wrap">
        {TABS.map(([k, label, path], n) => (
          <Link
            key={k}
            href={`/coach/athlete/${id}${path}`}
            className={`shrink-0 whitespace-nowrap border-b-2 px-2 py-3 text-[13px] font-bold sm:px-2.5 sm:text-sm lg:px-3 ${n >= PRIMARY ? "hidden lg:block" : ""} ${
              active === k ? "border-brand text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {label}
          </Link>
        ))}
        <details data-popover className="relative ml-auto lg:hidden">
          <summary
            className={`flex h-full cursor-pointer list-none items-center whitespace-nowrap border-b-2 px-2 text-[13px] font-bold sm:text-sm ${
              moreActive ? "border-brand text-text" : "border-transparent text-muted"
            }`}
          >
            {moreActive ?? "More"} ▾
          </summary>
          <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
            {TABS.slice(PRIMARY).map(([k, label, path]) => (
              <Link key={k} href={`/coach/athlete/${id}${path}`} className={`block px-4 py-3 text-sm font-bold ${active === k ? "text-brand" : ""}`}>
                {label}
              </Link>
            ))}
          </div>
        </details>
      </nav>
    </div>
  );
}
