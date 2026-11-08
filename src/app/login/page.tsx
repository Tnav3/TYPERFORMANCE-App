"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, friendlyAuthError } from "@/components/AuthShell";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(fd.get("email")).trim().toLowerCase(),
      password: String(fd.get("password")),
    });
    if (error) {
      setError(friendlyAuthError(error.message));
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthShell title="Log in">
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
        <Field label="Password">
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <div className="mt-6 flex justify-between text-sm text-muted">
        <Link href="/forgot-password" className="underline underline-offset-4">
          Forgot password?
        </Link>
        <Link href="/signup" className="underline underline-offset-4">
          New athlete? Sign up
        </Link>
      </div>
    </AuthShell>
  );
}
