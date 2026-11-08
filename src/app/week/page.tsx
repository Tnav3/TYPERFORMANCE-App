import { redirect } from "next/navigation";
import { todayISO } from "@/lib/dates";
import { mondayOf } from "@/lib/week";

// Must run on every request, otherwise "this week" is frozen at build time
export const dynamic = "force-dynamic";

// /week → this week
export default function WeekIndex() {
  redirect(`/week/${mondayOf(todayISO())}`);
}
