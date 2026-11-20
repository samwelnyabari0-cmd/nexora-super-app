import { describe, expect, it, vi } from "vitest";
import {
  getCurrentLocation,
  isValidLocation,
  locationExpiryAt,
  locationShareStatus,
  openStreetMapUrl,
  shouldPublishLocation,
} from "./location-sharing";

describe("chat location sharing rules", () => {
  it("accepts only valid geographic coordinates", () => {
    expect(isValidLocation(-1.2864, 36.8172)).toBe(true);
    expect(isValidLocation(91, 0)).toBe(false);
    expect(isValidLocation(0, 181)).toBe(false);
    expect(isValidLocation(Number.NaN, 0)).toBe(false);
  });

  it("supports only 15-minute and 60-minute live sessions", () => {
    expect(locationExpiryAt(15, 1_000)).toBe(new Date(901_000).toISOString());
    expect(locationExpiryAt(60, 1_000)).toBe(new Date(3_601_000).toISOString());
    expect(() => locationExpiryAt(30, 1_000)).toThrow();
  });

  it("never treats stopped or expired sessions as live", () => {
    const now = Date.parse("2026-11-20T12:00:00.000Z");
    expect(locationShareStatus({
      expiresAt: "2026-11-20T13:00:00.000Z",
      stoppedAt: "2026-11-20T11:59:00.000Z",
      lastUpdatedAt: "2026-11-20T11:59:00.000Z",
    }, now)).toBe("stopped");
    expect(locationShareStatus({
      expiresAt: "2026-11-20T11:59:00.000Z",
      stoppedAt: null,
      lastUpdatedAt: "2026-11-20T11:58:00.000Z",
    }, now)).toBe("expired");
  });

  it("labels old updates stale instead of live", () => {
    const now = Date.parse("2026-11-20T12:00:00.000Z");
    expect(locationShareStatus({
      expiresAt: "2026-11-20T13:00:00.000Z",
      stoppedAt: null,
      lastUpdatedAt: "2026-11-20T11:58:00.000Z",
    }, now)).toBe("stale");
  });

  it("throttles live location writes to at least 10 seconds", () => {
    expect(shouldPublishLocation(20_000, 29_999)).toBe(false);
    expect(shouldPublishLocation(20_000, 30_000)).toBe(true);
  });

  it("creates OpenStreetMap links only for valid coordinates", () => {
    expect(openStreetMapUrl(-1.2864, 36.8172)).toContain("openstreetmap.org");
    expect(openStreetMapUrl(100, 0)).toBeNull();
  });

  it("requests the browser location only when explicitly called", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: -1.28, longitude: 36.81, accuracy: 12 } as GeolocationCoordinates,
        timestamp: 1_000,
      } as GeolocationPosition);
    });
    const geolocation = { getCurrentPosition } as unknown as Pick<Geolocation, "getCurrentPosition">;
    expect(getCurrentPosition).not.toHaveBeenCalled();
    const result = await getCurrentLocation(geolocation);
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(result.latitude).toBe(-1.28);
    expect(result.accuracyM).toBe(12);
  });

  it("reports permission denial without exposing a coordinate", async () => {
    const geolocation = {
      getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
    } as Pick<Geolocation, "getCurrentPosition">;
    await expect(getCurrentLocation(geolocation)).rejects.toThrow("Location permission was denied.");
  });
});
