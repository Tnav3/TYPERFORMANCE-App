import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/session";
import { gateState, HOME_FOR } from "@/lib/gate";

// The app's front door: sends everyone to the right screen.
export default async function Home() {
  const { profile } = await getSessionProfile();
  redirect(HOME_FOR[gateState(profile)]);
}
