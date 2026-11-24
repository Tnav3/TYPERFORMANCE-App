// GoHighLevel → app: payment events switch a client's access on or off.
// Set up in GHL: Workflow → trigger (Payment Received / Subscription Cancelled / Payment Failed)
// → action "Webhook" POST to https://<app>/api/ghl/payments with header
// x-typ-secret: <GHL_WEBHOOK_SECRET> and JSON body { event, email, plan }.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanEmail, decide, safeEqual } from "@/lib/programming/payments";

export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function pick(body: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    const parts = k.split(".");
    let v: unknown = body;
    for (const p of parts) v = v && typeof v === "object" ? (v as Record<string, unknown>)[p] : undefined;
    if (v != null && v !== "") return v;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const secret = process.env.GHL_WEBHOOK_SECRET ?? "";
  const given = req.headers.get("x-typ-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
  if (!safeEqual(given, secret)) return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  const db = admin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const event = pick(body, "event", "type", "event_type", "trigger");
  const email = cleanEmail(pick(body, "email", "contact.email", "customer.email", "contact_email"));
  const planRaw = pick(body, "plan", "product_name", "product.name", "price_name", "offer");
  const action = decide(event, planRaw);

  let result = "ignored";
  if (!email) result = "no valid email";
  else if (action.kind === "ignore") result = action.reason;
  else {
    const { data: profile } = await db.from("profiles").select("id, role, status").ilike("email", email).maybeSingle();
    if (action.kind === "activate") {
      if (profile && profile.role === "athlete") {
        const patch: Record<string, unknown> = { status: "active" };
        if (action.plan) patch.feat_mealplan = action.plan === "premium";
        await db.from("profiles").update(patch).eq("id", profile.id);
        result = `activated (${action.plan ?? "plan unchanged"})`;
      } else if (!profile) {
        await db.from("invites").upsert({ email, plan: action.plan, auto_approve: true, note: "From GHL payment" }, { onConflict: "email" });
        result = "invite created (will be approved on signup)";
      } else result = "coach account: no change";
    } else {
      if (profile && profile.role === "athlete") {
        await db.from("profiles").update({ status: "inactive" }).eq("id", profile.id);
        result = "deactivated";
      } else {
        await db.from("invites").delete().eq("email", email).is("used_at", null);
        result = profile ? "coach account: no change" : "no account; pending invite removed";
      }
    }
  }
  await db.from("payment_events").insert({
    event: String(event ?? "").slice(0, 60),
    email,
    plan: planRaw == null ? null : String(planRaw).slice(0, 100),
    result,
    raw: body,
  });
  return NextResponse.json({ ok: true, result });
}
