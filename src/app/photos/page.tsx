import { requireFeature } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { PhotoUploader } from "@/components/PhotoUploader";
import { PhotoGallery } from "@/components/PhotoGallery";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const { supabase, user } = await requireFeature(["athlete"], "photos");
  return (
    <Screen>
      <BackLink href="/more" label="More" />
      <Heading sub="Private: only you and your coach can see these. Same spot, same light, same time of day each time.">Progress photos</Heading>
      <Card className="mb-6">
        <PhotoUploader userId={user!.id} today={todayISO()} />
      </Card>
      <PhotoGallery supabase={supabase} athleteId={user!.id} back="/photos" />
    </Screen>
  );
}
