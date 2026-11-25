// First-use tutorial: a welcome walkthrough (only for switched-on features)
// and a one-time tip at the top of each feature. Pure: unit-tested.
import { hasFeature } from "./features";
import type { Profile } from "./types";
import { toolsFor } from "./tools";

export interface TourStep {
  key: string;
  title: string;
  body: string;
  video?: string | null;
}

type P = Parameters<typeof hasFeature>[0] & Partial<Profile>;

/** Keys the coach can attach a how-to clip to (see /coach/tour). */
export const TOUR_KEYS = ["welcome", "today", "during", "week", "learn", "chat", "weigh", "meals", "checkin", "testing", "tools", "fights", "trophies", "done"] as const;

export function welcomeSteps(p: P, videos: Record<string, string> = {}): TourStep[] {
  const on = (f: Parameters<typeof hasFeature>[1]) => hasFeature(p, f);
  const tools = toolsFor(p);
  const steps: (TourStep | false)[] = [
    {
      key: "welcome",
      title: "Welcome to TYPERFORMANCE",
      body: "Your training, check-ins and coach in one place. This tour takes about a minute. Skip it any time.",
    },
    on("program") && {
      key: "today",
      title: "Today's session",
      body: "Home shows what's on today. Tap it to start. You'll see what equipment you need before you begin.",
    },
    on("program") && {
      key: "during",
      title: "Logging as you go",
      body: "Tick off each set with the weight and reps you did. Machine taken or something hurts? Tap Swap and pick a similar exercise. At the end, slide 1 to 10 for how hard the whole session was.",
    },
    on("program") && {
      key: "week",
      title: "Your week, your way",
      body: "Need to shuffle? Move a session to another day from the Train tab. Did extra work? Add your own workout so your coach sees it.",
    },
    on("program") && {
      key: "learn",
      title: "What does that mean?",
      body: "Not sure what AMRAP, tempo or RIR means? Tap the ? under the exercise, or open Learn in More to look anything up.",
    },
    on("chat") && {
      key: "chat",
      title: "Message your coach",
      body: "Send texts, photos, voice notes or a quick video of a set for feedback.",
    },
    on("bodyweight") && {
      key: "weigh",
      title: "Weigh-ins",
      body: "Tap the weight box on Home to log your bodyweight. Same time each morning gives the cleanest trend.",
    },
    on("mealplan") && {
      key: "meals",
      title: "Food",
      body: "The fork icon at the bottom has your meal plan and nutrition targets once your coach sets them.",
    },
    on("checkin") && {
      key: "checkin",
      title: "Check-ins",
      body: "When a check-in is due it shows on Home. A couple of minutes, and it's how your coach adjusts your plan.",
    },
    on("testing") && {
      key: "testing",
      title: "Testing",
      body: "Each test has a video and steps. Enter your best result and see where you sit against Bronze, Silver and Gold.",
    },
    tools.length > 0 && {
      key: "tools",
      title: "Training tools",
      body: `In More: ${tools.map((t) => t.title).join(", ")}.`,
    },
    on("fights") && {
      key: "fights",
      title: "Fights",
      body: "Add your next fight and Home switches to fight camp mode: countdown, camp phase and your weight-make tracker.",
    },
    {
      key: "trophies",
      title: "Trophy cabinet",
      body: "Sessions, streaks and PBs earn trophies, and your player card levels up. Tap the trophy at the top of Home.",
    },
    {
      key: "done",
      title: "You're set",
      body: "Stuck? Help is in More, or just message your coach. You can replay this tour from your profile.",
    },
  ];
  return steps.filter((s): s is TourStep => !!s).map((s) => (videos[s.key] ? { ...s, video: videos[s.key] } : s));
}

/** One-time tip at the top of each feature page. */
export const TIPS: Record<string, { title: string; body: string }> = {
  logger: {
    title: "Your first workout",
    body: "A short guide that points at each button the first time a client opens a workout.",
  },
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
