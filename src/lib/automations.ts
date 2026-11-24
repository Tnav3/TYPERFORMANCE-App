// Coach automation rules: labels, plain-English summaries and starter templates. Pure.
export type Trigger = "missed_sessions" | "inactive_days" | "low_readiness" | "program_ending" | "bodyweight_gap";
export type Audience = "client" | "coach";

export const TRIGGERS: Record<Trigger, { label: string; unit: string; min: number; max: number; def: number }> = {
  missed_sessions: { label: "Missed sessions", unit: "missed in the last 7 days", min: 1, max: 7, def: 2 },
  inactive_days: { label: "Gone quiet", unit: "days without a finished workout", min: 2, max: 30, def: 5 },
  low_readiness: { label: "Low readiness", unit: "readiness score below (0–100)", min: 10, max: 90, def: 50 },
  program_ending: { label: "Program ending", unit: "days until their last planned workout", min: 1, max: 21, def: 7 },
  bodyweight_gap: { label: "No weigh-in", unit: "days since their last weigh-in", min: 3, max: 60, def: 14 },
};

export function summary(t: Trigger, n: number, audience: Audience): string {
  const when =
    t === "missed_sessions" ? `misses ${n} session${n === 1 ? "" : "s"} in a week`
    : t === "inactive_days" ? `hasn't finished a workout in ${n} days`
    : t === "low_readiness" ? `checks in with readiness under ${n}`
    : t === "program_ending" ? `has ${n} day${n === 1 ? "" : "s"} or less left on their program`
    : `hasn't weighed in for ${n} days`;
  return `When a client ${when} → ${audience === "client" ? "send them a message from you" : "tell you"}`;
}

export const TEMPLATES: { name: string; trigger: Trigger; threshold: number; audience: Audience; body: string; cooldown: number }[] = [
  { name: "Missed 2 sessions", trigger: "missed_sessions", threshold: 2, audience: "client", cooldown: 7, body: "Hey {first_name}, noticed a couple of sessions slipped this week. All good? Let me know if we need to move things around." },
  { name: "Gone quiet 5 days", trigger: "inactive_days", threshold: 5, audience: "coach", cooldown: 7, body: "Check in with this client." },
  { name: "Low readiness", trigger: "low_readiness", threshold: 45, audience: "client", cooldown: 3, body: "Hey {first_name}, your readiness is low today. Keep the session but drop the top sets by 10% and focus on quality. Shout if anything's sore." },
  { name: "Program ending", trigger: "program_ending", threshold: 7, audience: "coach", cooldown: 21, body: "Write their next block." },
  { name: "Weigh-in reminder", trigger: "bodyweight_gap", threshold: 14, audience: "client", cooldown: 7, body: "Hey {first_name}, jump on the scales this week and log your weight so we can keep an eye on the trend." },
];

export function clampThreshold(t: Trigger, n: number): number {
  const m = TRIGGERS[t];
  return Math.min(m.max, Math.max(m.min, Math.round(Number.isFinite(n) ? n : m.def)));
}
