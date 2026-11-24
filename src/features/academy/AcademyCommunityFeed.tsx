import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, BookOpen, Bookmark, Eye, Heart, Play, Repeat2, Share2, Video, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getFreshR2MediaPlaybackUrl } from "@/lib/r2-media-playback";
import { recordUserMediaPostView } from "@/lib/post-views";
import { useSession } from "@/lib/session";

type AcademyCommunityItem = {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_handle: string | null;
  creator_avatar_url: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  media_storage_provider: "supabase" | "r2" | null;
  media_storage_key: string | null;
  thumbnail_storage_provider: "supabase" | "r2" | null;
  thumbnail_storage_key: string | null;
  content_type: string;
  created_at: string;
  view_count: number;
  like_count: number;
  share_count: number;
  save_count: number;
  repost_count: number;
  total_engagement: number;
  mediaSrc?: string;
  thumbnailSrc?: string;
};

async function resolveAsset(
  item: AcademyCommunityItem,
  asset: "media" | "thumbnail",
): Promise<string | undefined> {
  const provider = asset === "media" ? item.media_storage_provider : item.thumbnail_storage_provider;
  const value = asset === "media" ? item.media_url : item.thumbnail_url;
  const key = asset === "media" ? item.media_storage_key : item.thumbnail_storage_key;
  if (provider === "r2") return getFreshR2MediaPlaybackUrl(item.id, asset);
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const { data, error } = await supabase.storage.from("post-media").createSignedUrl(key || value, 900);
  return error ? undefined : data?.signedUrl ?? undefined;
}

const formatCount = (value: number) => Number(value ?? 0).toLocaleString();

export function AcademyCommunityFeed() {
  const { user } = useSession();
  const [items, setItems] = useState<AcademyCommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      setError("");
      return () => { active = false; };
    }
    setLoading(true);
    setError("");
    void (async () => {
      const { data, error: queryError } = await (supabase as any).rpc("get_academy_community_feed", { p_limit: 80 });
      if (!active) return;
      if (queryError) throw queryError;
      const hydrated = await Promise.all(((data ?? []) as AcademyCommunityItem[]).map(async (item) => {
        const [mediaSrc, thumbnailSrc] = await Promise.all([resolveAsset(item, "media"), resolveAsset(item, "thumbnail")]);
        return { ...item, mediaSrc, thumbnailSrc };
      }));
      if (active) setItems(hydrated);
    })().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load education content.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id, refreshTick]);

  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => setRefreshTick((value) => value + 1);
    const channel = supabase
      .channel(`academy-community-feed-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_media_posts" }, refresh)
      .subscribe();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || typeof IntersectionObserver === "undefined") return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const recorded = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = (entry.target as HTMLElement).dataset.postId;
        if (!id || recorded.has(id)) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55 && !timers.has(id)) {
          timers.set(id, setTimeout(() => {
            recorded.add(id);
            timers.delete(id);
            void recordUserMediaPostView(id);
          }, 1200));
        } else if ((!entry.isIntersecting || entry.intersectionRatio < 0.55) && timers.has(id)) {
          clearTimeout(timers.get(id));
          timers.delete(id);
        }
      });
    }, { threshold: [0, 0.55, 1] });
    document.querySelectorAll<HTMLElement>("[data-academy-post-id]").forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [items, user?.id]);

  if (loading) return <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Loading education content…</div>;
  if (error) return (
    <div className="rounded-2xl border border-destructive/40 bg-card p-6 text-center">
      <p className="text-sm text-destructive">{error}</p>
      <Button type="button" variant="outline" className="mt-3" onClick={() => setRefreshTick((value) => value + 1)}>
        <RefreshCw className="mr-2 h-4 w-4" /> Try again
      </Button>
    </div>
  );
  if (!items.length) return (
    <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
      <BookOpen className="mx-auto h-8 w-8 text-primary" />
      <p className="mt-3 font-semibold">Education content will appear here</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Public posts from discoverable Education profiles appear here automatically. Anyone can also share an individual public post here from the main upload screen by selecting “Share to Academic Hub”. No second profile or upload is needed.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link to="/create" className="inline-flex rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted">Share educational content</Link>
        <Button type="button" variant="outline" onClick={() => setRefreshTick((value) => value + 1)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">From Nexora educators</p><h2 className="text-xl font-bold">Community learning</h2><span className="text-xs text-muted-foreground">{items.length} posts</span></div>
        <Button type="button" size="sm" variant="outline" onClick={() => setRefreshTick((value) => value + 1)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const isVideo = item.media_type?.startsWith("video/");
          const preview = item.thumbnailSrc || item.mediaSrc;
          const href = item.content_type === "reel"
            ? `/reels?post=${encodeURIComponent(item.id)}`
            : item.content_type === "video"
              ? `/videos?post=${encodeURIComponent(item.id)}`
              : item.creator_id
                ? `/u/${encodeURIComponent(item.creator_id)}`
                : "#course-catalog";
          const metrics = [
            { label: "Views", value: item.view_count, Icon: Eye },
            { label: "Likes", value: item.like_count, Icon: Heart },
            { label: "Shares", value: item.share_count, Icon: Share2 },
            { label: "Saves", value: item.save_count, Icon: Bookmark },
            { label: "Reposts", value: item.repost_count, Icon: Repeat2 },
          ];
          return (
            <article key={item.id} data-academy-post-id data-post-id={item.id} className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-center gap-2 p-3">
                {item.creator_avatar_url ? <img src={item.creator_avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{item.creator_name.slice(0, 1).toUpperCase()}</div>}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.creator_name}</p><p className="text-[11px] text-muted-foreground">{item.creator_handle ? `@${item.creator_handle.replace(/^@+/, "")} · ` : ""}{new Date(item.created_at).toLocaleDateString()}</p></div>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold capitalize text-primary">{item.content_type}</span>
              </div>
              <Link to={href as any} className="relative block aspect-video overflow-hidden bg-muted">
                {preview ? isVideo ? <video src={item.mediaSrc} poster={item.thumbnailSrc} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={preview} alt={item.caption || "Education content"} loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground">{item.content_type === "video" || item.content_type === "reel" ? <Play className="h-10 w-10" /> : <BookOpen className="h-10 w-10" />}</div>}
                {item.content_type === "video" && <span className="absolute right-3 top-3 rounded-lg bg-black/65 p-2 text-white"><Video className="h-4 w-4" /></span>}
              </Link>
              <div className="space-y-3 p-3">
                {item.caption && <p className="line-clamp-3 whitespace-pre-wrap text-sm">{item.caption}</p>}
                <div className="grid grid-cols-3 gap-x-2 gap-y-3 border-t pt-3 sm:grid-cols-5">
                  {metrics.map(({ label, value, Icon }) => (
                    <div key={label} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{label}</span>
                      <span className="ml-auto font-semibold tabular-nums text-foreground">{formatCount(value)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400"><Activity className="h-4 w-4" /> Total engagement</span>
                  <span className="text-sm font-bold tabular-nums">{formatCount(item.total_engagement)}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
