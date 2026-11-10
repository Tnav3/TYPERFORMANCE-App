import { describe, it, expect } from "vitest";
import {
  activityTone,
  byLeastRecent,
  lastSeenLabel,
  shouldTouch,
} from "@/lib/activity";

const now = new Date("2026-11-10T09:00:00Z"); // 8 pm Sydney
describe("last opened", () => {
  it("labels by Sydney calendar day", () => {
    expect(lastSeenLabel(null, now)).toBe("Never");
    expect(lastSeenLabel("2026-11-09T14:00:00Z", now)).toBe("Today"); // 1 am Sydney 10 Nov
    expect(lastSeenLabel("2026-11-09T12:00:00Z", now)).toBe("Yesterday"); // 11 pm Sydney 9 Nov
    expect(lastSeenLabel("2026-11-05T09:00:00Z", now)).toBe("5 days ago");
    expect(lastSeenLabel("2026-10-20T09:00:00Z", now)).toBe("3 weeks ago");
    expect(lastSeenLabel("2026-07-01T09:00:00Z", now)).toBe("4 months ago");
  });
  it("tones: ≤7 days green, ≤21 amber, else red", () => {
    expect(activityTone("2026-11-03T09:00:00Z", now)).toBe("ok");
    expect(activityTone("2026-10-25T09:00:00Z", now)).toBe("warn");
    expect(activityTone("2026-10-01T09:00:00Z", now)).toBe("bad");
    expect(activityTone(null, now)).toBe("bad");
  });
  it("stamps at most hourly; never-opened sorts first", () => {
    expect(shouldTouch(null, now)).toBe(true);
    expect(shouldTouch("2026-11-10T08:30:00Z", now)).toBe(false);
    expect(shouldTouch("2026-11-10T07:30:00Z", now)).toBe(true);
    const r = byLeastRecent([
      { id: "a", last_seen_at: "2026-11-09T00:00:00Z" },
      { id: "b", last_seen_at: null },
      { id: "c", last_seen_at: "2026-10-01T00:00:00Z" },
    ]);
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});
