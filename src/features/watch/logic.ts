export type WatchCategory = "All" | "Documentary" | "Series" | "Food";
export type WatchStatus = "pending" | "processing" | "ready" | "unavailable";

export function normalizeWatchCategory(value: unknown): WatchCategory {
  return value === "Documentary" || value === "Series" || value === "Food" ? value : "All";
}

export function matchesWatchCategory(
  title: { category: string; content_type: "single" | "series" },
  category: WatchCategory,
): boolean {
  if (category === "All") return true;
  if (category === "Series") return title.content_type === "series" || title.category === "Series";
  return title.category.toLowerCase() === category.toLowerCase();
}

export function resolveWatchStatus(
  status: string | null | undefined,
  manifestUrl: string | null | undefined,
): WatchStatus {
  if (status === "ready" && manifestUrl?.trim()) return "ready";
  if (status === "processing") return "processing";
  if (status === "pending") return "pending";
  return "unavailable";
}

export function watchProgressPercent(progressSeconds: number, totalSeconds: number): number {
  if (!Number.isFinite(progressSeconds) || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, progressSeconds / totalSeconds * 100)));
}

export function clampWatchProgress(progressSeconds: number, totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  if (!Number.isFinite(progressSeconds)) return 0;
  return Math.floor(Math.min(totalSeconds, Math.max(0, progressSeconds)));
}

export function canOpenWatchTitle(title: {
  isDemo: boolean;
  contentType: "single" | "series";
  status: WatchStatus;
  manifestUrl: string | null;
}): boolean {
  if (title.isDemo) return false;
  if (title.contentType === "series") return true;
  return title.status === "ready" && Boolean(title.manifestUrl?.trim());
}

export function shouldSaveWatchProgress(
  positionSeconds: number,
  lastSavedSeconds: number,
  totalSeconds: number,
  force = false,
): boolean {
  if (![positionSeconds, lastSavedSeconds, totalSeconds].every(Number.isFinite) || totalSeconds <= 0) {
    return false;
  }
  if (force) return true;
  return !(Math.abs(positionSeconds - lastSavedSeconds) < 3 && positionSeconds < totalSeconds - 2);
}
