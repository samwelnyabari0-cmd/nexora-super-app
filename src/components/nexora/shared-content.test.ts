import { describe, expect, it } from "vitest";
import {
  canonicalSharedContentPath,
  isValidSharedContentReference,
  sharedContentLabel,
} from "./shared-content";

const id = "123e4567-e89b-12d3-a456-426614174000";

describe("safe shared Nexora content references", () => {
  it("accepts supported Post, Reel and Video references", () => {
    expect(isValidSharedContentReference({ source: "posts", contentId: id, contentType: "post" })).toBe(true);
    expect(isValidSharedContentReference({ source: "user_media_posts", contentId: id, contentType: "reel" })).toBe(true);
    expect(isValidSharedContentReference({ source: "user_media_posts", contentId: id, contentType: "video" })).toBe(true);
  });

  it("rejects arbitrary URLs, unsupported sources, mismatched types and invalid ids", () => {
    expect(isValidSharedContentReference({ source: "posts", contentId: "https://evil.example", contentType: "post" })).toBe(false);
    expect(isValidSharedContentReference({ source: "user_media_posts", contentId: id, contentType: "story" })).toBe(false);
    expect(isValidSharedContentReference({ source: "posts", contentId: id, contentType: "reel" })).toBe(false);
    expect(isValidSharedContentReference({ source: "external", contentId: id, contentType: "post" })).toBe(false);
  });

  it("builds only canonical in-app routes", () => {
    expect(canonicalSharedContentPath({ source: "posts", contentId: id, contentType: "post" })).toBe(`/explore?post=${id}`);
    expect(canonicalSharedContentPath({ source: "user_media_posts", contentId: id, contentType: "reel" })).toBe(`/reels?post=${id}`);
    expect(canonicalSharedContentPath({ source: "user_media_posts", contentId: id, contentType: "video" })).toBe(`/videos?post=${id}`);
    expect(canonicalSharedContentPath({ source: "user_media_posts", contentId: id, contentType: "post" }, id)).toBe(`/profile/id/${id}?post=${id}`);
    expect(canonicalSharedContentPath({ source: "user_media_posts", contentId: id, contentType: "post" }, "creator_1")).toBeNull();
    expect(canonicalSharedContentPath({ source: "user_media_posts", contentId: id, contentType: "post" })).toBeNull();
  });

  it("labels content without trusting arbitrary metadata", () => {
    expect(sharedContentLabel("post")).toBe("Post");
    expect(sharedContentLabel("reel")).toBe("Reel");
    expect(sharedContentLabel("video")).toBe("Video");
  });
});
