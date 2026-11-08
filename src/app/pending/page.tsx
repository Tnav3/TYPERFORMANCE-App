import Link from "next/link";
import { requireState } from "@/lib/session";
import { Card, Logo, Screen, SignOutButton, Wordmark } from "@/components/ui";

export default async function PendingPage() {
  const { profile } = await requireState(["pending"]);
  const first = profile.full_name?.split(" ")[0];
  return (
    <Screen>
      <div className="mb-8 mt-6">
        <Logo size={72} />
        <div className="mt-3">
          <Wordmark />
        </div>
      </div>
      <Card className="text-center">
        <h1 className="mb-2 text-xl font-black uppercase">You&apos;re in the queue{first ? `, ${first}` : ""}</h1>
        <p className="text-muted">
          Your coach needs to approve your account before you can start logging. You&apos;ll be able to log in as
          normal once that&apos;s done.
        </p>
      </Card>
      <div className="mt-6 flex items-center justify-between">
        {profile.role === "athlete" ? (
          <Link href="/profile" className="text-sm text-muted underline underline-offset-4">
            Edit my profile
          </Link>
        ) : (
          <span />
        )}
        <SignOutButton />
      </div>
    </Screen>
  );
}
