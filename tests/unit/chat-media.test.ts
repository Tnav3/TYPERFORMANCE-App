import { describe, it, expect } from "vitest";
import { extFor, fmtBytes, fmtSec, kindFor, safeName } from "@/lib/chat-media";

describe("chat media helpers", () => {
  it("sorts files by kind", () => {
    expect(kindFor("image/jpeg")).toBe("image");
    expect(kindFor("video/quicktime")).toBe("video");
    expect(kindFor("audio/webm;codecs=opus")).toBe("audio");
    expect(kindFor("application/pdf")).toBe("file");
    expect(kindFor("application/zip")).toBeNull();
  });
  it("picks extensions and safe names", () => {
    expect(extFor("audio/webm;codecs=opus")).toBe("webm");
    expect(extFor("application/octet-stream", "plan.PDF")).toBe("pdf");
    expect(safeName("../../etc/pass wd?.pdf")).toBe("....etcpass wd.pdf");
  });
  it("formats sizes and times", () => {
    expect(fmtBytes(2_500_000)).toBe("2.4 MB");
    expect(fmtSec(75)).toBe("1:15");
  });
});
