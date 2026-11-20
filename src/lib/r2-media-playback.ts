import { createPublicR2MediaPlaybackUrl, createR2MediaPlaybackUrl } from "@/lib/r2-media.functions";

export async function getFreshR2MediaPlaybackUrl(
  postId: string,
  asset: "media" | "thumbnail",
): Promise<string | undefined> {
  try {
    const result = await createR2MediaPlaybackUrl({ data: { postId, asset } });
    return result.url;
  } catch {
    try {
      const result = await createPublicR2MediaPlaybackUrl({ data: { postId, asset } });
      return result.url;
    } catch {
      return undefined;
    }
  }
}
