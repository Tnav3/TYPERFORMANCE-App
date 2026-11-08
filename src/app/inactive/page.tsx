import { requireState } from "@/lib/session";
import { Card, Logo, Screen, SignOutButton } from "@/components/ui";

export default async function InactivePage() {
  await requireState(["inactive"]);
  return (
    <Screen>
      <div className="mb-8 mt-6">
        <Logo size={72} />
      </div>
      <Card className="text-center">
        <h1 className="mb-2 text-xl font-black uppercase">Account paused</h1>
        <p className="text-muted">
          Your access has been turned off. If you think this is a mistake,
          contact your coach.
        </p>
      </Card>
      <div className="mt-6 text-center">
        <SignOutButton />
      </div>
    </Screen>
  );
}
