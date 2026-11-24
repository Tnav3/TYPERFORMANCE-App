import { cookies } from "next/headers";
import { VIEW_AS_COOKIE } from "@/lib/view-as";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/session";
import { gateState, HOME_FOR } from "@/lib/gate";

// The app's front door: sends everyone to the right screen.
export default async function Home() {
  const { profile } = await getSessionProfile();
  const state = gateState(profile);
  // Coach viewing as a client: Home means the client's home
  if (state === "coach" && (await cookies()).get(VIEW_AS_COOKIE)?.value) redirect("/athlete");
  redirect(HOME_FOR[state]);
}
