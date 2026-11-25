// Leaked-password check using the Have I Been Pwned "range" API (k-anonymity):
// only the first 5 characters of the password's SHA-1 hash leave the device.
// Free, no key. Supabase's built-in version needs their Pro plan.
// Fails open: if the service can't be reached, the password is allowed.

export function parseRange(body: string, suffix: string): number {
  const want = suffix.toUpperCase();
  for (const line of body.split(/\r?\n/)) {
    const [s, n] = line.trim().split(":");
    if (s && s.toUpperCase() === want) return Number(n) || 0;
  }
  return 0;
}

export async function sha1Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** How many times this password appears in known breaches (0 = not found or check unavailable). */
export async function timesPwned(password: string): Promise<number> {
  try {
    const hash = await sha1Hex(password);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return 0;
    return parseRange(await res.text(), hash.slice(5));
  } catch {
    return 0;
  }
}

export const PWNED_MESSAGE =
  "That password has appeared in a data breach, so it's easy for others to guess. Please choose a different one.";
