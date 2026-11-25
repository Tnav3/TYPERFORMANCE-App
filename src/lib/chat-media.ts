// Chat attachments: pick the kind, shrink photos before upload, name files safely.
export type AttachmentKind = "image" | "video" | "audio" | "file";
export const MAX_BYTES = 50 * 1024 * 1024; // Supabase per-file cap
export const MAX_VIDEO_SEC = 90;

export function kindFor(mime: string): AttachmentKind | null {
  if (/^image\/(jpeg|png|webp|gif)$/.test(mime)) return "image";
  if (/^video\/(mp4|quicktime|webm)$/.test(mime)) return "video";
  if (/^audio\//.test(mime)) return "audio";
  if (mime === "application/pdf") return "file";
  return null;
}

export function extFor(mime: string, name = ""): string {
  const fromName = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
    "audio/webm": "webm", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/aac": "aac", "audio/x-m4a": "m4a",
    "application/pdf": "pdf",
  };
  return map[mime.split(";")[0]] ?? (fromName && fromName.length <= 5 ? fromName : "bin");
}

export function safeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "").trim().slice(0, 120) || "file";
}

export function fmtBytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** Columns the chat screens load for each message (with reactions). */
export const MESSAGE_COLUMNS =
  "id, athlete_id, sender_id, body, created_at, read_at, announcement, attachment_path, attachment_kind, attachment_name, attachment_size, duration_sec, reply_to, keep, file_id, coach_files(name, path, mime, size), message_reactions(user_id, emoji)";
