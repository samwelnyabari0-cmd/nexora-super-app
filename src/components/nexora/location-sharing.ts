export type ChatLocationPayload = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  capturedAt: string;
};

export type LocationShareStatus = "live" | "stale" | "stopped" | "expired";

export type LocationSessionSnapshot = {
  expiresAt: string;
  stoppedAt: string | null;
  lastUpdatedAt: string;
};

export function isValidLocation(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

export function locationExpiryAt(durationMinutes: number, now = Date.now()): string {
  if (durationMinutes !== 15 && durationMinutes !== 60) {
    throw new Error("Live location can be shared for 15 minutes or 1 hour.");
  }
  return new Date(now + durationMinutes * 60_000).toISOString();
}

export function locationShareStatus(
  session: LocationSessionSnapshot,
  now = Date.now(),
  staleAfterMs = 45_000,
): LocationShareStatus {
  if (session.stoppedAt) return "stopped";
  const expiry = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) return "expired";
  const updated = Date.parse(session.lastUpdatedAt);
  if (!Number.isFinite(updated) || now - updated > staleAfterMs) return "stale";
  return "live";
}

export function shouldPublishLocation(lastPublishedAt: number, now = Date.now(), throttleMs = 10_000) {
  return now - lastPublishedAt >= throttleMs;
}

export function openStreetMapUrl(latitude: number, longitude: number): string | null {
  if (!isValidLocation(latitude, longitude)) return null;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}

export function getCurrentLocation(
  geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined =
    typeof navigator !== "undefined" ? navigator.geolocation : undefined,
): Promise<ChatLocationPayload> {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(new Error("Location is not supported by this browser."));
      return;
    }
    geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!isValidLocation(latitude, longitude)) {
          reject(new Error("The browser returned an invalid location."));
          return;
        }
        resolve({
          latitude,
          longitude,
          accuracyM: Number.isFinite(accuracy) ? accuracy : null,
          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
        });
      },
      (error) => {
        reject(new Error(
          error.code === 1
            ? "Location permission was denied."
            : error.code === 3
              ? "Location request timed out. Please try again."
              : "Your location could not be obtained.",
        ));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  });
}
