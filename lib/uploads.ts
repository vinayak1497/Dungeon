// Shared upload validation + classification (safe to import anywhere).
// Server routes enforce these; client uses them for early feedback.

export const MAX_FILE_MB = 50;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// Study-relevant formats + images + audio. Executables are never accepted.
const ALLOWED_EXT = new Set([
  "pdf",
  "ppt", "pptx", "pps", "ppsx", "odp",
  "doc", "docx", "odt", "rtf", "txt", "md", "csv", "tsv",
  "xls", "xlsx", "ods",
  "png", "jpg", "jpeg", "webp", "gif", "svg", "heic",
  "mp3", "wav", "m4a", "ogg", "flac", "mp4", "webm", "mov",
  "zip"
]);

const BLOCKED_EXT = new Set([
  "exe", "msi", "bat", "cmd", "sh", "ps1", "com", "scr", "jar", "apk", "dmg"
]);

export type ResourceKind =
  | "pdf" | "slides" | "doc" | "sheet" | "image" | "audio" | "video" | "text" | "archive" | "other";

export function extOf(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop()! : "";
}

export function kindOf(ext: string, mime = ""): ResourceKind {
  if (ext === "pdf") return "pdf";
  if (["ppt", "pptx", "pps", "ppsx", "odp"].includes(ext)) return "slides";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "doc";
  if (["xls", "xlsx", "ods", "csv", "tsv"].includes(ext)) return "sheet";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "heic"].includes(ext) || mime.startsWith("image/")) return "image";
  if (["mp3", "wav", "m4a", "ogg", "flac"].includes(ext) || mime.startsWith("audio/")) return "audio";
  if (["mp4", "webm", "mov"].includes(ext) || mime.startsWith("video/")) return "video";
  if (["txt", "md"].includes(ext) || mime.startsWith("text/")) return "text";
  if (ext === "zip") return "archive";
  return "other";
}

export function validateFile(name: string, size: number): string | null {
  const ext = extOf(name);
  if (!ext) return "File needs an extension (e.g. notes.pdf).";
  if (BLOCKED_EXT.has(ext)) return `“.${ext}” files are blocked for safety.`;
  if (!ALLOWED_EXT.has(ext)) return `“.${ext}” is not supported yet.`;
  if (size <= 0) return "File is empty.";
  if (size > MAX_FILE_BYTES) return `File exceeds ${MAX_FILE_MB} MB.`;
  return null;
}

export function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
