import { describe, expect, it } from "vitest";
import { getDominantColorFromPixels } from "./media-poster";

describe("getDominantColorFromPixels", () => {
  it("returns the average visible pixel color as hex", () => {
    expect(getDominantColorFromPixels(new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 0, 255, 255,
    ]))).toBe("#800080");
  });

  it("ignores transparent pixels and falls back for empty data", () => {
    expect(getDominantColorFromPixels(new Uint8ClampedArray([255, 255, 255, 0]))).toBe("#171717");
  });
});
