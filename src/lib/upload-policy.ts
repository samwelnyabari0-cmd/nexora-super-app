export type UploadAccountTier = "personal" | "creator" | "creator_pro" | "studio_vip";
export type UploadFormat = "short" | "feed" | "long_form";

export const UPLOAD_POLICY = {
  personal: { short: 5, feed: 10, long_form: 2, maxBytes: 500 * 1024 ** 2, maxLongSeconds: 10 * 60 },
  creator: { short: 10, feed: 20, long_form: 5, maxBytes: 2 * 1024 ** 3, maxLongSeconds: 30 * 60 },
  creator_pro: { short: 25, feed: 50, long_form: 15, maxBytes: 5 * 1024 ** 3, maxLongSeconds: 60 * 60 },
  studio_vip: { short: Infinity, feed: Infinity, long_form: Infinity, maxBytes: 10 * 1024 ** 3, maxLongSeconds: Infinity },
} as const;

export const DAILY_UPLOAD_LIMIT_MESSAGE = "Daily upload limit reached for your current plan. Upgrade to Nexora Pro or Studio VIP to expand your daily upload caps and server bandwidth.";
export const FILE_SIZE_LIMIT_MESSAGE = "File size exceeds your plan limit. Upgrade your Nexora account to upload higher-resolution videos up to 10 GB.";

export function accountTierFromUser(user: { user_metadata?: Record<string, unknown> } | null | undefined): UploadAccountTier {
  const raw = user?.user_metadata?.account_tier ?? user?.user_metadata?.account_type;
  if (raw === "studio_vip" || raw === "creator_pro" || raw === "creator") return raw;
  return "personal";
}

export function uploadFormat(type: string, durationSeconds?: number): UploadFormat {
  if (type.startsWith("image/")) return "feed";
  return durationSeconds !== undefined && durationSeconds > 60 ? "long_form" : "short";
}

export function validateUpload(file: Pick<File, "size" | "type">, tier: UploadAccountTier, durationSeconds?: number): string | null {
  const limits = UPLOAD_POLICY[tier];
  if (file.size <= 0) return "This file is empty. Choose another file.";
  if (file.size > limits.maxBytes) return FILE_SIZE_LIMIT_MESSAGE;
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return "Choose an image or video.";
  if (file.type.startsWith("video/") && durationSeconds !== undefined) {
    const format = uploadFormat(file.type, durationSeconds);
    if (format === "short" && durationSeconds > 60) return "Shorts must be 60 seconds or shorter. Choose Long-Form Watch for longer videos.";
    if (format === "long_form" && durationSeconds > limits.maxLongSeconds) return `Long-Form Watch videos for your plan can be up to ${Math.round(limits.maxLongSeconds / 60)} minutes.`;
  }
  return null;
}
