// Decides where a user belongs based on their profile.
// Pure function: no database calls, so it can be unit-tested.
import { CONSENT_VERSION } from "./consent";
import type { Profile } from "./types";

export type GateState =
  | "signed_out"
  | "inactive"
  | "needs_consent"
  | "needs_profile"
  | "pending"
  | "athlete"
  | "coach";

export function gateState(
  p: Pick<
    Profile,
    "role" | "status" | "consent_version" | "profile_completed_at"
  > | null,
): GateState {
  if (!p) return "signed_out";
  if (p.status === "inactive") return "inactive";
  if (p.role === "coach") return p.status === "active" ? "coach" : "pending";
  if (p.consent_version !== CONSENT_VERSION) return "needs_consent";
  if (!p.profile_completed_at) return "needs_profile";
  if (p.status === "pending") return "pending";
  return "athlete";
}

export const HOME_FOR: Record<GateState, string> = {
  signed_out: "/login",
  inactive: "/inactive",
  needs_consent: "/onboarding/consent",
  needs_profile: "/onboarding/profile",
  pending: "/pending",
  athlete: "/athlete",
  coach: "/coach",
};
