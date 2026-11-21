export type MediaFrameRatio = "original" | "1:1" | "4:5" | "16:9" | "9:16";

export const MEDIA_FRAME_RATIOS: ReadonlyArray<{ value: MediaFrameRatio; label: string }> = [
  { value: "original", label: "Original" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

const FIXED_RATIOS: Record<Exclude<MediaFrameRatio, "original">, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
};

export function getFrameAspectRatio(frame: MediaFrameRatio, originalRatio: number | null | undefined): number {
  if (frame !== "original") return FIXED_RATIOS[frame];
  return typeof originalRatio === "number" && Number.isFinite(originalRatio) && originalRatio > 0
    ? originalRatio
    : 1;
}

export function normalizeMediaFraming(input: {
  focalX?: number | null;
  focalY?: number | null;
  zoom?: number | null;
}): { focalX: number; focalY: number; zoom: number } {
  const clamp = (value: number | null | undefined, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;

  return {
    focalX: clamp(input.focalX, 50, 0, 100),
    focalY: clamp(input.focalY, 50, 0, 100),
    zoom: clamp(input.zoom, 1, 1, 3),
  };
}

export function getMediaAspectRatioValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const [width, height] = value.split(":").map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return width / height;
}
