"use server";
import { revalidatePath } from "next/cache";
import { requireState } from "@/lib/session";

/** Client chooses whether their player card shows on the leaderboard. */
export async function setCardOnBoard(fd: FormData) {
  const { supabase, viewAs } = await requireState(["athlete"]);
  if (viewAs) return;
  await supabase.rpc("set_card_on_board", { p_on: fd.get("on") === "true" });
  revalidatePath("/trophies");
  revalidatePath("/trophies/leaderboard");
}
