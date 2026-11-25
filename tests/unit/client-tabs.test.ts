import { describe, it, expect } from "vitest";
import { visibleTabs } from "@/lib/client/tabs";

describe("client tabs", () => {
  it("never shows more than 5; Progress steps aside for Nutrition", () => {
    expect(visibleTabs({ train: true, chat: true, progress: true, food: "/meal-plan" })).toEqual(["home", "train", "chat", "food", "more"]);
    expect(visibleTabs({ train: true, chat: true, progress: true, food: null })).toEqual(["home", "train", "chat", "progress", "more"]);
    expect(visibleTabs({ train: false, chat: true, progress: false, food: "/macros" })).toEqual(["home", "chat", "food", "more"]);
  });
});
