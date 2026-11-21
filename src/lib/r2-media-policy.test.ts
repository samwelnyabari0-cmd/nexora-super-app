import { describe, expect, it } from "vitest";
import {
  isValidR2PostObjectKey,
  isVerifiedR2Upload,
} from "./r2-media-policy";

describe("R2 media object validation and upload verification", () => {
  it("rejects object keys outside the owner's posts folder", () => {
    expect(isValidR2PostObjectKey("owner-1", "owner-1/posts/video.mp4")).toBe(true);
    expect(isValidR2PostObjectKey("owner-1", "owner-2/posts/video.mp4")).toBe(false);
    expect(isValidR2PostObjectKey("owner-1", "owner-1/posts/../secret")).toBe(false);
  });

  it("verifies uploads using the owner-scoped key, content type and file size without custom metadata", () => {
    const expected = { ownerId: "owner-1", contentType: "video/mp4", size: 1024 };
    const validObject = { ContentLength: 1024, ContentType: "video/mp4" };

    expect(isVerifiedR2Upload(expected, validObject)).toBe(true);
    expect(isVerifiedR2Upload(expected, { ...validObject, ContentLength: 100 })).toBe(false);
    expect(isVerifiedR2Upload(expected, { ...validObject, ContentType: "video/webm" })).toBe(false);
    expect(isVerifiedR2Upload(expected, { ContentType: "video/mp4" })).toBe(false);
  });
});
