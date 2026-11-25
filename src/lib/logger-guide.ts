// First-workout guide: one step per real control on the workout screen.
// Steps whose control isn't on screen (no swap, no "last time" yet…) are skipped.
export interface GuideStep {
  target: string; // data-guide value
  title: string;
  body: string;
}

export const LOGGER_GUIDE: GuideStep[] = [
  { target: "set", title: "Your first set", body: "The faded numbers are your target. Type what you actually did. Leave a box empty and it logs the target." },
  { target: "tick", title: "Tick it off", body: "Tap the tick when the set's done. It saves straight away, and if your coach set a rest time the timer starts by itself." },
  { target: "last", title: "Last time", body: "What you did last session on this exercise, so you know what to beat." },
  { target: "howto", title: "How to do it", body: "Demo video, coaching cues and your history for this exercise." },
  { target: "swap", title: "Swap if you need to", body: "Machine taken or something hurts? Swap it for a similar exercise. Your coach sees what you swapped and why." },
  { target: "glossary", title: "Not sure what it means?", body: "Tap the ? to see what AMRAP, tempo, RIR and other terms mean, and how to do them." },
  { target: "timer", title: "Timers", body: "Rest timer, stopwatch, EMOM and Tabata whenever you need one." },
  { target: "next", title: "Move through the session", body: "Next takes you to the next exercise. At the end, tap Wrap up, rate how hard the session was from 1 to 10 and tap Finish workout. Your coach sees it." },
  { target: "view", title: "See everything", body: "Switch between one exercise at a time and the full list. When you're done, scroll to the bottom, rate the session from 1 to 10 and tap Finish workout." },
];

/** Steps whose target exists, in order. "view" is only a fallback when "next" isn't shown. */
export function guideSteps(present: (target: string) => boolean): GuideStep[] {
  const has = LOGGER_GUIDE.filter((s) => present(s.target));
  return has.some((s) => s.target === "next") ? has.filter((s) => s.target !== "view") : has;
}
