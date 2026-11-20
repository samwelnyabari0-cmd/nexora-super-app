import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicR2MediaPlaybackUrl, createR2MediaPlaybackUrl } from "@/lib/r2-media.functions";
import { getFreshR2MediaPlaybackUrl } from "./r2-media-playback";

vi.mock("@/lib/r2-media.functions", () => ({
  createR2MediaPlaybackUrl: vi.fn(),
  createPublicR2MediaPlaybackUrl: vi.fn(),
}));

describe("getFreshR2MediaPlaybackUrl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a newly signed URL for an authenticated viewer", async () => {
    vi.mocked(createR2MediaPlaybackUrl).mockResolvedValue({ url: "https://r2.example/fresh", expiresInSeconds: 900 } as never);
    await expect(getFreshR2MediaPlaybackUrl("post-1", "media")).resolves.toBe("https://r2.example/fresh");
    expect(createR2MediaPlaybackUrl).toHaveBeenCalledWith({ data: { postId: "post-1", asset: "media" } });
    expect(createPublicR2MediaPlaybackUrl).not.toHaveBeenCalled();
  });

  it("falls back to a public URL when authenticated playback is unavailable", async () => {
    vi.mocked(createR2MediaPlaybackUrl).mockRejectedValue(new Error("No session"));
    vi.mocked(createPublicR2MediaPlaybackUrl).mockResolvedValue({ url: "https://r2.example/public", expiresInSeconds: 900 } as never);
    await expect(getFreshR2MediaPlaybackUrl("post-2", "thumbnail")).resolves.toBe("https://r2.example/public");
  });

  it("returns undefined when both playback methods fail", async () => {
    vi.mocked(createR2MediaPlaybackUrl).mockRejectedValue(new Error("No session"));
    vi.mocked(createPublicR2MediaPlaybackUrl).mockRejectedValue(new Error("Private or unavailable"));
    await expect(getFreshR2MediaPlaybackUrl("post-3", "media")).resolves.toBeUndefined();
  });
});
