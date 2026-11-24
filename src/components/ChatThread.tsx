"use client";
// Coach ↔ client chat. Live via Supabase Realtime, with a 20s refresh fallback.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface ChatMessage {
  id: string;
  athlete_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  announcement: boolean;
}

const time = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  hour: "numeric",
  minute: "2-digit",
});
const day = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function ChatThread({
  athleteId,
  me,
  initial,
  disabled,
}: {
  athleteId: string;
  me: string;
  initial: ChatMessage[];
  disabled?: string; // reason the box is off
}) {
  const supabase = useMemo(() => createClient(), []);
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const merge = useCallback((incoming: ChatMessage[]) => {
    setMsgs((cur) => {
      const by = new Map(cur.map((m) => [m.id, m]));
      for (const m of incoming) by.set(m.id, m);
      return [...by.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const markRead = useCallback(async () => {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("athlete_id", athleteId)
      .neq("sender_id", me)
      .is("read_at", null);
  }, [supabase, athleteId, me]);

  useEffect(() => {
    markRead();
    const ch = supabase
      .channel(`chat-${athleteId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `athlete_id=eq.${athleteId}` },
        (p) => {
          merge([p.new as ChatMessage]);
          if ((p.new as ChatMessage).sender_id !== me) markRead();
        },
      )
      .subscribe();
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, athlete_id, sender_id, body, created_at, read_at, announcement")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (data) merge(data as ChatMessage[]);
    }, 20000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [supabase, athleteId, me, merge, markRead]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const { data, error } = await supabase
      .from("messages")
      .insert({ athlete_id: athleteId, body: body.slice(0, 2000) })
      .select("id, athlete_id, sender_id, body, created_at, read_at, announcement")
      .single();
    setSending(false);
    if (error) {
      setError(/switched off/.test(error.message) ? "Chat is switched off for this account." : "Not sent. Check your connection and try again.");
      return;
    }
    setText("");
    merge([data as ChatMessage]);
  }

  let lastDay = "";
  return (
    <div className="flex min-h-[60dvh] flex-col">
      <div className="flex-1 space-y-2 pb-4">
        {msgs.length === 0 && <p className="py-10 text-center text-muted">No messages yet. Say hi.</p>}
        {msgs.map((m) => {
          const d = day.format(new Date(m.created_at));
          const showDay = d !== lastDay;
          lastDay = d;
          const mine = m.sender_id === me;
          return (
            <div key={m.id}>
              {showDay && <p className="my-3 text-center text-xs uppercase tracking-widest text-muted">{d}</p>}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] ${
                    mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-surface-2 text-text"
                  }`}
                >
                  {m.announcement && !mine && (
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-brand">Announcement</p>
                  )}
                  {m.body}
                  <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>
                    {time.format(new Date(m.created_at))}
                    {mine && m.read_at && " · Seen"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {disabled ? (
        <p className="rounded-xl bg-surface-2 p-3 text-center text-sm text-muted">{disabled}</p>
      ) : (
        <form onSubmit={send} className="sticky bottom-0 flex items-end gap-2 bg-ink pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) send(e);
            }}
            rows={1}
            maxLength={2000}
            placeholder="Message"
            className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-line bg-surface-2 px-4 py-3 text-text focus:border-brand focus:outline-none"
            aria-label="Message"
          />
          <button
            disabled={sending || !text.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-50"
            aria-label="Send"
          >
            <Send size={20} />
          </button>
        </form>
      )}
      {error && <p className="mt-1 text-sm text-brand">{error}</p>}
    </div>
  );
}
