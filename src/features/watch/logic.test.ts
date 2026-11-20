import { describe, expect, it } from "vitest";
import {
  clampWatchProgress,
  matchesWatchCategory,
  normalizeWatchCategory,
  resolveWatchStatus,
  watchProgressPercent,
} from "./logic";

describe("Watch domain rules", () => {
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
