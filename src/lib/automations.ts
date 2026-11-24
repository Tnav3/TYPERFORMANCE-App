// Coach automation rules: labels, plain-English summaries and starter templates. Pure.
export type Trigger = "missed_sessions" | "inactive_days" | "low_readiness" | "program_ending" | "bodyweight_gap" | "birthday" | "fight_done" | "program_complete" | "new_pb" | "target_weight";
export type Audience = "client" | "coach";

export const TRIGGERS: Record<Trigger, { label: string; unit: string; min: number; max: number; def: number }> = {
  missed_sessions: { label: "Missed sessions", unit: "missed in the last 7 days", min: 1, max: 7, def: 2 },
  inactive_days: { label: "Gone quiet", unit: "days without a finished workout", min: 2, max: 30, def: 5 },
  low_readiness: { label: "Low readiness", unit: "readiness score below (0–100)", min: 10, max: 90, def: 50 },
  program_ending: { label: "Program ending", unit: "days until their last planned workout", min: 1, max: 21, def: 7 },
  bodyweight_gap: { label: "No weigh-in", unit: "days since their last weigh-in", min: 3, max: 60, def: 14 },
  birthday: { label: "Birthday", unit: "on the day (number not used)", min: 0, max: 0, def: 0 },
  fight_done: { label: "After a fight", unit: "days after the fight date", min: 0, max: 30, def: 1 },
  program_complete: { label: "Program finished", unit: "days after their last planned workout", min: 0, max: 14, def: 1 },
  new_pb: { label: "New PB", unit: "checked the morning after (number not used)", min: 0, max: 0, def: 0 },
  target_weight: { label: "Target weight reached", unit: "set the target on their profile (number not used)", min: 0, max: 0, def: 0 },
};
/** Triggers with no number to set */
export const NO_NUMBER: Trigger[] = ["birthday", "new_pb", "target_weight"];

export function summary(t: Trigger, n: number, audience: Audience, form?: string | null): string {
  const when =
    t === "missed_sessions" ? `misses ${n} session${n === 1 ? "" : "s"} in a week`
    : t === "inactive_days" ? `hasn't finished a workout in ${n} days`
    : t === "low_readiness" ? `checks in with readiness under ${n}`
    : t === "program_ending" ? `has ${n} day${n === 1 ? "" : "s"} or less left on their program`
    : t === "birthday" ? "has a birthday"
    : t === "new_pb" ? "sets a new PB"
    : t === "target_weight" ? "reaches their target weight"
    : t === "fight_done" ? (n === 0 ? "has a fight today" : `fought ${n} day${n === 1 ? "" : "s"} ago`)
    : t === "program_complete" ? (n === 0 ? "finishes their program today" : `finished their program ${n} day${n === 1 ? "" : "s"} ago`)
    : `hasn't weighed in for ${n} days`;
  return `When a client ${when} → ${audience === "client" ? "send them a message from you" : "tell you"}${form ? ` + send “${form}”` : ""}`;
}

export const TEMPLATES: { name: string; trigger: Trigger; threshold: number; audience: Audience; body: string; cooldown: number }[] = [
  { name: "Missed 2 sessions", trigger: "missed_sessions", threshold: 2, audience: "client", cooldown: 7, body: "Hey {first_name}, noticed a couple of sessions slipped this week. All good? Let me know if we need to move things around." },
  { name: "Gone quiet 5 days", trigger: "inactive_days", threshold: 5, audience: "coach", cooldown: 7, body: "Check in with this client." },
  { name: "Low readiness", trigger: "low_readiness", threshold: 45, audience: "client", cooldown: 3, body: "Hey {first_name}, your readiness is low today. Keep the session but drop the top sets by 10% and focus on quality. Shout if anything's sore." },
  { name: "Program ending", trigger: "program_ending", threshold: 7, audience: "coach", cooldown: 21, body: "Write their next block." },
  { name: "Happy birthday", trigger: "birthday", threshold: 0, audience: "client", cooldown: 300, body: "Happy birthday {first_name}! Have a great day. Enjoy it, you've earned it." },
  { name: "Post-fight check-in", trigger: "fight_done", threshold: 1, audience: "client", cooldown: 14, body: "Hey {first_name}, proud of the work you put in for this one. Take a few days, then let's debrief. When you're ready, fill in the reflection so we can plan what's next." },
  { name: "Program finished", trigger: "program_complete", threshold: 1, audience: "client", cooldown: 21, body: "Hey {first_name}, that's your block done. Great work. I'll have your next one ready soon. How did it feel overall?" },
  { name: "New PB", trigger: "new_pb", threshold: 0, audience: "client", cooldown: 3, body: "New PB yesterday {first_name}! That's the work paying off. Keep stacking it." },
  { name: "Target weight reached", trigger: "target_weight", threshold: 0, audience: "client", cooldown: 60, body: "You've hit your target weight {first_name}. Massive effort. Let's talk about what's next." },
  { name: "Weigh-in reminder", trigger: "bodyweight_gap", threshold: 14, audience: "client", cooldown: 7, body: "Hey {first_name}, jump on the scales this week and log your weight so we can keep an eye on the trend." },
];

export function clampThreshold(t: Trigger, n: number): number {
  const m = TRIGGERS[t];
  return Math.min(m.max, Math.max(m.min, Math.round(Number.isFinite(n) ? n : m.def)));
}
