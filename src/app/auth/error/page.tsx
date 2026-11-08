import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Alert } from "@/components/ui";

export default function AuthErrorPage() {
  return (
    <AuthShell title="Link didn't work">
      <Alert>This link has expired or was already used. Links only work once and expire after an hour.</Alert>
      <div className="flex flex-col gap-3 text-sm text-muted">
        <Link href="/login" className="underline underline-offset-4">
          Log in
        </Link>
        <Link href="/forgot-password" className="underline underline-offset-4">
          Send a new password reset link
        </Link>
      </div>
    </AuthShell>
  );
}
