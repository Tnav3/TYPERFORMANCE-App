"use client";
// Shown across the client screens while the coach is viewing as a client.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Eye } from "lucide-react";
import { VIEW_AS_NAME } from "@/lib/view-as";

export function ViewAsBanner() {
  const path = usePathname();
  const [name, setName] = useState<string | null>(null);
  // Read on every navigation: the cookie is set/cleared by redirects
  useEffect(() => {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(`${VIEW_AS_NAME}=`))?.split("=")[1];
    setName(raw ? decodeURIComponent(decodeURIComponent(raw)) : null);
  }, [path]);
  if (!name || path.startsWith("/coach") || path.startsWith("/view-as")) return null;
  return (
    <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-brand bg-brand px-3 py-2 text-sm font-bold text-white">
      <Eye size={16} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">Viewing as {name} · you can log their workouts</span>
      {/* Plain link on purpose: a route handler clears the cookie */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/view-as/exit" className="min-h-9 shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold uppercase text-brand">
        Back to coach
      </a>
    </div>
  );
}
