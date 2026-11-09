// Sends app events to the coach's GoHighLevel "Inbound Webhook" workflow trigger.
// GHL does the emailing (spec §8: email only, via GHL).
// Does nothing until GHL_WEBHOOK_URL is set in Vercel. Never throws: an email
// problem must not stop the coach from approving an athlete.

export type GhlEvent = "account_approved";

export async function sendGhlEvent(
  event: GhlEvent,
  data: { email: string; first_name?: string | null; full_name?: string | null; [k: string]: unknown },
): Promise<"sent" | "skipped" | "failed"> {
  const url = process.env.GHL_WEBHOOK_URL;
  if (!url) return "skipped";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        app_url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://typerformance-app.vercel.app",
        sent_at: new Date().toISOString(),
        ...data,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
