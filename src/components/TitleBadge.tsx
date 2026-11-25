// A title as a small belt-plate badge: organisation in its chosen colour. Text only, no logos.
import { TITLE_COLOURS, type Title } from "@/lib/titles";

export function TitleBadge({ t, small }: { t: Pick<Title, "org" | "name" | "colour">; small?: boolean }) {
  const c = TITLE_COLOURS[t.colour] ?? TITLE_COLOURS.gold;
  return (
    <span
      title={t.name ? `${t.org} · ${t.name}` : t.org}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-yellow-300/70 font-black uppercase tracking-wider shadow ${c.cls} ${small ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-xs"}`}
    >
      <span aria-hidden>🏆</span>
      {t.org}
    </span>
  );
}
