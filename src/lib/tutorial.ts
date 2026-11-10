// First-use tutorial: a welcome walkthrough (only for switched-on features)
// and a one-time tip at the top of each feature. Pure: unit-tested.
import { hasFeature } from "./features";
import type { Profile } from "./types";
import { toolsFor } from "./tools";

export interface TourStep {
  key: string;
  title: string;
  body: string;
}

type P = Parameters<typeof hasFeature>[0] & Partial<Profile>;

export function welcomeSteps(p: P): TourStep[] {
  const on = (f: Parameters<typeof hasFeature>[1]) => hasFeature(p, f);
  const tools = toolsFor(p);
  const steps: (TourStep | false)[] = [
    {
      key: "welcome",
      title: "Welcome to TYPERFORMANCE",
      body: "This app helps your coach plan around how you're really training and recovering. This quick tour takes about a minute. You can skip it any time.",
    },
    on("checkin") && {
      key: "log",
      title: "Log every session",
      body: "After training, tap This week → Log training. Pick the discipline, how long it went and how hard it felt. It takes about 20 seconds.",
    },
    on("checkin") && {
      key: "rpe",
      title: "How hard was it? (RPE)",
      body: "Rate the whole session from 1 (very easy) to 10 (max effort), not just your hardest round. Be honest: it's how your coach spots when you need a lighter week.",
    },
    on("checkin") && {
      key: "checkin",
      title: "Finish your week",
      body: "At the end of each week, submit your check-in: sleep, soreness, stress, mood and (if you like) bodyweight. A reminder shows on your home screen if you miss one.",
    },
    on("testing") && {
      key: "testing",
      title: "Testing",
      body: "Each test has a video and steps. Do it, enter your best result, and see where you sit against Bronze, Silver and Gold standards.",
    },
    tools.length > 0 && {
      key: "tools",
      title: "Training Tools",
      body: `Calculators and guides for your training: ${tools.map((t) => t.title).join(", ")}.`,
    },
    on("fights") && {
      key: "fights",
      title: "Competition Tracker",
      body: "Add your next fight to see a countdown, then log the result and rounds afterwards.",
    },
    on("mobility") && {
      key: "mobility",
      title: "Mobility",
      body: "After your coach screens your range of motion, your results show here against healthy norms.",
    },
    {
      key: "done",
      title: "You're set",
      body: "Stuck on something? The FAQ on your home screen has quick answers. You can replay this tour any time from your profile.",
    },
  ];
  return steps.filter((s): s is TourStep => !!s);
}

/** One-time tip at the top of each feature page. */
export const TIPS: Record<string, { title: string; body: string }> = {
  log: {
    title: "Logging a session",
    body: "Pick the day, discipline and what you did, then duration and RPE. Start time is the last box before Save. Load = RPE × minutes, worked out for you.",
  },
  testing: {
    title: "How testing works",
    body: "Open a test, watch the video, follow the steps, then enter your best result. Your latest result shows its medal; tap a test to see all your results.",
  },
  calculator: {
    title: "1RM Calculator",
    body: "Enter a weight and how many clean reps you got (1–10). It estimates your 1RM and shows the load for every percentage. Save it to track progress.",
  },
  mas: {
    title: "MAS Calculator",
    body: "Pick your machine, enter your 5-minute test result, then choose the rep length and percentage your coach set. It gives you the distance or pace to hit.",
  },
  rpe: {
    title: "RPE & RIR Chart",
    body: "RPE 8 means 2 reps left in the tank. Use the tabs to find the weight for a set (reps + RPE) or estimate your 1RM from a set you've done.",
  },
  hr: {
    title: "HR Zones",
    body: "Enter your age, plus your max and resting heart rate if you know them, to get your zones. Each zone shows the effort it should feel like.",
  },
  standards: {
    title: "Strength Standards",
    body: "Your latest results against Bronze, Silver and Gold. Aim for the next medal on one or two lifts at a time, not all of them.",
  },
  nutrition: {
    title: "Nutrition Guide",
    body: "Enter your bodyweight and pick what today looks like. You'll get daily carbs, protein and fat, plus a sample day. It's for maintaining weight, not cutting.",
  },
  mobility: {
    title: "Mobility",
    body: "Green means you're within the healthy norm; amber means below it or a big left/right gap. Your coach uses this to pick your mobility work.",
  },
  fights: {
    title: "Competition Tracker",
    body: "Log each fight's result and rounds after it happens. Your planned fights show as a countdown on your home screen.",
  },
};

export type TipKey = keyof typeof TIPS;

export const tipSeen = (p: Partial<Profile> | null, key: string) =>
  !!p?.tips_seen?.includes(key);
