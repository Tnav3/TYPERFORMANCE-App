"use client";
// Coach ↔ client chat. Live via Supabase Realtime, with a 20s refresh fallback.
// Text, photos, videos, voice notes, PDFs, reactions; the coach can draw on a video frame or photo.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Mic, Paperclip, Pencil, Send, Square, Star, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { extFor, fmtBytes, fmtSec, kindFor, MAX_BYTES, MAX_VIDEO_SEC, MESSAGE_COLUMNS, safeName, type AttachmentKind } from "@/lib/chat-media";
import { MediaMarkup } from "./MediaMarkup";

export interface ChatMessage {
  id: string;
  athlete_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  announcement: boolean;
  attachment_path?: string | null;
  attachment_kind?: AttachmentKind | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  duration_sec?: number | null;
  reply_to?: string | null;
  keep?: boolean;
  file_id?: string | null;
  coach_files?: { name: string; path: string; mime: string; size: number } | null;
  message_reactions?: { user_id: string; emoji: string }[];
}

const EMOJIS = ["👍", "🔥", "💪", "😂", "❤️", "👏", "🙏", "😮"];

const time = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short" });

async function shrinkImage(file: File, max = 1600): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.82));
}

function videoSeconds(file: File): Promise<number | null> {
  return new Promise((res) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      res(Number.isFinite(v.duration) ? v.duration : null);
    };
    v.onerror = () => res(null);
    v.src = URL.createObjectURL(file);
  });
}

export function ChatThread({
  athleteId,
  me,
  initial,
  disabled,
  isCoach = false,
}: {
  athleteId: string;
  me: string;
  initial: ChatMessage[];
  disabled?: string; // reason the box is off
  isCoach?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | false>(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [markup, setMarkup] = useState<ChatMessage | null>(null);
  const [rec, setRec] = useState<{ start: number; mr: MediaRecorder; chunks: Blob[] } | null>(null);
  const [now, setNow] = useState(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const merge = useCallback((incoming: ChatMessage[]) => {
    setMsgs((cur) => {
      const by = new Map(cur.map((m) => [m.id, m]));
      for (const m of incoming) by.set(m.id, { ...by.get(m.id), ...m, message_reactions: m.message_reactions ?? by.get(m.id)?.message_reactions ?? [] });
      return [...by.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const markRead = useCallback(async () => {
    await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("athlete_id", athleteId).neq("sender_id", me).is("read_at", null);
  }, [supabase, athleteId, me]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("messages").select(MESSAGE_COLUMNS).eq("athlete_id", athleteId).order("created_at", { ascending: false }).limit(40);
    if (data) merge(data as unknown as ChatMessage[]);
  }, [supabase, athleteId, merge]);

  useEffect(() => {
    markRead();
    const ch = supabase
      .channel(`chat-${athleteId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `athlete_id=eq.${athleteId}` }, (p) => {
        merge([p.new as ChatMessage]);
        if ((p.new as ChatMessage).sender_id !== me) markRead();
      })
      .subscribe();
    const poll = setInterval(refresh, 20000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [supabase, athleteId, me, merge, markRead, refresh]);

  // Library files (PARQ, guides) from the coach-files bucket
  useEffect(() => {
    const need = msgs.map((m) => m.coach_files?.path).filter((p): p is string => !!p && !urls[`lib:${p}`]);
    if (!need.length) return;
    supabase.storage
      .from("coach-files")
      .createSignedUrls([...new Set(need)], 60 * 60 * 6)
      .then(({ data }) => {
        if (!data) return;
        setUrls((u) => {
          const n = { ...u };
          for (const x of data) if (x.signedUrl && x.path) n[`lib:${x.path}`] = x.signedUrl;
          return n;
        });
      });
  }, [msgs, urls, supabase]);

  // Signed links for attachments (private bucket), fetched in one go
  useEffect(() => {
    const need = msgs.map((m) => m.attachment_path).filter((p): p is string => !!p && !urls[p]);
    if (!need.length) return;
    supabase.storage
      .from("chat-media")
      .createSignedUrls([...new Set(need)], 60 * 60 * 6)
      .then(({ data }) => {
        if (!data) return;
        setUrls((u) => {
          const n = { ...u };
          for (const x of data) if (x.signedUrl && x.path) n[x.path] = x.signedUrl;
          return n;
        });
      });
  }, [msgs, urls, supabase]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rec]);

  async function insert(row: Partial<ChatMessage>) {
    const { data, error } = await supabase
      .from("messages")
      .insert({ athlete_id: athleteId, body: "", ...row })
      .select(MESSAGE_COLUMNS)
      .single();
    if (error) {
      setError(/switched off/.test(error.message) ? "Chat is switched off for this account." : "Not sent. Check your connection and try again.");
      return false;
    }
    merge([data as unknown as ChatMessage]);
    return true;
  }

  async function upload(blob: Blob, mime: string, name: string, kind: AttachmentKind, extra: Partial<ChatMessage> = {}) {
    if (blob.size > MAX_BYTES) {
      setError(kind === "video" ? `That video is ${fmtBytes(blob.size)}. Keep it under 50 MB (trim it to the rep that matters).` : "That file is over 50 MB.");
      return false;
    }
    const path = `${athleteId}/${crypto.randomUUID()}.${extFor(mime, name)}`;
    const { error: up } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: mime.split(";")[0] });
    if (up) {
      setError("Upload failed. Check your connection and try again.");
      return false;
    }
    return insert({ attachment_path: path, attachment_kind: kind, attachment_name: safeName(name), attachment_size: blob.size, ...extra });
  }

  async function onFile(file: File) {
    setError(null);
    const kind = kindFor(file.type);
    if (!kind) {
      setError("You can send photos, videos, voice notes and PDFs.");
      return;
    }
    setSending(kind === "video" ? "Uploading video…" : "Uploading…");
    try {
      if (kind === "image") {
        const b = await shrinkImage(file);
        await upload(b, b.type || file.type, file.name, "image", { body: text.trim().slice(0, 2000) });
      } else if (kind === "video") {
        const sec = await videoSeconds(file);
        if (sec != null && sec > MAX_VIDEO_SEC) setError(`That video is ${fmtSec(sec)} long. Keep it under ${MAX_VIDEO_SEC} seconds so it uploads fast.`);
        else await upload(file, file.type, file.name, "video", { duration_sec: sec != null ? Math.round(sec * 10) / 10 : null, body: text.trim().slice(0, 2000) });
      } else await upload(file, file.type, file.name, kind, { body: text.trim().slice(0, 2000) });
      setText("");
    } finally {
      setSending(false);
    }
  }

  async function startRec() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
      const mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.start(250);
      setRec({ start: Date.now(), mr, chunks });
    } catch {
      setError("Allow the microphone to send a voice message.");
    }
  }
  async function stopRec(sendIt: boolean) {
    if (!rec) return;
    const { mr, chunks, start } = rec;
    setRec(null);
    const done = new Promise<void>((r) => (mr.onstop = () => r()));
    mr.stop();
    mr.stream.getTracks().forEach((t) => t.stop());
    await done;
    const sec = (Date.now() - start) / 1000;
    if (!sendIt || sec < 1) return;
    const mime = mr.mimeType || "audio/webm";
    setSending("Sending voice message…");
    await upload(new Blob(chunks, { type: mime }), mime, "Voice message", "audio", { duration_sec: Math.min(600, Math.round(sec * 10) / 10) });
    setSending(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending("Sending…");
    setError(null);
    if (await insert({ body: body.slice(0, 2000) })) setText("");
    setSending(false);
  }

  async function react(m: ChatMessage, emoji: string) {
    setReactFor(null);
    const mine = (m.message_reactions ?? []).find((r) => r.user_id === me);
    const others = (m.message_reactions ?? []).filter((r) => r.user_id !== me);
    const next = mine?.emoji === emoji ? others : [...others, { user_id: me, emoji }];
    merge([{ ...m, message_reactions: next }]);
    if (mine?.emoji === emoji) await supabase.from("message_reactions").delete().eq("message_id", m.id).eq("user_id", me);
    else await supabase.from("message_reactions").upsert({ message_id: m.id, user_id: me, emoji }, { onConflict: "message_id,user_id" });
  }

  async function toggleKeep(m: ChatMessage) {
    merge([{ ...m, keep: !m.keep }]);
    await supabase.from("messages").update({ keep: !m.keep }).eq("id", m.id);
  }

  async function removeMsg(m: ChatMessage) {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", m.id);
    if (!error) {
      if (m.attachment_path && isCoach) await supabase.storage.from("chat-media").remove([m.attachment_path]);
      setMsgs((cur) => cur.filter((x) => x.id !== m.id));
    }
  }

  const byId = new Map(msgs.map((m) => [m.id, m]));
  let lastDay = "";
  return (
    <div className="flex min-h-[60dvh] flex-col">
      <div className="flex-1 space-y-2 pb-4">
        {msgs.length === 0 && <p className="py-10 text-center text-muted">No messages yet. Say hi, or send a video of your lift for feedback.</p>}
        {msgs.map((m) => {
          const d = day.format(new Date(m.created_at));
          const showDay = d !== lastDay;
          lastDay = d;
          const mine = m.sender_id === me;
          const url = m.attachment_path ? urls[m.attachment_path] : null;
          const reply = m.reply_to ? byId.get(m.reply_to) : null;
          const counts = new Map<string, number>();
          for (const r of m.message_reactions ?? []) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
          return (
            <div key={m.id}>
              {showDay && <p className="my-3 text-center text-xs uppercase tracking-widest text-muted">{d}</p>}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  <div
                    onClick={() => setReactFor(reactFor === m.id ? null : m.id)}
                    className={`cursor-pointer overflow-hidden whitespace-pre-wrap rounded-2xl text-[15px] ${mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-surface-2 text-text"} ${m.attachment_kind === "image" || m.attachment_kind === "video" ? "" : "px-3.5 py-2"}`}
                  >
                    {m.announcement && !mine && <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-brand">Announcement</p>}
                    {reply && (
                      <p className={`text-xs ${m.attachment_kind === "image" ? "px-3 pt-2" : "mb-1"} ${mine ? "text-white/80" : "text-muted"}`}>
                        ↩ Feedback on {reply.attachment_kind === "video" ? "your video" : reply.attachment_kind === "image" ? "your photo" : "a message"}
                      </p>
                    )}
                    {m.attachment_kind === "image" &&
                      (url ? (
                        <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={m.attachment_name ?? "Photo"} className="block max-h-80 w-full object-cover" loading="lazy" />
                        </a>
                      ) : (
                        <div className="h-48 w-64 animate-pulse bg-black/20" />
                      ))}
                    {m.attachment_kind === "video" &&
                      (url ? (
                         
                        <video src={url} controls playsInline preload="metadata" className="block max-h-96 w-full bg-black" onClick={(e) => e.stopPropagation()} />
                      ) : (
                        <div className="flex h-48 w-64 items-center justify-center bg-black/30 text-sm">Loading video…</div>
                      ))}
                    {m.attachment_kind === "audio" && (
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                        <Mic size={16} className="shrink-0" />
                        {url ? <audio src={url} controls preload="metadata" className="h-10 max-w-[15rem]" /> : <span className="text-sm">Loading…</span>}
                      </div>
                    )}
                    {m.attachment_kind === "file" && (
                      <a href={url ?? "#"} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 font-bold underline underline-offset-4">
                        <FileText size={18} /> {m.attachment_name ?? "File"} {m.attachment_size ? <span className="font-normal opacity-70">· {fmtBytes(m.attachment_size)}</span> : null}
                      </a>
                    )}
                    {m.coach_files && (
                      <a
                        href={urls[`lib:${m.coach_files.path}`] ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`mb-1 flex items-center gap-2 rounded-xl px-3 py-2 font-bold ${mine ? "bg-white/15" : "bg-surface"}`}
                      >
                        <FileText size={18} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{m.coach_files.name}</span>
                        <span className="text-xs font-normal opacity-80">Open</span>
                      </a>
                    )}
                    {m.body && <p className={m.attachment_kind === "image" || m.attachment_kind === "video" ? "px-3.5 pt-2" : m.attachment_kind ? "mt-1" : ""}>{m.body}</p>}
                    <p className={`mt-0.5 text-right text-[10px] ${m.attachment_kind === "image" || m.attachment_kind === "video" ? "px-3.5 pb-1.5" : ""} ${mine ? "text-white/70" : "text-muted"}`}>
                      {m.duration_sec ? `${fmtSec(Number(m.duration_sec))} · ` : ""}
                      {time.format(new Date(m.created_at))}
                      {mine && m.read_at && " · Seen"}
                    </p>
                  </div>
                  {counts.size > 0 && (
                    <div className={`-mt-1 flex gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                      {[...counts].map(([e, n]) => (
                        <button key={e} onClick={() => react(m, e)} className="rounded-full border border-line bg-surface px-1.5 text-sm leading-6">
                          {e}{n > 1 ? ` ${n}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  {reactFor === m.id && (
                    <div className={`mt-1 flex flex-wrap items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                      <div className="flex rounded-full border border-line bg-surface p-1 shadow-lg">
                        {EMOJIS.map((e) => (
                          <button key={e} onClick={() => react(m, e)} className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-surface-2" aria-label={`React ${e}`}>
                            {e}
                          </button>
                        ))}
                      </div>
                      {isCoach && !mine && url && (m.attachment_kind === "video" || m.attachment_kind === "image") && (
                        <button onClick={() => { setReactFor(null); setMarkup(m); }} className="flex min-h-9 items-center gap-1 rounded-full bg-brand px-3 text-xs font-extrabold text-white">
                          <Pencil size={14} /> Draw feedback
                        </button>
                      )}
                      {isCoach && m.attachment_path && (
                        <button onClick={() => toggleKeep(m)} className={`flex min-h-9 items-center gap-1 rounded-full border border-line px-3 text-xs font-bold ${m.keep ? "text-warn" : "text-muted"}`}>
                          <Star size={14} fill={m.keep ? "currentColor" : "none"} /> {m.keep ? "Kept" : "Keep"}
                        </button>
                      )}
                      {(isCoach || mine) && (
                        <button onClick={() => removeMsg(m)} className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted" aria-label="Delete message">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {disabled ? (
        <p className="rounded-xl bg-surface-2 p-3 text-center text-sm text-muted">{disabled}</p>
      ) : rec ? (
        <div className="sticky bottom-0 flex items-center gap-2 bg-ink pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <span className="flex min-h-12 flex-1 items-center gap-2 rounded-2xl border border-brand bg-brand/10 px-4 font-bold">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" /> Recording {fmtSec((now - rec.start) / 1000)}
          </span>
          <button onClick={() => stopRec(false)} className="min-h-12 rounded-2xl px-3 text-sm font-bold text-muted">Cancel</button>
          <button onClick={() => stopRec(true)} className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white" aria-label="Stop and send">
            <Square size={18} fill="currentColor" />
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="sticky bottom-0 flex items-end gap-1.5 bg-ink pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,application/pdf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onFile(f);
            }}
          />
          <button type="button" disabled={!!sending} onClick={() => fileRef.current?.click()} className="flex h-12 w-11 shrink-0 items-center justify-center rounded-full text-muted disabled:opacity-50" aria-label="Send a photo, video or file">
            <Paperclip size={21} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) send(e);
            }}
            rows={1}
            maxLength={2000}
            placeholder={sending || "Message"}
            disabled={!!sending}
            className="max-h-40 min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-line bg-surface-2 px-4 py-3 text-text focus:border-brand focus:outline-none"
            aria-label="Message"
          />
          {text.trim() ? (
            <button disabled={!!sending} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-50" aria-label="Send">
              <Send size={20} />
            </button>
          ) : (
            <button type="button" disabled={!!sending} onClick={startRec} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text disabled:opacity-50" aria-label="Record a voice message">
              <Mic size={20} />
            </button>
          )}
        </form>
      )}
      {error && <p className="mt-1 text-sm text-brand">{error}</p>}

      {markup && markup.attachment_path && urls[markup.attachment_path] && (
        <MediaMarkup
          src={urls[markup.attachment_path]}
          kind={markup.attachment_kind === "video" ? "video" : "image"}
          onClose={() => setMarkup(null)}
          onSend={async (jpeg, note, at) => {
            const body = [at != null ? `At ${fmtSec(at)}` : null, note].filter(Boolean).join(": ");
            const ok = await upload(jpeg, "image/jpeg", "Feedback.jpg", "image", { body, reply_to: markup.id });
            if (!ok) return "Couldn't send. Try again.";
            setMarkup(null);
            return null;
          }}
        />
      )}
    </div>
  );
}
