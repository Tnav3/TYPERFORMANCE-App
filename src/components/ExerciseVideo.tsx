// Watch an exercise demo inside the app. YouTube/Vimeo play embedded;
// other links open in a new tab.
import { PlayCircle } from "lucide-react";
import { embedUrl } from "@/lib/programming/video";

export function ExerciseVideo({ url, name }: { url: string | null; name: string }) {
  if (!url) return null;
  const src = embedUrl(url);
  if (!src)
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand"
      >
        <PlayCircle size={18} /> Watch demo
      </a>
    );
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-brand">
        <PlayCircle size={18} />
        <span className="group-open:hidden">Watch demo</span>
        <span className="hidden group-open:inline">Hide demo</span>
      </summary>
      <div className="mt-1 aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={src}
          title={`${name} demo`}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full"
        />
      </div>
    </details>
  );
}
