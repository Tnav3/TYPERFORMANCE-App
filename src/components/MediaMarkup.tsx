"use client";
// Coach feedback: pause a client's video (or open a photo), draw on the frame, send it back.
// Pen, arrow, line and circle in three colours; undo; the drawing is flattened onto the frame as a JPEG.
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Circle, Minus, Pencil, Undo2, X } from "lucide-react";
import { fmtSec } from "@/lib/chat-media";

type Tool = "pen" | "arrow" | "line" | "circle";
type Pt = { x: number; y: number };
type Shape = { tool: Tool; color: string; pts: Pt[] };
const COLORS = ["#ff2d2d", "#ffd400", "#ffffff"];

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, scale: number) {
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = 5 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const a = s.pts[0];
  const b = s.pts[s.pts.length - 1];
  if (!a) return;
  ctx.beginPath();
  if (s.tool === "pen") {
    ctx.moveTo(a.x, a.y);
    for (const p of s.pts) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  } else if (s.tool === "line" || s.tool === "arrow") {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (s.tool === "arrow") {
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const h = 22 * scale;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - h * Math.cos(ang - 0.45), b.y - h * Math.sin(ang - 0.45));
      ctx.lineTo(b.x - h * Math.cos(ang + 0.45), b.y - h * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
    }
  } else if (s.tool === "circle") {
    const r = Math.hypot(b.x - a.x, b.y - a.y);
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function MediaMarkup({
  src,
  kind,
  onClose,
  onSend,
}: {
  src: string;
  kind: "video" | "image";
  onClose: () => void;
  onSend: (jpeg: Blob, note: string, atSec: number | null) => Promise<string | null>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(kind === "image");
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState(COLORS[0]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [cur, setCur] = useState<Shape | null>(null);
  const [note, setNote] = useState("");
  const [at, setAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Lock scroll, close on Escape
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  // Redraw: the frame underneath + every shape
  useEffect(() => {
    const c = canvas.current;
    if (!c || !size || !drawing) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const scale = c.width / 900;
    for (const s of [...shapes, ...(cur ? [cur] : [])]) drawShape(ctx, s, Math.max(1, scale));
  }, [shapes, cur, size, drawing]);

  const startDrawing = () => {
    const v = video.current;
    if (v) {
      v.pause();
      setAt(v.currentTime);
      setSize({ w: v.videoWidth || 1280, h: v.videoHeight || 720 });
    }
    setDrawing(true);
  };
  const pos = (e: React.PointerEvent): Pt => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const w = size?.w ?? 1280;
      const h = size?.h ?? 720;
      const out = document.createElement("canvas");
      // Keep files small: at most 1280 px on the long side
      const k = Math.min(1, 1280 / Math.max(w, h));
      out.width = Math.round(w * k);
      out.height = Math.round(h * k);
      const ctx = out.getContext("2d")!;
      ctx.drawImage((kind === "video" ? video.current : img.current)!, 0, 0, out.width, out.height);
      ctx.drawImage(canvas.current!, 0, 0, out.width, out.height);
      const blob: Blob = await new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
      const err = await onSend(blob, note.trim(), at);
      if (err) setError(err);
    } catch {
      setError("Couldn't capture that frame. Try again.");
    }
    setBusy(false);
  };

  const btn = (on: boolean) => `flex h-11 w-11 items-center justify-center rounded-xl ${on ? "bg-brand text-white" : "bg-surface-2 text-text"}`;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Draw feedback">
      <div className="flex items-center gap-2 p-2">
        <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl text-white" aria-label="Close"><X /></button>
        <p className="flex-1 text-sm font-bold text-white">
          {drawing ? (at != null ? `Drawing on ${fmtSec(at)}${at % 1 ? `.${Math.floor((at % 1) * 10)}` : ""}` : "Draw on the photo") : "Pause on the moment, then tap Draw"}
        </p>
        {kind === "video" && drawing && (
          <button onClick={() => { setDrawing(false); setShapes([]); video.current?.play(); }} className="min-h-11 rounded-xl px-3 text-sm font-bold text-white/80">Back to video</button>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="relative max-h-full max-w-full">
          {kind === "video" ? (
             
            <video
              ref={video}
              src={src}
              crossOrigin="anonymous"
              playsInline
              controls={!drawing}
              preload="auto"
              className="block max-h-[calc(100dvh-13rem)] max-w-full"
              onLoadedMetadata={(e) => setSize({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={img}
              src={src}
              alt=""
              crossOrigin="anonymous"
              className="block max-h-[calc(100dvh-13rem)] max-w-full"
              onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            />
          )}
          {drawing && size && (
            <canvas
              ref={canvas}
              width={size.w}
              height={size.h}
              className="absolute inset-0 h-full w-full touch-none"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setCur({ tool, color, pts: [pos(e)] });
              }}
              onPointerMove={(e) => cur && setCur({ ...cur, pts: tool === "pen" ? [...cur.pts, pos(e)] : [cur.pts[0], pos(e)] })}
              onPointerUp={() => {
                if (cur && cur.pts.length > 1) setShapes((s) => [...s, cur]);
                setCur(null);
              }}
            />
          )}
        </div>
      </div>

      <div className="space-y-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {!drawing ? (
          <button onClick={startDrawing} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-extrabold uppercase text-white">
            <Pencil size={18} /> Draw on this moment
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button onClick={() => setTool("arrow")} className={btn(tool === "arrow")} aria-label="Arrow"><ArrowUpRight size={20} /></button>
              <button onClick={() => setTool("line")} className={btn(tool === "line")} aria-label="Line"><Minus size={20} /></button>
              <button onClick={() => setTool("circle")} className={btn(tool === "circle")} aria-label="Circle"><Circle size={20} /></button>
              <button onClick={() => setTool("pen")} className={btn(tool === "pen")} aria-label="Pen"><Pencil size={18} /></button>
              <span className="mx-1 h-8 w-px bg-white/20" />
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={`h-9 w-9 rounded-full border-2 ${color === c ? "border-white" : "border-transparent"}`} style={{ background: c }} aria-label={`Colour ${c}`} />
              ))}
              <button onClick={() => setShapes((s) => s.slice(0, -1))} disabled={!shapes.length} className={`${btn(false)} ml-auto disabled:opacity-40`} aria-label="Undo"><Undo2 size={18} /></button>
            </div>
            <div className="flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Add a cue (optional)" className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 text-white placeholder:text-white/50" />
              <button onClick={send} disabled={busy || !shapes.length} className="min-h-12 shrink-0 rounded-xl bg-brand px-5 font-extrabold uppercase text-white disabled:opacity-50">
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}
        {error && <p className="text-sm font-bold text-brand">{error}</p>}
      </div>
    </div>
  );
}
