import { describe, expect, it } from "vitest";
import { linkParts, searchTerms, termsIn, type GlossaryTerm } from "@/lib/glossary";

const T = (key: string, aliases: string[]): GlossaryTerm => ({ key, title: key.toUpperCase(), aliases, what: `about ${key}`, how: null, why: null });
const terms = [T("amrap", ["AMRAP"]), T("plus-set", ["plus set"]), T("superset", ["superset"]), T("rir", ["RIR"]), T("tempo", ["tempo"]), T("vbt", ["VBT", "m/s"]), T("wave", ["wave"])];

describe("termsIn", () => {
  it("finds abbreviations case-insensitively on word boundaries", () => {
    expect(termsIn("3 × AMRAP @ 60%", terms)).toEqual(["amrap"]);
    expect(termsIn("3 × 8 · 2 rir", terms)).toEqual(["rir"]);
    expect(termsIn("stirring", terms)).toEqual([]);
  });
  it("spots tempo, plus sets and m/s", () => {
    expect(termsIn("4 × 5 tempo 31X1", terms)).toEqual(["tempo"]);
    expect(termsIn("3 × 5+", terms)).toEqual(["plus-set"]);
    expect(termsIn("target 0.8 m/s", terms)).toEqual(["vbt"]);
  });
  it("adds superset for superset blocks and keeps glossary order", () => {
    expect(termsIn("2 rir AMRAP", terms, { superset: true })).toEqual(["amrap", "superset", "rir"]);
  });
  it("does not match inside other words", () => {
    expect(termsIn("microwave", terms)).toEqual([]);
  });
});

describe("searchTerms", () => {
  it("ranks title/alias hits first and searches body text", () => {
    expect(searchTerms("", terms)).toHaveLength(terms.length);
    expect(searchTerms("rir", terms).map((t) => t.key)).toEqual(["rir"]);
    expect(searchTerms("about tempo", terms).map((t) => t.key)).toEqual(["tempo"]);
  });
});

describe("linkParts", () => {
  it("splits URLs out of text", () => {
    expect(linkParts("Go to https://a.com/x now")).toEqual([{ t: "Go to " }, { t: "https://a.com/x", href: "https://a.com/x" }, { t: " now" }]);
    expect(linkParts("plain")).toEqual([{ t: "plain" }]);
  });
});
