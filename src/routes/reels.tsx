import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart, MessageCircle, Share2, Film, BarChart3, Bookmark, Repeat2, Eye, Volume2, VolumeX, Download } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { useStrictMediaItems } from "@/components/nexora/StrictMediaFeed";
import { recordUserMediaPostView } from "@/lib/post-views";
import { useSocialGraph } from "@/features/social/useSocialGraph";
import { MediaComments } from "@/components/nexora/MediaComments";
import { formatRelativeTime, formatExactDateTime } from "@/lib/format-relative-time";
import { saveCommuteMedia } from "@/lib/offline-storage";

type ComedyReelVideo = { provider_id: string; match_label: string; source_name: string; thumbnail_url: string | null; video_url: string; published_at: string };

function getYoutubeId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1);
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      return url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] || "";
    }
  } catch { /* Invalid YouTube URL. */ }
  return "";
}

export const Route = createFileRoute("/reels")({
  head: () => ({ meta: [{ title: "Reels — NEXORA" }, { name: "description", content: "Vertical short-form videos on NEXORA." }] }),
  component: Reels,
});

function Reels() {
  const { user } = useSession();
  const { items, loading, error, loadMediaUrl } = useStrictMediaItems("reel");
  const [comedyVideos, setComedyVideos] = useState<ComedyReelVideo[]>([]);
  const [comedyLoading, setComedyLoading] = useState(true);
  const [liked, setLiked] = useState<string[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<string[]>([]);
  const [reposted, setReposted] = useState<string[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, { display_name: string | null; handle: string; avatar_url: string | null; private_profile: boolean }>>({});
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const [playBlockedId, setPlayBlockedId] = useState<string | null>(null);
  const [mutedReels, setMutedReels] = useState<Record<string, boolean>>({});
  const [requestedComedyPlaybackId, setRequestedComedyPlaybackId] = useState<string | null>(null);
  const [commentsReelId, setCommentsReelId] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [savingOfflineId, setSavingOfflineId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const itemIdsKey = items.map((item) => item.id).join("|") + "::" + comedyVideos.map((item) => item.provider_id).join("|");

  useEffect(() => {
    let active = true;
    const loadComedyVideos = async () => {
      const { data, error: feedError } = await (supabase as any).from("football_highlights")
        .select("provider_id,match_label,source_name,thumbnail_url,video_url,published_at")
        .eq("provider", "youtube-comedy").eq("is_published", true)
        .order("published_at", { ascending: false }).limit(24);
      if (!active) return;
      if (!feedError) {
        // Keep the newest row for each YouTube video. The same clip can be
        // imported more than once under different provider IDs or titles.
        const uniqueVideos = new Map<string, ComedyReelVideo>();
        for (const row of (data ?? []) as ComedyReelVideo[]) {
          const youtubeId = getYoutubeId(row.video_url);
          if (youtubeId && !uniqueVideos.has(youtubeId)) uniqueVideos.set(youtubeId, row);
        }
        setComedyVideos(Array.from(uniqueVideos.values()));
      }
      else console.warn("Could not load comedy Reels:", feedError.message);
      setComedyLoading(false);
    };
    void loadComedyVideos();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadComedyVideos();
    }, 15 * 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) { setLiked([]); return; }
    void Promise.all([
      supabase.rpc("get_my_liked_user_media_posts"),
      (supabase as any).from("user_media_post_saves").select("post_id").eq("user_id", user.id),
      supabase.rpc("get_my_reposted_user_media_posts"),
    ]).then(([likes, saves, reposts]) => {
      if (!active) return;
      if (!likes.error) setLiked((likes.data ?? []) as string[]);
      if (!saves.error) setSaved((saves.data ?? []).map((row: { post_id: string }) => row.post_id));
      if (!reposts.error) setReposted((reposts.data ?? []) as string[]);
    });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    if (!user?.id) { setCreatorProfiles({}); return; }
    void (supabase as any).rpc("get_discoverable_profiles", { p_query: null, p_limit: 60 })
      .then(({ data, error: profileError }: { data: any[] | null; error: any }) => {
        if (!active || profileError) return;
        const next: typeof creatorProfiles = {};
        for (const profile of data ?? []) next[profile.id] = profile;
        setCreatorProfiles(next);
      });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible || visible.intersectionRatio < 0.5) {
        videoRefs.current.forEach((video) => video.pause());
        setActiveReelId(null);
        setRequestedComedyPlaybackId(null);
        return;
      }

      const nextId = (visible.target as HTMLElement).dataset.reelId;
      if (!nextId) return;
      videoRefs.current.forEach((video, id) => {
        if (id !== nextId) video.pause();
      });
      setPlayBlockedId((current) => current === nextId ? current : null);
      setRequestedComedyPlaybackId((current) => current === nextId ? current : null);
      setActiveReelId(nextId);
    }, { root: feed, threshold: [0, 0.25, 0.5, 0.65, 0.8, 1] });

    feed.querySelectorAll<HTMLElement>("[data-reel-id]").forEach((article) => observer.observe(article));
    return () => {
      observer.disconnect();
      videoRefs.current.forEach((video) => video.pause());
    };
  }, [itemIdsKey]);

  useEffect(() => {
    if (!activeReelId || activeReelId.startsWith("comedy:")) return;
    const item = items.find((entry) => entry.id === activeReelId);
    if (!item) return;
    if (!item.mediaSrc) {
      void loadMediaUrl(item);
      return;
    }
    const activeVideo = videoRefs.current.get(activeReelId);
    videoRefs.current.forEach((video, id) => { if (id !== activeReelId) video.pause(); });
    if (!activeVideo) return;
    activeVideo.muted = mutedReels[activeReelId] ?? true;
    void activeVideo.play().then(() => setPlayBlockedId(null)).catch(() => {
      // Do not silently mute when mobile autoplay with sound is blocked.
      setPlayBlockedId(activeReelId);
    });
  }, [activeReelId, items, loadMediaUrl, mutedReels]);

  async function toggleLike(postId: string) {
    if (!user) return toast.error("Sign in to like Reels.");
    const wasLiked = liked.includes(postId);
    const { data, error: rpcError } = await (supabase as any).rpc(
      wasLiked ? "unlike_user_media_post" : "like_user_media_post",
      { target_post_id: postId },
    );
    if (rpcError) return toast.error("Could not update your like.");
    setLiked((current) => wasLiked ? current.filter((id) => id !== postId) : [...current, postId]);
    if (typeof data === "number") setLikeCounts((current) => ({ ...current, [postId]: data }));
  }

  async function shareReel(postId: string, caption: string | null) {
    const url = `${window.location.origin}/reels?post=${postId}`;
    try {
      if (navigator.share) await navigator.share({ title: "NEXORA Reel", text: caption || "Watch this Reel", url });
      else { await navigator.clipboard.writeText(url); toast.success("Reel link copied."); }
      if (user) {
        const { data, error: shareError } = await (supabase as any).rpc("increment_user_media_post_shares", { target_post_id: postId });
        if (shareError) toast.error("Link shared, but the share count could not be updated.");
        else if (typeof data === "number") setShareCounts((current) => ({ ...current, [postId]: data }));
      }
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") toast.error("Could not share this Reel.");
    }
  }

  async function toggleSave(postId: string) {
    if (!user) return toast.error("Sign in to save Reels.");
    const wasSaved = saved.includes(postId);
    const result = wasSaved
      ? await (supabase as any).from("user_media_post_saves").delete().eq("post_id", postId).eq("user_id", user.id)
      : await (supabase as any).from("user_media_post_saves").insert({ post_id: postId, user_id: user.id });
    if (result.error) return toast.error("Could not update saved Reels.");
    setSaved((current) => wasSaved ? current.filter((id) => id !== postId) : [...current, postId]);
  }

  async function toggleRepost(postId: string) {
    if (!user) return toast.error("Sign in to repost.");
    if (reposted.includes(postId)) return toast.error("You have already reposted this Reel.");
    const { data, error: repostError } = await (supabase as any).rpc("repost_user_media_post", { target_post_id: postId });
    if (repostError) return toast.error("Could not repost this Reel.");
    setReposted((current) => [...current, postId]);
  }

  async function saveReelOffline(item: (typeof items)[number]) {
    if (!item.mediaSrc) return toast.error("This Reel has no downloadable media file.");
    setSavingOfflineId(item.id);
    try {
      const result = await saveCommuteMedia({
        id: item.id,
        title: item.caption || "NEXORA Reel",
        mediaUrl: item.mediaSrc,
        thumbnailUrl: item.thumbnailSrc ?? null,
        mediaType: "video",
        contentType: "reel",
      });
      window.dispatchEvent(new Event("nexora:offline-pack-updated"));
      toast.success("Reel saved to your Daily Commute Pack (" + (result.item.sizeBytes / 1048576).toFixed(1) + " MB).");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not save this Reel offline.");
    } finally {
      setSavingOfflineId(null);
    }
  }

  if (loading && !items.length && comedyLoading && !comedyVideos.length) return <div className="py-16 text-center text-sm text-muted-foreground">Loading Reels…</div>;
  if (error && !items.length && !comedyVideos.length) return <div role="alert" className="py-16 text-center text-sm text-muted-foreground">{error}</div>;
  if (!items.length && !comedyVideos.length) return <div className="mx-auto max-w-md py-16 text-center"><Film className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><h1 className="font-semibold">No Reels yet</h1><p className="mt-1 text-sm text-muted-foreground">Vertical videos and comedy Shorts will appear here.</p><Link to="/create" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create a Reel</Link></div>;

  const requestedId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("post") : null;
  const ordered = requestedId ? [...items].sort((a, b) => Number(b.id === requestedId) - Number(a.id === requestedId)) : items;

  return (
    <main className="fixed inset-0 z-[60] h-[100svh] bg-black text-white">
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
        <Link to="/explore" aria-label="Back to Explore" className="rounded-full bg-black/50 p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold">NEXORA REELS</span>
        <Link to="/create" className="rounded-full bg-black/50 px-3 py-2 text-xs font-semibold">＋ Create</Link>
      </div>
      <div ref={feedRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain">
        {ordered.map((item) => (
          <article key={item.id} data-reel-id={item.id} className="relative flex h-[100svh] min-h-[100svh] snap-start snap-always items-center justify-center bg-black">
            {item.mediaSrc ? (
              <video
                ref={(element) => {
                  if (element) videoRefs.current.set(item.id, element);
                  else videoRefs.current.delete(item.id);
                }}
                src={item.mediaSrc}
                poster={item.thumbnailSrc}
                controls
                playsInline
                loop
                muted={mutedReels[item.id] ?? true}
                preload={activeReelId === item.id ? "auto" : "none"}
                onPlay={(event) => {
                  if (activeReelId && activeReelId !== item.id) event.currentTarget.pause();
                  setPlayBlockedId(null);
                  if (user?.id) void recordUserMediaPostView(item.id);
                }}
                onClick={(event) => {
                  const video = event.currentTarget;
                  if (video.paused) {
                    video.muted = false;
                    setMutedReels((current) => ({ ...current, [item.id]: false }));
                    void video.play().catch(() => setPlayBlockedId(item.id));
                  } else video.pause();
                }}
                className="h-full w-full object-contain"
              />
            ) : <p className="p-8 text-center">{item.caption}</p>}
            <div className="absolute bottom-8 left-4 right-20 z-20 space-y-2 bg-gradient-to-t from-black/70 to-transparent pb-3 pt-10">
              <CreatorFollow ownerId={item.user_id} profile={creatorProfiles[item.user_id ?? ""]} isSelf={user?.id === item.user_id} />
              {user?.id && item.user_id === user.id && <Link to="/dashboard" search={{ postId: item.id }} className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-[11px] font-semibold"><BarChart3 className="h-3.5 w-3.5" /> Insights</Link>}
              <p className="whitespace-pre-wrap text-sm">{item.caption}</p>
              <p className="text-[11px] text-white/70" title={formatExactDateTime(item.created_at)}>{formatRelativeTime(item.created_at)}</p>
              <p className="flex items-center gap-1 text-[11px] text-white/80"><Eye className="h-3.5 w-3.5" /> {Number(item.view_count ?? 0).toLocaleString()} views · {item.duration_seconds ?? "—"} sec</p>
            </div>
            {playBlockedId === item.id && activeReelId === item.id && (
              <button type="button" onClick={() => {
                const video = videoRefs.current.get(item.id);
                if (!video) return;
                video.muted = false;
                setMutedReels((current) => ({ ...current, [item.id]: false }));
                void video.play().then(() => setPlayBlockedId(null)).catch(() => setPlayBlockedId(item.id));
              }} className="absolute inset-0 z-20 grid place-items-center bg-black/25" aria-label="Play Reel with sound">
                <span className="rounded-full bg-black/75 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/30">Tap to play with sound</span>
              </button>
            )}
            <div className="absolute bottom-24 right-3 z-30 flex flex-col items-center gap-5">
              <button type="button" onClick={() => void toggleLike(item.id)} aria-label={liked.includes(item.id) ? "Unlike Reel" : "Like Reel"} className="flex flex-col items-center gap-1"><Heart className={`h-7 w-7 ${liked.includes(item.id) ? "fill-pink-500 text-pink-500" : "text-white"}`} /><span className="text-[11px]">{Number(likeCounts[item.id] ?? item.like_count ?? 0)}</span></button>
              <button type="button" onClick={() => setCommentsReelId(item.id)} aria-label="Open comments" aria-haspopup="dialog" className="flex flex-col items-center gap-1"><MessageCircle className="h-7 w-7" /><span className="text-[11px]">{Number(commentCounts[item.id] ?? item.comment_count ?? 0)}</span></button>
              <button type="button" onClick={() => void shareReel(item.id, item.caption)} aria-label="Share Reel" className="flex flex-col items-center gap-1"><Share2 className="h-7 w-7" /><span className="text-[11px]">{Number(shareCounts[item.id] ?? item.share_count ?? 0)}</span></button>
              <button type="button" onClick={() => void toggleRepost(item.id)} aria-label="Repost Reel" className={`flex flex-col items-center gap-1 ${reposted.includes(item.id) ? "text-emerald-400" : ""}`}><Repeat2 className="h-7 w-7" /><span className="text-[11px]">{Number(item.repost_count ?? 0)}</span></button>
              <button type="button" onClick={() => void toggleSave(item.id)} aria-label={saved.includes(item.id) ? "Unsave Reel" : "Save Reel"} className={`flex flex-col items-center gap-1 ${saved.includes(item.id) ? "text-amber-300" : ""}`}><Bookmark className={`h-7 w-7 ${saved.includes(item.id) ? "fill-current" : ""}`} /><span className="text-[11px]">{saved.includes(item.id) ? "Saved" : "Save"}</span></button>
              <button type="button" onClick={() => {
                const nextMuted = !(mutedReels[item.id] ?? true);
                setMutedReels((current) => ({ ...current, [item.id]: nextMuted }));
                const video = videoRefs.current.get(item.id);
                if (video) video.muted = nextMuted;
              }} aria-label={(mutedReels[item.id] ?? true) ? "Unmute Reel" : "Mute Reel"} className="flex flex-col items-center gap-1">
                {(mutedReels[item.id] ?? true) ? <VolumeX className="h-7 w-7" /> : <Volume2 className="h-7 w-7" />}
                <span className="text-[11px]">{(mutedReels[item.id] ?? true) ? "Muted" : "Sound"}</span>
              </button>
              <button type="button" onClick={() => void saveReelOffline(item)} disabled={savingOfflineId === item.id} aria-label="Save Reel for offline use" className="flex flex-col items-center gap-1 disabled:opacity-50"><Download className="h-7 w-7" /><span className="text-[11px]">{savingOfflineId === item.id ? "Saving" : "Offline"}</span></button>
              <MediaComments postId={item.id} open={commentsReelId === item.id} variant="sheet" onClose={() => setCommentsReelId(null)} onCountChange={(count) => setCommentCounts((current) => ({ ...current, [item.id]: count }))} />
            </div>
          </article>
        ))}
        {comedyVideos.map((video) => {
          const reelId = "comedy:" + video.provider_id;
          const id = getYoutubeId(video.video_url);
          return (
            <article key={reelId} data-reel-id={reelId} className="relative flex h-[100svh] min-h-[100svh] snap-start snap-always items-center justify-center bg-black">
              {activeReelId === reelId && requestedComedyPlaybackId === reelId ? (
                <iframe className="h-full w-full" src={"https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&mute=0&playsinline=1&controls=1&rel=0&enablejsapi=1&origin=" + encodeURIComponent(window.location.origin)}
                  title={video.match_label} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
              ) : (
                <button type="button" onClick={() => { setActiveReelId(reelId); setRequestedComedyPlaybackId(reelId); }} className="absolute inset-0 grid place-items-center bg-black" aria-label={"Play " + video.match_label}>
                  <img src={video.thumbnail_url || "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"} alt="" loading="lazy" className="h-full w-full object-contain" />
                  <span className="absolute grid h-16 w-16 place-items-center rounded-full bg-black/70 text-white ring-1 ring-white/50"><Film className="h-7 w-7" /></span>
                </button>
              )}
              <div className="pointer-events-none absolute bottom-8 left-4 right-20 z-20 space-y-2 bg-gradient-to-t from-black/75 to-transparent pb-3 pt-10">
                <p className="text-xs font-bold text-fuchsia-200">COMEDY · {video.source_name}</p>
                <p className="text-sm font-semibold">{video.match_label}</p>
                <p className="text-[11px] text-white/70">{formatRelativeTime(video.published_at)}</p>
              </div>
              <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="absolute bottom-8 right-4 z-30 rounded-full bg-black/70 px-3 py-2 text-[11px] font-semibold">YouTube</a>
            </article>
          );
        })}
      </div>
    </main>
  );
}


function CreatorFollow({ ownerId, profile, isSelf }: { ownerId: string | null; profile?: { display_name: string | null; handle: string; avatar_url: string | null; private_profile: boolean }; isSelf: boolean }) {
  const social = useSocialGraph(ownerId ?? undefined);
  if (!ownerId) return <p className="text-xs font-semibold">NEXORA Creator</p>;
  const label = profile?.display_name || profile?.handle || "NEXORA Creator";
  return (
    <div className="flex items-center gap-2">
      <Link to="/u/$userId" reloadDocument params={{ userId: ownerId }} className="flex min-w-0 items-center gap-2">
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full border-2 border-white object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-white/15 text-sm font-bold">{label.slice(0,1).toUpperCase()}</span>}
        <span className="min-w-0"><span className="block max-w-[145px] truncate text-xs font-bold">{label}</span><span className="block text-[10px] text-white/70">@{profile?.handle || "creator"}</span></span>
      </Link>
      {!isSelf && <button type="button" disabled={social.loading} onClick={() => void social.toggleFollow()} className="rounded-full border border-white/70 px-3 py-1 text-[11px] font-bold text-white">{social.isFollowing ? "Following" : social.isPending ? "Requested" : "Follow"}</button>}
    </div>
  );
}
