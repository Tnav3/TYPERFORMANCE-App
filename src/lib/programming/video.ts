// Turns a YouTube or Vimeo link into an embeddable player URL.
// Anything else returns null (the app shows it as a normal link instead).

export function embedUrl(link: string | null | undefined): string | null {
  if (!link) return null;
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  const ytId = (id: string | null | undefined) =>
    id && /^[\w-]{6,20}$/.test(id) ? id : null;

  let id: string | null = null;
  if (host === "youtu.be") id = ytId(u.pathname.slice(1).split("/")[0]);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = ytId(u.searchParams.get("v"));
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/);
      id = ytId(m?.[1]);
    }
  }
  if (id) {
    const start = Number(u.searchParams.get("t")?.replace(/s$/, "") ?? u.searchParams.get("start"));
    const qs = new URLSearchParams({ rel: "0", playsinline: "1", modestbranding: "1" });
    if (Number.isInteger(start) && start > 0) qs.set("start", String(start));
    return `https://www.youtube-nocookie.com/embed/${id}?${qs}`;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:^\/|\/video\/)(\d{5,12})(?:\/([\da-f]{6,20}))?/);
    if (m) {
      const qs = new URLSearchParams({ dnt: "1", playsinline: "1" });
      if (m[2]) qs.set("h", m[2]);
      const h = u.searchParams.get("h");
      if (h && /^[\da-f]{6,20}$/.test(h)) qs.set("h", h);
      return `https://player.vimeo.com/video/${m[1]}?${qs}`;
    }
  }
  return null;
}
