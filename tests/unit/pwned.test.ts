import { describe, it, expect } from "vitest";
import { parseRange, sha1Hex } from "@/lib/pwned";

describe("pwned passwords", () => {
  it("hashes like HIBP expects", async () => {
    expect(await sha1Hex("password")).toBe("5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
  });
  it("finds the suffix count and ignores padding rows", () => {
    const body = "1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365\r\nABCDEF:0\r\n";
    expect(parseRange(body, "1e4c9b93f3f0682250b6cf8331b7ee68fd8")).toBe(9659365);
    expect(parseRange(body, "FFFF")).toBe(0);
  });
});
