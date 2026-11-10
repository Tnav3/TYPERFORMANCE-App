// Training Tools hub: which tools a person can open. Pure: unit-tested.
import { hasFeature } from "./features";
import type { Profile } from "./types";

export type ToolKey = "1rm" | "mas" | "rpe" | "hr" | "standards";

export const TOOLS: {
  key: ToolKey;
  href: string;
  title: string;
  short: string;
  description: string;
}[] = [
  {
    key: "1rm",
    href: "/calculator",
    title: "1RM Calculator",
    short: "1RM",
    description: "Your e1RM and loads for every %",
  },
  {
    key: "mas",
    href: "/mas",
    title: "MAS Calculator",
    short: "MAS",
    description: "Interval targets: run, bike, row, SkiErg",
  },
  {
    key: "rpe",
    href: "/rpe",
    title: "RPE & RIR Chart",
    short: "RPE & RIR",
    description: "Reps in reserve and %1RM by RPE",
  },
  {
    key: "hr",
    href: "/hr",
    title: "HR Zones",
    short: "HR Zones",
    description: "Heart-rate zones with matching RPE",
  },
  {
    key: "standards",
    href: "/standards",
    title: "Strength Standards",
    short: "Standards",
    description: "Relative strength and jumps vs Bronze, Silver, Gold",
  },
];

type P = Parameters<typeof hasFeature>[0] & Partial<Pick<Profile, "role">>;

/** Standards need either Testing or the 1RM Calculator to have anything to show. */
export function toolsFor(p: P) {
  return TOOLS.filter((t) =>
    t.key === "standards"
      ? hasFeature(p, "testing") || hasFeature(p, "1rm")
      : hasFeature(p, t.key),
  );
}

/** "1RM · MAS · RPE & RIR · HR Zones · Standards" */
export const toolsSummary = (tools: typeof TOOLS) =>
  tools.map((t) => t.short).join(" · ");
