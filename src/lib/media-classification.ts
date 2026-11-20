export type StrictContentType = "post" | "reel" | "video" | "collab";

export const MAX_REEL_DURATION_SECONDS = 90;

export function classifyUpload(
  file: Pick<File, "type">,
  width: number,
  height: number,
  durationSec: number,
): "post" | "reel" | "video" {
  if (!file.type.startsWith("video/")) return "post";
  const isVertical = height > width && width > 0 && height > 0;
  return isVertical && Number.isFinite(durationSec) &&
    durationSec >= 0 && durationSec <= MAX_REEL_DURATION_SECONDS
    ? "reel"
    : "video";
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

export function aspectRatioLabel(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const divisor = gcd(width, height);
  return `${Math.round(width) / divisor}:${Math.round(height) / divisor}`;
}

export function strictContentTypeFromLegacy(
  tags: string[] | null | undefined,
  mediaType: string | null | undefined,
): StrictContentType {
  const normalized = (tags ?? []).map((tag) => tag.trim().toLowerCase());
  if (normalized.some((tag) => ["nx-type-collab", "collab"].includes(tag))) return "collab";
  if (normalized.some((tag) => ["nx-type-reel", "reel", "short"].includes(tag))) return "reel";
  if (normalized.includes("nx-type-video")) return "video";
  if (mediaType?.startsWith("video/")) return "video";
  return "post";
}
