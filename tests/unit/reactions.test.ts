import { describe, expect, it } from "vitest";
import { ago, isReaction, replyBody } from "@/lib/reactions";

describe("reactions", () => {
  it("accepts only the four reactions", () => {
    expect(isReaction("🔥")).toBe(true);
    expect(isReaction("💩")).toBe(false);
    expect(isReaction(null)).toBe(false);
  });
  it("quotes the session in a reply", () => {
    expect(replyBody("Upper Strength", "Tue 24 Nov", "  Great work ")).toBe("Re: Upper Strength (Tue 24 Nov): Great work");
    expect(replyBody(null, "Mon 1 Dec", "Nice")).toBe("Re: your session (Mon 1 Dec): Nice");
  });
  it("labels time since", () => {
    const now = new Date("2026-11-26T10:00:00Z");
    expect(ago("2026-11-26T09:59:40Z", now)).toBe("just now");
    expect(ago("2026-11-26T09:15:00Z", now)).toBe("45 min ago");
    expect(ago("2026-11-26T05:00:00Z", now)).toBe("5 h ago");
    expect(ago("2026-11-25T08:00:00Z", now)).toBe("yesterday");
    expect(ago("2026-11-22T10:00:00Z", now)).toBe("4 days ago");
  });
});
