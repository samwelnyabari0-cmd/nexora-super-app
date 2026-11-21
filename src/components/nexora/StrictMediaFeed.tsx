import { useEffect, useRef, useState } from "react";
import { Film, Play, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getFreshR2MediaPlaybackUrl } from "@/lib/r2-media-playback";

export type StrictFeedType = "post" | "reel" | "video" | "collab";
export type StrictMediaItem = {
  id: string;
  user_id: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  content_type: StrictFeedType;
  aspect_ratio: string | null;
  framing_aspect_ratio?: string | null;
  focal_x?: number | null;
  focal_y?: number | null;
  zoom?: number | null;
  dominant_color?: string | null;
  duration_seconds: number | null;
  created_at: string;
  like_count: number | null;
  comment_count: number | null;
  share_count: number | null;
  view_count: number | null;
  media_storage_provider?: "supabase" | "r2" | null;
  media_storage_key?: string | null;
  thumbnail_storage_provider?: "supabase" | "r2" | null;
  thumbnail_storage_key?: string | null;
  mediaSrc?: string;
  thumbnailSrc?: string;
};

async function resolveStorageUrl(
  value: string | null,
  postId: string,
  asset: "media" | "thumbnail",
  provider?: "supabase" | "r2" | null,
  storageKey?: string | null,
): Promise<string | undefined> {
  if (provider === "r2") return getFreshR2MediaPlaybackUrl(postId, asset);
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  const { data, error } = await supabase.storage.from("post-media").createSignedUrl(storageKey || value, 900);
  return error ? undefined : data?.signedUrl ?? undefined;
}

export function useStrictMediaItems(contentType: StrictFeedType, userId?: string, enabled = true) {
  const [items, setItems] = useState<StrictMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const attemptedRefresh = useRef(new Set<string>());

  const refreshItemUrl = async (
    item: StrictMediaItem,
    asset: "media" | "thumbnail",
    failedUrl: string,
  ) => {
    const provider = asset === "media" ? item.media_storage_provider : item.thumbnail_storage_provider;
    if (provider !== "r2" || !failedUrl) return;
    const attemptKey = `${item.id}:${asset}:${failedUrl}`;
    if (attemptedRefresh.current.has(attemptKey)) return;
    attemptedRefresh.current.add(attemptKey);
    const freshUrl = await getFreshR2MediaPlaybackUrl(item.id, asset);
    if (!freshUrl || freshUrl === failedUrl) return;
    setItems((current) => current.map((entry) => entry.id !== item.id
      ? entry
      : asset === "media" ? { ...entry, mediaSrc: freshUrl } : { ...entry, thumbnailSrc: freshUrl }));
  };

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError("");
      return () => { active = false; };
    }
    setLoading(true);
    setError("");
    void (async () => {
      let query = (supabase as any)
        .from("user_media_posts")
        .select("id, user_id, caption, media_url, media_type, thumbnail_url, media_storage_provider, media_storage_key, thumbnail_storage_provider, thumbnail_storage_key, content_type, aspect_ratio, framing_aspect_ratio, focal_x, focal_y, zoom, dominant_color, duration_seconds, created_at, like_count, comment_count, share_count, view_count")
        .eq("content_type", contentType)
        .order("created_at", { ascending: false })
        .limit(80);
      if (userId) query = query.eq("user_id", userId);
      else query = query.eq("audience", "public");

      const { data, error: queryError } = await query;
      if (!active) return;
      if (queryError) {
        setError("This feed is temporarily unavailable.");
        setItems([]);
        setLoading(false);
        return;
      }
      const hydrated = await Promise.all((data ?? []).map(async (row: StrictMediaItem) => {
        const [mediaSrc, thumbnailSrc] = await Promise.all([
          resolveStorageUrl(row.media_url, row.id, "media", row.media_storage_provider, row.media_storage_key),
          resolveStorageUrl(row.thumbnail_url, row.id, "thumbnail", row.thumbnail_storage_provider, row.thumbnail_storage_key),
        ]);
        return { ...row, mediaSrc, thumbnailSrc };
      }));
      if (!active) return;
      setItems(hydrated);
      setLoading(false);
    })().catch(() => {
      if (active) {
        setError("This feed is temporarily unavailable.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [contentType, userId, enabled]);

  return { items, loading, error, refreshItemUrl };
}

export function StrictMediaGrid({ contentType, userId }: { contentType: StrictFeedType; userId?: string }) {
  const { items, loading, error, refreshItemUrl } = useStrictMediaItems(contentType, userId);
  const label = contentType === "reel" ? "Reels" : contentType === "video" ? "Videos" : contentType === "collab" ? "Collabs" : "Posts";

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading {label.toLowerCase()}…</p>;
  if (error) return <p role="alert" className="py-10 text-center text-sm text-muted-foreground">{error}</p>;
  if (!items.length) return <p className="py-10 text-center text-sm text-muted-foreground">No {label.toLowerCase()} yet.</p>;

  return (
    <div className="grid grid-cols-3 auto-rows-[112px] gap-2 sm:auto-rows-[132px]">
      {items.map((item) => {
        const preview = item.thumbnailSrc || item.mediaSrc;
        const ratioParts = (item.framing_aspect_ratio && item.framing_aspect_ratio !== "original"
          ? item.framing_aspect_ratio : item.aspect_ratio)?.split(":").map(Number);
        const ratio = ratioParts?.length === 2 && ratioParts.every((part) => Number.isFinite(part) && part > 0)
          ? ratioParts[0] / ratioParts[1]
          : contentType === "reel" ? 9 / 16 : contentType === "video" ? 16 / 9 : 1;
        const tall = ratio <= 0.75 || contentType === "reel";
        const wide = ratio >= 1.55 || contentType === "video";
        const fixedFrame = Boolean(item.framing_aspect_ratio && item.framing_aspect_ratio !== "original");
        const tile = (
          <div className={`group relative ${tall ? "row-span-2" : wide ? "col-span-2" : ""} h-full min-h-0 overflow-hidden rounded-xl border border-white/10`}
            style={{ backgroundColor: item.dominant_color || "#14141f" }}>
            {preview && item.media_type?.startsWith("video/") ? (
              <video src={item.mediaSrc} poster={item.thumbnailSrc} onError={(event) => void refreshItemUrl(item, "media", event.currentTarget.currentSrc)} muted playsInline preload="metadata" className="h-full w-full"
                style={{ objectFit: fixedFrame ? "cover" : "contain", objectPosition: `${item.focal_x ?? 50}% ${item.focal_y ?? 50}%`, transform: `scale(${Math.max(1, Math.min(3, item.zoom ?? 1))})` }} />
            ) : preview ? (
              <img src={preview} alt={item.caption || `NEXORA ${label}`} onError={(event) => void refreshItemUrl(item, item.thumbnailSrc ? "thumbnail" : "media", event.currentTarget.currentSrc)} loading="lazy" className="h-full w-full"
                style={{ objectFit: fixedFrame ? "cover" : "contain", objectPosition: `${item.focal_x ?? 50}% ${item.focal_y ?? 50}%`, transform: `scale(${Math.max(1, Math.min(3, item.zoom ?? 1))})` }} />
            ) : (
              <div className="flex h-full items-center justify-center p-3 text-center text-xs text-zinc-300">{item.caption || label}</div>
            )}
            {contentType === "reel" && <span className="absolute right-2 top-2 rounded-md bg-black/65 p-1.5 text-white"><Film className="h-3.5 w-3.5" /></span>}
            {contentType === "video" && <span className="absolute right-2 top-2 rounded-md bg-black/65 p-1.5 text-white"><Video className="h-3.5 w-3.5" /></span>}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[10px] text-white">
              <span className="flex items-center gap-1"><Play className="h-3 w-3 fill-current" /> {Number(item.view_count ?? 0).toLocaleString()}</span>
              {contentType !== "reel" && <p className="mt-1 line-clamp-2">{item.caption}</p>}
            </div>
          </div>
        );
        if (contentType === "reel") return <a key={item.id} href={`/reels?post=${encodeURIComponent(item.id)}`} aria-label="Open this Reel">{tile}</a>;
        if (contentType === "video") return <a key={item.id} href={`/videos?post=${encodeURIComponent(item.id)}`} aria-label="Open this Video">{tile}</a>;
        return <div key={item.id}>{tile}</div>;
      })}
    </div>
  );
}
