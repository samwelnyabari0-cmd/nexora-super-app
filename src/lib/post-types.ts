import { validateUpload, type UploadAccountTier } from "@/lib/upload-policy";
import { aspectRatioLabel, classifyUpload } from "@/lib/media-classification";

export type ContentType = "reel" | "post" | "carousel" | "video" | "story" | "live" | "ad";

export const CONTENT_TYPES: { id: ContentType; label: string; hint: string; accept: string }[] = [
  { id: "reel", label: "Reel", hint: "Vertical short video, up to 90 seconds", accept: "video/*" },
  { id: "post", label: "Post", hint: "A photo or text update", accept: "image/*,video/*" },
  { id: "carousel", label: "Carousel", hint: "Several photos to swipe through", accept: "image/*" },
  { id: "video", label: "Video", hint: "Horizontal or long-form video", accept: "video/*" },
  { id: "story", label: "Story", hint: "A quick photo or video moment", accept: "image/*,video/*" },
  { id: "live", label: "Live", hint: "Go live right now", accept: "" },
  { id: "ad", label: "Ad", hint: "Sponsored content", accept: "image/*,video/*" },
];

const TAG_PREFIX = "nx-type-";

/** Hidden tags remain for backwards compatibility; content_type is now canonical in Supabase. */
export const typeTag = (type: ContentType) => `${TAG_PREFIX}${type}`;
export const visibleTags = (tags: string[]) => tags.filter((t) => !t.startsWith(TAG_PREFIX));
export function typeFromTags(tags: string[]): ContentType | undefined {
  const found = tags.find((t) => t.startsWith(TAG_PREFIX))?.slice(TAG_PREFIX.length);
  return CONTENT_TYPES.some((c) => c.id === found) ? (found as ContentType) : undefined;
}

export function kindFor(type: ContentType, isVideo: boolean): "short" | "video" | "post" {
  if (type === "reel") return "short";
  if (type === "video") return "video";
  return isVideo ? "video" : "post";
}

const EXT_TYPES: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  "3gp": "video/3gpp", "3g2": "video/3gpp2", mkv: "video/x-matroska", avi: "video/x-msvideo",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", heic: "image/heic", heif: "image/heif", avif: "image/avif",
};

/** Some phones give video files an empty type. Fall back to the file extension. */
export function guessMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? "";
}

export type UploadClassification = {
  contentType: "post" | "reel" | "video";
  aspectRatio: string | null;
  durationSeconds: number | null;
};

type Options = {
  contentType: ContentType;
  tier: UploadAccountTier;
  setError: (message: string) => void;
  setNote: (message: string) => void;
  accept: (url: string, files: File[], type: string, classification: UploadClassification) => void;
};

/** Reads local video metadata before upload so the saved row has a strict media classification. */
export function pickMedia(picked: File[], o: Options) {
  if (!picked[0]) return;
  const files = picked.map((f) => (f.type ? f : new File([f], f.name, { type: guessMime(f) })));
  const f = files[0];
  const problem = validateUpload(f, o.tier);
  if (problem) return o.setError(problem);
  const url = URL.createObjectURL(f);
  o.setNote("");

  const use = (classification: UploadClassification) => {
    o.setError("");
    o.accept(url, files, f.type, classification);
  };

  if (!f.type.startsWith("video/")) {
    return use({ contentType: "post", aspectRatio: null, durationSeconds: null });
  }

  const probe = document.createElement("video");
  probe.preload = "metadata";
  probe.onloadedmetadata = () => {
    const durationSeconds = Number.isFinite(probe.duration) ? Math.ceil(probe.duration) : null;
    const width = probe.videoWidth;
    const height = probe.videoHeight;
    const problem2 = validateUpload(f, o.tier, durationSeconds ?? undefined, width, height);
    if (problem2) {
      URL.revokeObjectURL(url);
      return o.setError(problem2);
    }
    use({
      contentType: classifyUpload(f, width, height, durationSeconds ?? Number.NaN),
      aspectRatio: aspectRatioLabel(width, height),
      durationSeconds,
    });
  };
  probe.onerror = () => {
    o.setNote("Video metadata could not be read. It will be safely classified as a Video.");
    use({ contentType: "video", aspectRatio: null, durationSeconds: null });
  };
  probe.src = url;
}
