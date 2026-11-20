import { describe, expect, it } from "vitest";
import {
  aspectRatioLabel,
  classifyUpload,
  MAX_REEL_DURATION_SECONDS,
  strictContentTypeFromLegacy,
} from "./media-classification";

describe("classifyUpload", () => {
  it("classifies non-video uploads as posts", () => {
    expect(classifyUpload({ type: "image/jpeg" }, 1080, 1920, 20)).toBe("post");
  });

  it("classifies vertical videos up to and including 90 seconds as Reels", () => {
    expect(classifyUpload({ type: "video/mp4" }, 1080, 1920, MAX_REEL_DURATION_SECONDS)).toBe("reel");
  });

  it("classifies vertical videos longer than 90 seconds as Videos", () => {
    expect(classifyUpload({ type: "video/mp4" }, 1080, 1920, 91)).toBe("video");
  });

  it("classifies horizontal and square videos as Videos", () => {
    expect(classifyUpload({ type: "video/mp4" }, 1920, 1080, 30)).toBe("video");
    expect(classifyUpload({ type: "video/mp4" }, 1080, 1080, 30)).toBe("video");
  });

  it("fails safely to Videos when dimensions are missing", () => {
    expect(classifyUpload({ type: "video/mp4" }, 0, 0, 30)).toBe("video");
  });
});

describe("aspectRatioLabel", () => {
  it("reduces dimensions to a stable ratio", () => {
    expect(aspectRatioLabel(1080, 1920)).toBe("9:16");
    expect(aspectRatioLabel(1920, 1080)).toBe("16:9");
  });

  it("returns null for invalid dimensions", () => {
    expect(aspectRatioLabel(0, 1080)).toBeNull();
  });
});

describe("strictContentTypeFromLegacy", () => {
  it("preserves legacy Reel and Collab tags", () => {
    expect(strictContentTypeFromLegacy(["nx-type-reel"], "video/mp4")).toBe("reel");
    expect(strictContentTypeFromLegacy(["collab"], "image/jpeg")).toBe("collab");
    expect(strictContentTypeFromLegacy(["nx-type-collab", "nx-type-reel"], "video/mp4")).toBe("collab");
  });

  it("defaults untagged legacy videos to Videos, never guessed Reels", () => {
    expect(strictContentTypeFromLegacy([], "video/mp4")).toBe("video");
  });

  it("classifies images and text-only items as Posts", () => {
    expect(strictContentTypeFromLegacy([], "image/jpeg")).toBe("post");
    expect(strictContentTypeFromLegacy([], null)).toBe("post");
  });
});
