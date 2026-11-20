import { describe, expect, it } from "vitest";
import { isMessageExpired, messageExpiryDelay } from "./message-expiry";

describe("server-timestamped message expiry display", () => {
  it("keeps messages with expiry Off visible", () => {
    expect(isMessageExpired(null, 10_000)).toBe(false);
    expect(messageExpiryDelay(undefined, 10_000)).toBeNull();
  });

  it("hides messages at or after their authoritative expiry time", () => {
    const expiry = "2026-11-20T12:00:00.000Z";
    const atExpiry = Date.parse(expiry);
    expect(isMessageExpired(expiry, atExpiry - 1)).toBe(false);
    expect(isMessageExpired(expiry, atExpiry)).toBe(true);
    expect(isMessageExpired(expiry, atExpiry + 1)).toBe(true);
  });

  it("returns no timer for invalid timestamps", () => {
    expect(isMessageExpired("not-a-date", 10_000)).toBe(false);
    expect(messageExpiryDelay("not-a-date", 10_000)).toBeNull();
  });
});
