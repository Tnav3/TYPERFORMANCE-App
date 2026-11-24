"use client";
// Lightweight confetti burst (CSS only), respects reduced-motion.
import { useEffect, useState } from "react";

const COLORS = ["#d31820", "#f59e0b", "#22c55e", "#f5f5f5", "#3b82f6"];

export function Celebrate() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([60, 40, 120]);
    const t = setTimeout(() => setOn(false), 3500);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden motion-reduce:hidden">
      <style>{`@keyframes typ-fall{0%{transform:translateY(-10vh) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}`}</style>
      {Array.from({ length: 60 }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLORS[i % COLORS.length],
            animation: `typ-fall ${2 + ((i * 13) % 15) / 10}s ${((i * 7) % 10) / 10}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}
