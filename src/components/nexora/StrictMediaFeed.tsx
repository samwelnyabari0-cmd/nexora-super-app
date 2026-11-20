import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Film, Play, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  duration_seconds: number | null;
  created_at: string;
  like_count: number | null;
  comment_count: number | null;
  share_count: number | null;
  view_count: number | null;
  mediaSrc?: string;
  thumbnailSrc?: string;
};

async function resolveStorageUrl(value: string | null): Promise<string | undefined> {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  const { data, error } = await supabase.storage.from("post-media").createSignedUrl(value, 900);
  return error ? undefined : data?.signedUrl ?? undefined;
}

export function useStrictMediaItems(contentType: StrictFeedType, userId?: string) {
  const [items, setItems] = useState<StrictMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      let query = (supabase as any)
        .from("user_media_posts")
        .select("id, user_id, caption, media_url, media_type, thumbnail_url, content_type, aspect_ratio, duration_seconds, created_at, like_count, comment_count, share_count, view_count")
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
          resolveStorageUrl(row.media_url),
          resolveStorageUrl(row.thumbnail_url),
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
  }, [contentType, userId]);

  return { items, loading, error };
}

export function StrictMediaGrid({ contentType, userId }: { contentType: StrictFeedType; userId?: string }) {
  const { items, loading, error } = useStrictMediaItems(contentType, userId);
  const label = contentType === "reel" ? "Reels" : contentType === "video" ? "Videos" : contentType === "collab" ? "Collabs" : "Posts";

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading {label.toLowerCase()}…</p>;
  if (error) return <p role="alert" className="py-10 text-center text-sm text-muted-foreground">{error}</p>;
  if (!items.length) return <p className="py-10 text-center text-sm text-muted-foreground">No {label.toLowerCase()} yet.</p>;

  const shape = contentType === "reel" ? "aspect-[9/16]" : contentType === "video" ? "aspect-video" : "aspect-square";
  return (
    <div className={contentType === "video" ? "grid gap-3 sm:grid-cols-2" : "grid grid-cols-3 gap-2"}>
      {items.map((item) => {
        const preview = item.thumbnailSrc || item.mediaSrc;
        const tile = (
          <div className={`group relative ${shape} overflow-hidden rounded-xl border border-white/10 bg-[#14141f]`}>
            {preview && item.media_type?.startsWith("video/") ? (
              <video src={item.mediaSrc} poster={item.thumbnailSrc} muted playsInline preload="metadata" className="h-full w-full object-cover" />
            ) : preview ? (
              <img src={preview} alt={item.caption || `NEXORA ${label}`} loading="lazy" className="h-full w-full object-cover" />
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
        if (contentType === "reel") return <Link key={item.id} to="/reels" aria-label="Open Reels feed">{tile}</Link>;
        if (contentType === "video") return <Link key={item.id} to="/videos" aria-label="Open Videos feed">{tile}</Link>;
        return <div key={item.id}>{tile}</div>;
      })}
    </div>
  );
}
