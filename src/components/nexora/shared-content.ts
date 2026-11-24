export type SharedContentSource = "posts" | "user_media_posts";
export type SharedContentType = "post" | "reel" | "video";

export type SharedContentReference = {
  source: SharedContentSource;
  contentId: string;
  contentType: SharedContentType;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSharedContentReference(value: unknown): value is SharedContentReference {
  if (!value || typeof value !== "object") return false;
  const ref = value as Record<string, unknown>;
  if (typeof ref.contentId !== "string" || !UUID_PATTERN.test(ref.contentId)) return false;
  if (ref.source !== "posts" && ref.source !== "user_media_posts") return false;
  if (ref.contentType !== "post" && ref.contentType !== "reel" && ref.contentType !== "video") return false;
  return ref.source !== "posts" || ref.contentType === "post";
}

export function canonicalSharedContentPath(
  reference: SharedContentReference,
  creatorId?: string | null,
): string | null {
  if (!isValidSharedContentReference(reference)) return null;
  const id = encodeURIComponent(reference.contentId);
  if (reference.source === "posts") return `/explore?post=${id}`;
  if (reference.contentType === "reel") return `/reels?post=${id}`;
  if (reference.contentType === "video") return `/videos?post=${id}`;
  if (!creatorId || !UUID_PATTERN.test(creatorId)) return null;
  return `/u/${encodeURIComponent(creatorId)}?post=${id}`;
}

export function sharedContentLabel(contentType: SharedContentType): string {
  return contentType === "reel" ? "Reel" : contentType === "video" ? "Video" : "Post";
}
