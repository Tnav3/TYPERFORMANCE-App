"use client";
// Closes any open <details data-popover> when you click or tap outside it, or press Escape.
import { useEffect } from "react";

export function PopoverCloser() {
  useEffect(() => {
    const close = (keep?: Node | null) =>
      document.querySelectorAll<HTMLDetailsElement>("details[data-popover][open]").forEach((d) => {
        if (!keep || !d.contains(keep)) d.open = false;
      });
    const onDown = (e: PointerEvent) => close(e.target as Node);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return null;
}
