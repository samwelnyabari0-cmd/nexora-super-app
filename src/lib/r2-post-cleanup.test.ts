import { describe, expect, it } from "vitest";
import { getR2PostObjectKeys } from "./r2-post-cleanup";

describe("getR2PostObjectKeys", () => {
  it("returns the R2 video and cover keys for a post", () => {
    expect(getR2PostObjectKeys({
      media_storage_provider: "r2",
      media_storage_key: "owner/posts/video.mp4",
      thumbnail_storage_provider: "r2",
      thumbnail_storage_key: "owner/posts/cover.jpg",
    })).toEqual(["owner/posts/video.mp4", "owner/posts/cover.jpg"]);
  });

  it("does not return Supabase Storage references", () => {
    expect(getR2PostObjectKeys({
      media_storage_provider: "supabase",
      media_storage_key: "owner/video.mp4",
      thumbnail_storage_provider: "supabase",
      thumbnail_storage_key: "owner/cover.jpg",
    })).toEqual([]);
  });

  it("ignores missing keys and duplicate object keys", () => {
    expect(getR2PostObjectKeys({
      media_storage_provider: "r2",
      media_storage_key: "owner/posts/video.mp4",
      thumbnail_storage_provider: "r2",
      thumbnail_storage_key: "owner/posts/video.mp4",
    })).toEqual(["owner/posts/video.mp4"]);
  });
});