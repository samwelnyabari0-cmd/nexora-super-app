import type { Post } from "./data";
export type Attachment = { id: string; name: string; type: string; size: number; url: string };
export function canDiscover(post: Post, muted: string[]) {
  return post.audience !== "private" && !muted.includes(post.creatorId);
}
export function savedIds(saved: Set<string>, collections: Record<string, string[]>) {
  return new Set([...saved, ...Object.values(collections).flat()]);
}
export function validMessage(text: string, attachments: Attachment[]) {
  return (
    Boolean(text.trim() || attachments.length) &&
    attachments.every((a) => a.size > 0 && a.size <= 100 * 1024 * 1024 && Boolean(a.url))
  );
}
export function fileError(file: Pick<File, "size" | "name">): string | null {
  if (file.size === 0) return "This file is empty. Choose another file.";
  // Local previews are intentionally capped to protect mobile memory.
  if (file.size > 100 * 1024 * 1024) return "Choose a file smaller than 100 MB.";
  return null;
}
export function matchesPost(post: Post, query: string) {
  return `${post.caption} ${post.tags.join(" ")} ${post.place ?? ""}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}
export const analyticsDays = [7, 30, 90] as const;
export function sampleAnalytics(days: number) {
  const count = analyticsDays.includes(days as 7 | 30 | 90) ? days : 30;
  const series = Array.from({ length: count }, (_, i) => ({
    day: i + 1,
    views: 700 + ((i * 137) % 850),
    reach: 490 + ((i * 83) % 560),
    engagement: 45 + ((i * 13) % 90),
  }));
  return {
    series,
    views: series.reduce((s, d) => s + d.views, 0),
    reach: series.reduce((s, d) => s + d.reach, 0),
    interactions: series.reduce((s, d) => s + d.engagement, 0),
  };
}
export function microphoneError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone permission denied. Allow microphone access in your browser’s site settings, then try again.";
  if (name === "NotFoundError")
    return "No microphone found. Connect a microphone or attach an audio file.";
  if (name === "NotReadableError")
    return "Your microphone is busy. Close other apps using it and try again.";
  return "Recording could not start. Try again or attach an audio file.";
}
