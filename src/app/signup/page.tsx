"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, friendlyAuthError } from "@/components/AuthShell";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    const full_name = String(fd.get("full_name")).trim();
    const email = String(fd.get("email")).trim().toLowerCase();
    const password = String(fd.get("password"));

    if (full_name.length < 2) return setError("Enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email.");
    if (password.length < 8)
      return setError("Password must be at least 8 characters.");

    setBusy(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) return setError(friendlyAuthError(error.message));

    // Email confirmation OFF (recommended — coach approval is the gate): logged in straight away.
    if (data.session) {
      router.replace("/");
      router.refresh();
      return;
    }
    // Email confirmation ON: tell them to check their inbox.
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthShell title="Check your email">
        <Alert tone="ok">
          We sent a confirmation link to <b>{sentTo}</b>. Open it on this phone
          to finish signing up. Check spam if it isn&apos;t there in a few
          minutes.
        </Alert>
        <Link
          href="/login"
          className="text-sm text-muted underline underline-offset-4"
        >
          Back to log in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account">
      {error && <Alert>{error}</Alert>}
      <form onSubmit={onSubmit} noValidate>
        <Field label="Full name">
          <Input name="full_name" autoComplete="name" required />
        </Field>
        <Field label="Email">
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
          />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Sign up"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
