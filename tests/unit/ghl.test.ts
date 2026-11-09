import { describe, it, expect, vi, afterEach } from "vitest";
import { sendGhlEvent } from "@/lib/ghl";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GHL webhook", () => {
  it("does nothing until the webhook URL is set", async () => {
    vi.stubEnv("GHL_WEBHOOK_URL", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await sendGhlEvent("account_approved", { email: "a@b.c" })).toBe("skipped");
    expect(f).not.toHaveBeenCalled();
  });
  it("posts the event with the athlete's details", async () => {
    vi.stubEnv("GHL_WEBHOOK_URL", "https://hooks.example/abc");
    const f = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", f);
    expect(await sendGhlEvent("account_approved", { email: "alice@typ.test", first_name: "Alice" })).toBe("sent");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://hooks.example/abc");
    expect(JSON.parse(init.body)).toMatchObject({ event: "account_approved", email: "alice@typ.test", first_name: "Alice" });
  });
  it("never throws if GHL is down", async () => {
    vi.stubEnv("GHL_WEBHOOK_URL", "https://hooks.example/abc");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await sendGhlEvent("account_approved", { email: "a@b.c" })).toBe("failed");
  });
});
