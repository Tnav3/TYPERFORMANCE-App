/* eslint-disable @next/next/no-img-element */
import { avatarUrl, initials } from "@/lib/avatar";

const SIZES = { sm: "h-10 w-10 text-sm", md: "h-11 w-11 text-sm", lg: "h-20 w-20 text-2xl" };

export function Avatar({ name, path, size = "md", tone = "solid" }: { name: string; path?: string | null; size?: keyof typeof SIZES; tone?: "solid" | "soft" }) {
  const url = avatarUrl(path);
  const cls = `${SIZES[size]} shrink-0 rounded-full`;
  if (url) return <img src={url} alt="" className={`${cls} object-cover`} loading="lazy" />;
  return (
    <span className={`${cls} flex items-center justify-center font-black ${tone === "solid" ? "bg-brand text-white" : "bg-brand/15 text-brand"}`} aria-hidden>
      {initials(name)}
    </span>
  );
}
