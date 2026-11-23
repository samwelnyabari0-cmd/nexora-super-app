import { describe, expect, it } from "vitest";
import { formatOfflineBytes, MAX_COMMUTE_ITEM_BYTES, MAX_COMMUTE_PACK_BYTES, MAX_COMMUTE_ITEMS } from "./offline-storage";
import { isLikelyNetworkFailure } from "./offline-messages";

describe("NEXORA offline helpers", () => {
  it("formats local storage sizes clearly", () => {
    expect(formatOfflineBytes(0)).toBe("0 MB");
    expect(formatOfflineBytes(1024)).toBe("1 KB");
    expect(formatOfflineBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("keeps the commute pack within conservative limits", () => {
    expect(MAX_COMMUTE_ITEMS).toBe(15);
    expect(MAX_COMMUTE_ITEM_BYTES).toBe(60 * 1024 * 1024);
    expect(MAX_COMMUTE_PACK_BYTES).toBe(150 * 1024 * 1024);
  });

  it("recognizes dropped connections as retryable", () => {
    expect(isLikelyNetworkFailure(new Error("Failed to fetch"))).toBe(true);
    expect(isLikelyNetworkFailure(new Error("Permission denied"))).toBe(false);
  });
});
