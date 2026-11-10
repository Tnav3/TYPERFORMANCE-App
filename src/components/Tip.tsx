import type { Profile } from "@/lib/types";
import { TIPS, tipSeen } from "@/lib/tutorial";
import { FirstTimeTip } from "./FirstTimeTip";

/** Server helper: the feature tip, for athletes who haven't dismissed it. */
export function Tip({
  profile,
  tipKey,
}: {
  profile: Partial<Profile> | null;
  tipKey: keyof typeof TIPS;
}) {
  if (!profile || profile.role !== "athlete" || tipSeen(profile, tipKey))
    return null;
  const t = TIPS[tipKey];
  return <FirstTimeTip tipKey={tipKey} title={t.title} body={t.body} />;
}
