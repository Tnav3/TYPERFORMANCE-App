import { requireFeature } from "@/lib/session";
import { NutritionGuide } from "@/components/NutritionGuide";
import { BackLink, Heading, Screen } from "@/components/ui";

export default async function NutritionPage() {
  const { supabase, user, state } = await requireFeature(
    ["athlete", "coach"],
    "nutrition",
  );
  const { data: lastBw } = await supabase
    .from("weekly_checkins")
    .select("bodyweight_kg")
    .eq("athlete_id", user!.id)
    .not("bodyweight_kg", "is", null)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <Screen>
      <BackLink
        href={state === "coach" ? "/" : "/tools"}
        label={state === "coach" ? "Home" : "Training Tools"}
      />
      <Heading sub="How much carbohydrate and protein to aim for, depending on how hard you're training today.">
        Nutrition Guide
      </Heading>
      <NutritionGuide
        defaultBodyweight={
          lastBw?.bodyweight_kg != null ? Number(lastBw.bodyweight_kg) : null
        }
      />
    </Screen>
  );
}
