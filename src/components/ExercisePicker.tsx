"use client";
// Type-ahead exercise search: shorthand (rdl, db, bss), typos, recent picks first, category chips.
// Arrow keys + Enter on a laptop; tap on a phone. Enter with no match offers to add a new exercise.
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { searchExercises, type SearchEx } from "@/lib/programming/exercise-search";

const RECENT_KEY = "typ_recent_ex";
export function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
export function pushRecent(id: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 20)));
  } catch {
    /* storage off: recent list just won't persist */
  }
}

export const ExercisePicker = forwardRef<HTMLInputElement, {
  lib: SearchEx[];
  categories: [string, string][];
  value: string;
  onChange: (v: string) => void;
  onPick: (name: string, ex: SearchEx | null) => void;
  onPasteLines?: (lines: string[]) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}>(function ExercisePicker({ lib, categories, value, onChange, onPick, onPasteLines, placeholder, className, autoFocus }, ref) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [cat, setCat] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => setRecent(readRecent()), [open]);
  useEffect(() => {
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const results = useMemo(() => searchExercises(lib, value, { recent, category: cat, limit: 10 }), [lib, value, recent, cat]);
  useEffect(() => setHi(0), [value, cat]);

  const pick = (ex: SearchEx | null) => {
    const name = ex?.name ?? value.trim();
    if (!name) return;
    if (ex) pushRecent(ex.id);
    setOpen(false);
    onPick(name, ex);
  };

  return (
    <div ref={wrap} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={ref}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (onPasteLines && t.includes("\n")) {
              e.preventDefault();
              setOpen(false);
              onPasteLines(t.split(/\r?\n/).filter((l) => l.trim()));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHi((h) => Math.min(results.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(open && results[hi] ? results[hi] : (results.find((r) => r.name.toLowerCase() === value.trim().toLowerCase()) ?? null));
            } else if (e.key === "Escape") setOpen(false);
            else if (e.key === "Tab" && open && value.trim() && results[hi]) pick(results[hi]);
          }}
          placeholder={placeholder ?? "Search exercises (rdl, db bench…)"}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className="h-10 w-full min-w-0 rounded-lg border border-line bg-surface-2 pl-8 pr-2 text-sm font-semibold text-text placeholder:font-normal placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl md:right-auto md:w-[28rem]">
          <div className="flex gap-1 overflow-x-auto border-b border-line p-1.5">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setCat(null)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${!cat ? "bg-text text-ink" : "text-muted"}`}>All</button>
            {categories.map(([k, l]) => (
              <button key={k} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setCat(cat === k ? null : k)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${cat === k ? "bg-text text-ink" : "text-muted"}`}>
                {l}
              </button>
            ))}
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {!value.trim() && !cat && results.length > 0 && <li className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">Recent</li>}
            {results.map((r, k) => (
              <li
                key={r.id}
                role="option"
                aria-selected={k === hi}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHi(k)}
                onClick={() => pick(r)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${k === hi ? "bg-surface-2" : ""}`}
              >
                <span className="truncate font-semibold">{r.name}</span>
                <span className="shrink-0 text-[11px] text-muted">{categories.find(([c]) => c === r.category)?.[1] ?? ""}</span>
              </li>
            ))}
            {value.trim() && !results.some((r) => r.name.toLowerCase() === value.trim().toLowerCase()) && (
              <li onMouseDown={(e) => e.preventDefault()} onClick={() => pick(null)} className="cursor-pointer px-3 py-2 text-sm text-muted hover:bg-surface-2">
                + Add &ldquo;{value.trim()}&rdquo; as a new exercise
              </li>
            )}
            {!value.trim() && !cat && results.length === 0 && <li className="px-3 py-3 text-sm text-muted">Start typing, or pick a category.</li>}
          </ul>
          <p className="border-t border-line px-3 py-1.5 text-[11px] text-muted">↑↓ to move · Enter to pick · paste several lines to add a whole session</p>
        </div>
      )}
    </div>
  );
});
