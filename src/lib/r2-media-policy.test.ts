import { describe, expect, it } from "vitest";
import {
  canReadR2Media,
  isValidR2PostObjectKey,
  isVerifiedR2Upload,
} from "./r2-media-policy";

describe("R2 media authorization and upload verification", () => {
  it("allows an owner to read their own private media", () => {
    expect(canReadR2Media({
      ownerId: "owner-1",
      requesterId: "owner-1",
      audience: "private",
    })).toBe(true);
  });

  it("allows a different viewer only when the post is public", () => {
    expect(canReadR2Media({
      ownerId: "owner-1",
      requesterId: "viewer-1",
      audience: "public",
    })).toBe(true);
    expect(canReadR2Media({
      ownerId: "owner-1",
      requesterId: "viewer-1",
      audience: "private",
    })).toBe(false);
  });

  it("rejects object keys outside the owner's posts folder", () => {
    expect(isValidR2PostObjectKey("owner-1", "owner-1/posts/video.mp4")).toBe(true);
    expect(isValidR2PostObjectKey("owner-1", "owner-2/posts/video.mp4")).toBe(false);
    expect(isValidR2PostObjectKey("owner-1", "owner-1/posts/../secret")).toBe(false);
  });

  it("accepts an upload only when size, type and ownership metadata match", () => {
    const expected = { ownerId: "owner-1", contentType: "video/mp4", size: 1024 };
    const validObject = {
      ContentLength: 1024,
      ContentType: "video/mp4",
      Metadata: {
        owner: "owner-1",
        purpose: "post-media",
        expected_size: "1024",
      },
    };
    expect(isVerifiedR2Upload(expected, validObject)).toBe(true);
    expect(isVerifiedR2Upload(expected, { ...validObject, ContentLength: 100 })).toBe(false);
    expect(isVerifiedR2Upload(expected, {
      ...validObject,
      Metadata: { ...validObject.Metadata, owner: "owner-2" },
    })).toBe(false);
  });
});
