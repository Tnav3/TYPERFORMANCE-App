import { describe, it, expect } from "vitest";
import { embedUrl } from "@/lib/programming/video";

describe("in-app exercise video", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"],
  ])("YouTube %s", (link, id) => {
    const e = embedUrl(link)!;
    expect(e).toContain(`https://www.youtube-nocookie.com/embed/${id}?`);
  });
  it("keeps a start time", () => {
    expect(embedUrl("https://youtu.be/dQw4w9WgXcQ?t=42")).toContain("start=42");
  });
  it("Vimeo, including unlisted hash", () => {
    expect(embedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789?dnt=1&playsinline=1",
    );
    expect(embedUrl("https://vimeo.com/123456789/abcdef1234")).toContain("h=abcdef1234");
  });
  it("anything else is not embedded", () => {
    expect(embedUrl("https://example.com/video.mp4")).toBeNull();
    expect(embedUrl("http://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(embedUrl("javascript:alert(1)")).toBeNull();
    expect(embedUrl(null)).toBeNull();
  });
});
