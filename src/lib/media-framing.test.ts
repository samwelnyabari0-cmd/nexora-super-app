import { describe, expect, it } from "vitest";
import {
  MEDIA_FRAME_RATIOS,
  getFrameAspectRatio,
  normalizeMediaFraming,
} from "./media-framing";

describe("media framing", () => {
  it("offers the supported framing presets", () => {
    expect(MEDIA_FRAME_RATIOS.map((frame) => frame.value)).toEqual([
      "original", "1:1", "4:5", "16:9", "9:16",
    ]);
  });

  it("keeps original media dimensions when Original is selected", () => {
    expect(getFrameAspectRatio("original", 9 / 16)).toBeCloseTo(9 / 16);
    expect(getFrameAspectRatio("original", 16 / 9)).toBeCloseTo(16 / 9);
  });

  it("maps fixed presets to their intended ratios", () => {
    expect(getFrameAspectRatio("1:1", 16 / 9)).toBe(1);
    expect(getFrameAspectRatio("4:5", 16 / 9)).toBe(4 / 5);
    expect(getFrameAspectRatio("16:9", 4 / 5)).toBe(16 / 9);
    expect(getFrameAspectRatio("9:16", 4 / 5)).toBe(9 / 16);
  });

  it("clamps unsafe focal and zoom values to supported bounds", () => {
    expect(normalizeMediaFraming({ focalX: -10, focalY: 140, zoom: 8 })).toEqual({
      focalX: 0, focalY: 100, zoom: 3,
    });
  });

  it("uses safe defaults for invalid metadata", () => {
    expect(normalizeMediaFraming({ focalX: Number.NaN, focalY: undefined, zoom: 0 })).toEqual({
      focalX: 50, focalY: 50, zoom: 1,
    });
  });
});
