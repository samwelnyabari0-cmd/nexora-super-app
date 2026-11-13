import { validateUpload, type UploadAccountTier } from "@/lib/upload-policy";

export type ContentType = "reel" | "post" | "carousel" | "video" | "story" | "live" | "ad";

export const CONTENT_TYPES: { id: ContentType; label: string; hint: string; accept: string }[] = [
  { id: "reel", label: "Reel", hint: "Short vertical video, up to 60 seconds", accept: "video/*" },
  { id: "post", label: "Post", hint: "A photo, video or text update", accept: "image/*,video/*" },
  { id: "carousel", label: "Carousel", hint: "Several photos to swipe through", accept: "image/*" },
  { id: "video", label: "Video", hint: "A longer video", accept: "video/*" },
  { id: "story", label: "Story", hint: "A quick photo or video moment", accept: "image/*,video/*" },
  { id: "live", label: "Live", hint: "Go live right now", accept: "" },
  { id: "ad", label: "Ad", hint: "Sponsored content", accept: "image/*,video/*" },
];

const TAG_PREFIX = "nx-type-";

/** The content type is stored as a hidden tag, so no database change is needed. */
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


type Options = {
  contentType: ContentType;
  tier: UploadAccountTier;
  setError: (message: string) => void;
  setNote: (message: string) => void;
  /** Called when a file is accepted. */
  accept: (url: string, files: File[], type: string) => void;
};

/** Checks chosen files and hands the accepted ones back. Videos the browser cannot read still upload. */
export function pickMedia(picked: File[], o: Options) {
  if (!picked[0]) return;
  // Some phones give files an empty type, so work it out from the file name.
  const files = picked.map((f) => (f.type ? f : new File([f], f.name, { type: guessMime(f) })));
  const f = files[0];
  const problem = validateUpload(f, o.tier);
  if (problem) return o.setError(problem);
  const url = URL.createObjectURL(f);
  o.setNote("");
  const use = () => {
    o.setError("");
    o.accept(url, files, f.type);
  };
  if (!f.type.startsWith("video/")) return use();

  const probe = document.createElement("video");
  probe.preload = "metadata";
  probe.onloadedmetadata = () => {
    const problem2 =
      o.contentType === "reel" && probe.duration > 60
        ? "Reels must be 60 seconds or shorter."
        : validateUpload(f, o.tier, probe.duration);
    if (problem2) {
      URL.revokeObjectURL(url);
      return o.setError(problem2);
    }
    use();
  };
  probe.onerror = () => {
    o.setNote("This browser cannot preview this video, but it will still upload.");
    use();
  };
  probe.src = url;
}
