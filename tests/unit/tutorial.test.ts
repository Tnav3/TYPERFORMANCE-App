import { describe, it, expect } from "vitest";
import { welcomeSteps, TIPS, tipSeen } from "@/lib/tutorial";

const all = { role: "athlete" as const };
const off = {
  role: "athlete" as const, feat_checkin: false, feat_testing: false, feat_1rm: false, feat_mas: false,
  feat_rpe: false, feat_hr: false, feat_fights: false, feat_mobility: false, feat_nutrition: false,
};

describe("welcome tour", () => {
  it("everything on: welcome → log → rpe → check-in → testing → tools → fights → mobility → done", () => {
    expect(welcomeSteps(all).map((s) => s.key)).toEqual([
      "welcome", "log", "rpe", "checkin", "testing", "tools", "fights", "mobility", "done",
    ]);
  });
  it("only shows switched-on features; always starts and ends the same", () => {
    expect(welcomeSteps(off).map((s) => s.key)).toEqual(["welcome", "done"]);
    expect(welcomeSteps({ ...off, feat_testing: true }).map((s) => s.key)).toEqual(["welcome", "testing", "tools", "done"]);
  });
  it("tools step lists only the tools that are on", () => {
    const t = welcomeSteps({ ...off, feat_mas: true }).find((s) => s.key === "tools")!;
    expect(t.body).toContain("MAS Calculator");
    expect(t.body).not.toContain("1RM Calculator");
  });
});

describe("tips", () => {
  it("one tip per feature page, and seen tips stay hidden", () => {
    expect(Object.keys(TIPS).sort()).toEqual(
      ["calculator", "fights", "hr", "log", "mas", "mobility", "nutrition", "rpe", "standards", "testing"],
    );
    expect(tipSeen({ tips_seen: ["mas"] }, "mas")).toBe(true);
    expect(tipSeen({ tips_seen: null }, "mas")).toBe(false);
    expect(tipSeen(null, "mas")).toBe(false);
  });
});
