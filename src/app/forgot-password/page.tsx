"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, friendlyAuthError } from "@/components/AuthShell";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email"))
      .trim()
      .toLowerCase();
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    // Supabase returns success for unknown emails (so this never reveals who has
    // an account). Any error here is real: rate limits, network, or the email
    // service failing to send. Show it instead of pretending the link is on its way.
    if (error) {
      if (/sending|smtp|mail/i.test(error.message))
        return setError(
          "We couldn't send the reset email right now. Please try again shortly, or contact your coach.",
        );
      return setError(friendlyAuthError(error.message));
    }
    setSent(true);
  }

  return (
    <AuthShell title="Reset password">
      {sent ? (
        <Alert tone="ok">
          If that email has an account, a reset link is on its way. Check spam
          too.
        </Alert>
      ) : (
        <>
          {error && <Alert>{error}</Alert>}
          <form onSubmit={onSubmit} noValidate>
            <Field label="Email">
              <Input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </>
      )}
      <Link
        href="/login"
        className="mt-6 block text-sm text-muted underline underline-offset-4"
      >
        Back to log in
      </Link>
    </AuthShell>
  );
}
