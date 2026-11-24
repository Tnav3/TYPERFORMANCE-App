// Sends queued notifications as Web Push. Called by the database (pg_net)
// with the shared secret whenever a notification is queued, and once a minute.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { safeEqual } from "@/lib/programming/payments";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.PUSH_DISPATCH_SECRET ?? "";
  if (!safeEqual(req.headers.get("x-typ-secret") ?? "", secret))
    return NextResponse.json({ ok: false }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!url || !key || !pub || !priv) return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:coach@typerformance.app", pub, priv);
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: queue } = await db
    .from("notifications")
    .select("id, user_id, kind, title, body, url, attempts")
    .is("sent_at", null)
    .lt("attempts", 5)
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order("created_at")
    .limit(200);
  if (!queue?.length) return NextResponse.json({ ok: true, sent: 0 });

  const users = [...new Set(queue.map((n) => n.user_id))];
  const { data: subs } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", users);
  let sent = 0;
  for (const n of queue) {
    const mine = (subs ?? []).filter((s) => s.user_id === n.user_id);
    let ok = mine.length === 0; // nobody to send to: mark done
    let error: string | null = mine.length ? null : "no devices";
    for (const s of mine) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.kind === "message" ? `msg-${n.user_id}` : undefined }),
          { TTL: 60 * 60 * 12 },
        );
        ok = true;
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        error = `push failed${code ? ` (${code})` : ""}`;
      }
    }
    await db
      .from("notifications")
      .update(ok ? { sent_at: new Date().toISOString(), error } : { attempts: n.attempts + 1, error })
      .eq("id", n.id);
  }
  return NextResponse.json({ ok: true, sent });
}
