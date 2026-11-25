// "What's new": add an entry at the top for every release. Keep each line short and in plain words.
export interface Release {
  version: string;
  date: string; // ISO
  items: { who: "all" | "client" | "coach"; text: string }[];
}
export const CHANGELOG: Release[] = [
  {
    version: "0.9.0",
    date: "2026-11-25",
    items: [
      { who: "client", text: "Log band tension (Light to X-Heavy) and Keiser resistance + peak watts." },
      { who: "client", text: "Logging is quicker: empty boxes fill from your plan or last session, plus a Log all button." },
      { who: "client", text: "Team feed on Home: see when your group trains (if your coach turns it on)." },
      { who: "coach", text: "Faster builder: smart exercise search, one-line sets and reps, paste a whole session, loading schemes." },
      { who: "coach", text: "Keep in mind panel (injuries, fights, notes) while programming." },
      { who: "client", text: "New welcome tour for how the app works now, with how-to clips." },
      { who: "client", text: "Trophy cabinet in More: every badge, plus progress to the next one." },
      { who: "client", text: "A daily quote on Home from Ali, Tyson, Jordan, Kobe and more." },
      { who: "client", text: "Fight camp mode: countdown, camp phase and your weight-make tracker on Home." },
      { who: "client", text: "Your meal plan from your coach: training and rest days, shopping list, print to PDF." },
      { who: "coach", text: "Meal library and meal plan builder with targets, live macro totals and publish." },
      { who: "client", text: "Swap an exercise mid-workout and pick from similar ones." },
      { who: "client", text: "Rate the session from 1 to 10 at the end of every workout." },
      { who: "client", text: "Move a workout to another day, or add your own." },
      { who: "client", text: "Send photos, videos and voice messages to your coach." },
      { who: "client", text: "See the equipment you'll need before you start." },
      { who: "client", text: "Book your catch-up call or session from the home screen." },
      { who: "coach", text: "Program folders, client blocks, imports and automations." },
      { who: "coach", text: "Draw on client videos to give technique feedback." },
      { who: "all", text: "Report a problem or idea from the More menu." },
    ],
  },
];
export const latestFor = (who: "client" | "coach") => CHANGELOG.map((r) => ({ ...r, items: r.items.filter((i) => i.who === "all" || i.who === who) })).filter((r) => r.items.length);
