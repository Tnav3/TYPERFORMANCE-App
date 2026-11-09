import Image from "next/image";
import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

export function Logo({ size = 72 }: { size?: number }) {
  return (
    <Image
      src="/logo-mark.png"
      alt="TYPERFORMANCE"
      width={size}
      height={size}
      priority
      className="mx-auto"
    />
  );
}

export function Wordmark() {
  return (
    <p className="text-center text-sm font-black tracking-[0.3em] text-text">
      <span className="text-brand">TY</span>PERFORMANCE
    </p>
  );
}

export function Screen({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main
      className={`mx-auto min-h-dvh w-full px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1.25rem)] ${wide ? "max-w-3xl" : "max-w-md"}`}
    >
      {children}
    </main>
  );
}

export function Heading({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-black uppercase tracking-tight">
        {children}
      </h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-5 ${className}`}
    >
      {children}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: BtnProps) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    ghost: "border border-line bg-surface-2 text-text hover:border-muted",
    danger:
      "border border-brand/60 bg-transparent text-brand hover:bg-brand/10",
  }[variant];
  return (
    <button
      {...props}
      className={`min-h-12 w-full rounded-xl px-4 font-extrabold uppercase tracking-wide transition disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-semibold text-text">
        {label}
      </span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      )}
      {error && <span className="mt-1 block text-sm text-brand">{error}</span>}
    </label>
  );
}

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`${inputCls} ${props.className ?? ""}`} />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${inputCls} appearance-none bg-[length:20px] bg-[right_14px_center] bg-no-repeat pr-11 ${props.className ?? ""}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23a1a1aa'%3E%3Cpath d='M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z'/%3E%3C/svg%3E\")",
        ...props.style,
      }}
    />
  );
}

export function Alert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "info" | "ok";
}) {
  const c = {
    error: "border-brand/50 bg-brand/10 text-text",
    info: "border-line bg-surface-2 text-text",
    ok: "border-ok/50 bg-ok/10 text-text",
  }[tone];
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${c}`}>
      {children}
    </div>
  );
}

export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button className="text-sm text-muted underline underline-offset-4 hover:text-text">
        Sign out
      </button>
    </form>
  );
}

/** Big, thumb-friendly back button (min 48px tall, full-width tap area on the left). */
export function BackLink({
  href,
  label = "Back",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="-ml-2 mb-3 inline-flex min-h-12 items-center gap-2 rounded-xl px-3 pr-5 text-base font-semibold text-muted active:bg-surface-2"
    >
      <span aria-hidden className="text-2xl leading-none">
        ‹
      </span>
      {label}
    </Link>
  );
}

/** Home-screen tile for one app function: icon, big white title, grey description. */
export function FeatureLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group mb-3 flex items-center gap-4 rounded-2xl border border-line bg-surface-2 px-4 py-4 transition-colors hover:border-muted"
    >
      {icon && (
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand"
          aria-hidden
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-lg font-black uppercase leading-tight tracking-tight text-text">
          {title}
        </p>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
      <span
        className="text-xl font-black text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
        aria-hidden
      >
        →
      </span>
    </Link>
  );
}
