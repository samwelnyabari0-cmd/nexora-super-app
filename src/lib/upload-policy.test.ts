import { describe, expect, it } from "vitest";
import { MAX_REEL_DURATION_SECONDS, uploadFormat, validateUpload } from "./upload-policy";

describe("strict short-form upload policy", () => {
  it("allows vertical clips up to and including 90 seconds as Shorts", () => {
    expect(uploadFormat("video/mp4", MAX_REEL_DURATION_SECONDS, 1080, 1920)).toBe("short");
    expect(validateUpload({ size: 1024, type: "video/mp4" }, "personal", 90, 1080, 1920)).toBeNull();
  });

  it("classifies vertical clips longer than 90 seconds as long-form", () => {
    expect(uploadFormat("video/mp4", 91, 1080, 1920)).toBe("long_form");
  });

  it("classifies horizontal and square clips as long-form regardless of duration", () => {
    expect(uploadFormat("video/mp4", 30, 1920, 1080)).toBe("long_form");
    expect(uploadFormat("video/mp4", 30, 1080, 1080)).toBe("long_form");
  });

  it("keeps images in the feed upload category", () => {
    expect(uploadFormat("image/jpeg", 30, 1080, 1920)).toBe("feed");
  });

  it("still enforces each plan's maximum long-form duration", () => {
    expect(validateUpload({ size: 1024, type: "video/mp4" }, "personal", 601, 1920, 1080))
      .toContain("up to 10 minutes");
  });
});
