import type { ReactNode } from "react";
import { Logo, Screen, Wordmark } from "./ui";

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Screen>
      <div className="mb-8 mt-6">
        <Logo size={88} />
        <div className="mt-3">
          <Wordmark />
        </div>
      </div>
      <h1 className="mb-6 text-center text-xl font-black uppercase tracking-tight">{title}</h1>
      {children}
    </Screen>
  );
}

/** Turns Supabase auth errors into plain English. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox (and spam).";
  if (m.includes("already registered") || m.includes("already exists")) return "That email already has an account. Try logging in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a few minutes and try again.";
  if (m.includes("password")) return message;
  if (m.includes("fetch") || m.includes("network")) return "Can't reach the server. Check your connection.";
  // Show the real reason in small print so problems can be diagnosed
  return `Something went wrong. Please try again. (Details: ${message})`;
}
