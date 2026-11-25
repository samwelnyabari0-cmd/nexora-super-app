import { describe, expect, it, vi } from "vitest";
import { extractPublisherImage, fetchPublisherImage } from "../../supabase/functions/football-content-sync/news-image-enrichment.ts";

describe("publisher news image enrichment", () => {
  it("extracts Open Graph images and resolves relative image paths", () => {
    const html = '<html><head><meta property="og:image" content="/media/story.jpg"></head></html>';
    expect(extractPublisherImage(html, "https://news.publisher.example/story/1")).toBe(
      "https://news.publisher.example/media/story.jpg",
    );
  });

  it("ignores insecure metadata image URLs", () => {
    const html = '<meta name="twitter:image" content="http://images.example/story.jpg">';
    expect(extractPublisherImage(html, "https://news.publisher.example/story/1")).toBeNull();
  });

  it("rejects private-network image hosts", () => {
    const html = '<meta property="og:image" content="https://192.168.1.20/story.jpg">';
    expect(extractPublisherImage(html, "https://news.publisher.example/story/1")).toBeNull();
  });

  it("fetches an article only on an allowlisted publisher host", async () => {
    const fetcher = vi.fn(async () => new Response(
      '<meta property="og:image" content="https://cdn.publisher.example/story.jpg">',
      { headers: { "content-type": "text/html" } },
    ));
    await expect(fetchPublisherImage(
      "https://news.publisher.example/story/1",
      ["publisher.example"],
      fetcher,
    )).resolves.toBe("https://cdn.publisher.example/story.jpg");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects redirects outside the publisher allowlist", async () => {
    const fetcher = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "https://untrusted.example/redirected-story" },
    }));
    await expect(fetchPublisherImage(
      "https://news.publisher.example/story/1",
      ["publisher.example"],
      fetcher,
    )).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not fetch article URLs outside the publisher allowlist", async () => {
    const fetcher = vi.fn();
    await expect(fetchPublisherImage(
      "https://untrusted.example/story/1",
      ["publisher.example"],
      fetcher,
    )).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
