"use client";
export function PrintButton({ light = false }: { light?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`no-print min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold ${light ? "bg-[#282828] text-white" : "border border-line bg-surface-2"}`}
    >
      Print / PDF
    </button>
  );
}
