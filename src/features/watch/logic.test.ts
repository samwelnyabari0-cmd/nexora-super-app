import { describe, expect, it } from "vitest";
import {
  canOpenWatchTitle,
  clampWatchProgress,
  matchesWatchCategory,
  normalizeWatchCategory,
  resolveWatchStatus,
  watchProgressPercent,
} from "./logic";

describe("Watch domain rules", () => {
  it("allows episode selection for live series even when the series manifest is pending", () => {
    expect(canOpenWatchTitle({
      isDemo: false,
      contentType: "series",
      status: "pending",
      manifestUrl: null,
    })).toBe(true);
  });

  it("requires a ready manifest for single titles and blocks demo entries", () => {
    expect(canOpenWatchTitle({
      isDemo: false,
      contentType: "single",
      status: "pending",
      manifestUrl: null,
    })).toBe(false);
    expect(canOpenWatchTitle({
      isDemo: false,
      contentType: "single",
      status: "ready",
      manifestUrl: "https://cdn.example/master.m3u8",
    })).toBe(true);
    expect(canOpenWatchTitle({
      isDemo: true,
      contentType: "series",
      status: "ready",
      manifestUrl: "https://cdn.example/master.m3u8",
    })).toBe(false);
  });

  it("normalizes unknown category query values to All", () => {
    expect(normalizeWatchCategory("Food")).toBe("Food");
    expect(normalizeWatchCategory("premium")).toBe("All");
  });

  it("matches series by content type and other categories by category", () => {
    expect(matchesWatchCategory({ category: "Documentary", content_type: "series" }, "Series")).toBe(true);
    expect(matchesWatchCategory({ category: "Food", content_type: "single" }, "Food")).toBe(true);
    expect(matchesWatchCategory({ category: "Music", content_type: "single" }, "Food")).toBe(false);
  });

  it("never treats a missing manifest as ready", () => {
    expect(resolveWatchStatus("ready", null)).toBe("unavailable");
    expect(resolveWatchStatus("ready", " https://cdn.example/master.m3u8 ")).toBe("ready");
    expect(resolveWatchStatus("processing", null)).toBe("processing");
  });

  it("calculates bounded progress percentages", () => {
    expect(watchProgressPercent(25, 100)).toBe(25);
    expect(watchProgressPercent(150, 100)).toBe(100);
    expect(watchProgressPercent(-2, 100)).toBe(0);
    expect(watchProgressPercent(10, 0)).toBe(0);
  });

  it("clamps progress seconds to a valid duration", () => {
    expect(clampWatchProgress(150.8, 100)).toBe(100);
    expect(clampWatchProgress(-5, 100)).toBe(0);
    expect(clampWatchProgress(Number.NaN, 100)).toBe(0);
  });
});
