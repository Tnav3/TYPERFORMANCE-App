"use client";
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="no-print min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold">
      Print / PDF
    </button>
  );
}
