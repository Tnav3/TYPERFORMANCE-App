// Coach-written text with any URLs made tappable. Keeps line breaks.
import { linkParts } from "@/lib/glossary";

export function LinkedText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`whitespace-pre-line break-words ${className}`}>
      {linkParts(text).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="font-bold text-brand underline underline-offset-2">
            {p.href.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
            {p.href.replace(/^https?:\/\/(www\.)?/, "").length > 40 ? "…" : ""}
          </a>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </span>
  );
}
