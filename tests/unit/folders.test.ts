import { describe, it, expect } from "vitest";
import { childrenOf, descendants, folderOptions, pathTo, type Folder } from "@/lib/programming/folders";

const f = (id: string, parent: string | null, sort = 0): Folder => ({ id, name: id, parent_id: parent, sort_order: sort });
const all = [f("Combat", null, 1), f("Peaking", "Combat", 2), f("Camp", "Combat", 1), f("Protocols", null, 2), f("Rehab", "Protocols")];

describe("program folders", () => {
  it("lists children in order", () => expect(childrenOf(all, "Combat").map((x) => x.id)).toEqual(["Camp", "Peaking"]));
  it("builds the path", () => expect(pathTo(all, "Peaking").map((x) => x.id)).toEqual(["Combat", "Peaking"]));
  it("finds everything inside a folder", () => expect([...descendants(all, "Combat")].sort()).toEqual(["Camp", "Combat", "Peaking"]));
  it("labels options with their path", () =>
    expect(folderOptions(all).map((o) => o.label)).toEqual(["Combat", "Combat › Camp", "Combat › Peaking", "Protocols", "Protocols › Rehab"]));
});
