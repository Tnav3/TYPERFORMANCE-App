"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, friendlyAuthError } from "@/components/AuthShell";
import { Alert, Button, Field, Input } from "@/components/ui";

// Reached from the reset email link (the link signs the user in first).
export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== String(fd.get("confirm"))) return setError("Passwords don't match.");
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(friendlyAuthError(error.message));
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthShell title="Choose a new password">
      {error && <Alert>{error}</Alert>}
      <form onSubmit={onSubmit} noValidate>
        <Field label="New password" hint="At least 8 characters">
          <Input name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Confirm new password">
          <Input name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </Button>
      </form>
    </AuthShell>
  );
}
