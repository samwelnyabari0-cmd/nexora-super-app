import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, Video, ArrowLeft, BarChart3, Heart, Share2, Repeat2, Bookmark, Download, Eye } from "lucide-react";
import { useStrictMediaItems } from "@/components/nexora/StrictMediaFeed";
import { useSession } from "@/lib/session";
import { recordUserMediaPostView } from "@/lib/post-views";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSocialGraph } from "@/features/social/useSocialGraph";

export const Route = createFileRoute("/videos")({
  head: () => ({ meta: [{ title: "Videos — NEXORA" }, { name: "description", content: "Horizontal and long-form videos on NEXORA." }] }),
  component: Videos,
});

function Videos() {
  const { items, loading, error } = useStrictMediaItems("video");
  const { user } = useSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liked, setLiked] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [reposted, setReposted] = useState<string[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, { display_name: string | null; handle: string; avatar_url: string | null; private_profile: boolean }>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get("post");
    if (requestedId) setActiveId(requestedId);
  }, []);
  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    void Promise.all([
      supabase.rpc("get_my_liked_user_media_posts"),
      (supabase as any).from("user_media_post_saves").select("post_id").eq("user_id", user.id),
      supabase.rpc("get_my_reposted_user_media_posts"),
      (supabase as any).rpc("get_discoverable_profiles", { p_query: null, p_limit: 60 }),
    ]).then(([likes, saves, reposts, profiles]) => {
      if (!active) return;
      if (!likes.error) setLiked((likes.data ?? []) as string[]);
      if (!saves.error) setSaved((saves.data ?? []).map((row: { post_id: string }) => row.post_id));
      if (!reposts.error) setReposted((reposts.data ?? []) as string[]);
      if (!profiles.error) {
        const next: typeof creatorProfiles = {};
        for (const profile of profiles.data ?? []) next[profile.id] = profile;
        setCreatorProfiles(next);
      }
    });
    return () => { active = false; };
  }, [user?.id]);

  const active = items.find((item) => item.id === activeId) ?? items[0];

  async function toggleLike(postId: string) {
    if (!user) return toast.error("Sign in to like videos.");
    const wasLiked = liked.includes(postId);
    const { data, error: likeError } = await (supabase as any).rpc(wasLiked ? "unlike_user_media_post" : "like_user_media_post", { target_post_id: postId });
    if (likeError) return toast.error("Could not update your like.");
    setLiked((current) => wasLiked ? current.filter((id) => id !== postId) : [...current, postId]);
    if (typeof data === "number") setLikeCounts((current) => ({ ...current, [postId]: data }));
  }
  async function toggleSave(postId: string) {
    if (!user) return toast.error("Sign in to save videos.");
    const wasSaved = saved.includes(postId);
    const result = wasSaved
      ? await (supabase as any).from("user_media_post_saves").delete().eq("post_id", postId).eq("user_id", user.id)
      : await (supabase as any).from("user_media_post_saves").insert({ post_id: postId, user_id: user.id });
    if (result.error) return toast.error("Could not update saved videos.");
    setSaved((current) => wasSaved ? current.filter((id) => id !== postId) : [...current, postId]);
  }
  async function repostVideo(postId: string) {
    if (!user) return toast.error("Sign in to repost.");
    if (reposted.includes(postId)) return toast.error("You have already reposted this video.");
    const { error: repostError } = await (supabase as any).rpc("repost_user_media_post", { target_post_id: postId });
    if (repostError) return toast.error("Could not repost this video.");
    setReposted((current) => [...current, postId]);
  }
  async function shareVideo() {
    if (!active) return;
    const url = `${window.location.origin}/videos?post=${active.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "NEXORA Video", text: active.caption || "Watch this video", url });
      else { await navigator.clipboard.writeText(url); toast.success("Video link copied."); }
      if (user) await (supabase as any).rpc("increment_user_media_post_shares", { target_post_id: active.id });
    } catch (error) { if ((error as Error).name !== "AbortError") toast.error("Could not share video."); }
  }
  function downloadVideo() {
    if (!active?.mediaSrc) return toast.error("Video file is unavailable.");
    const anchor = document.createElement("a");
    anchor.href = active.mediaSrc;
    anchor.download = `nexora-video-${active.id}.mp4`;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading Videos…</div>;
  if (error) return <div role="alert" className="py-16 text-center text-sm text-muted-foreground">{error}</div>;
  if (!items.length) return <div className="mx-auto max-w-md py-16 text-center"><Video className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><h1 className="font-semibold">No Videos yet</h1><p className="mt-1 text-sm text-muted-foreground">Horizontal or longer videos will appear here, separate from Reels.</p><Link to="/create" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Upload a Video</Link></div>;

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <header className="flex items-center gap-3">
        <Link to="/explore" aria-label="Back to Explore" className="rounded-full border p-2"><ArrowLeft className="h-4 w-4" /></Link>
        <div><h1 className="text-xl font-bold">Videos</h1><p className="text-xs text-muted-foreground">Widescreen and long-form creator videos</p></div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-2xl border bg-black">
            <div className="aspect-video">
              {active?.mediaSrc && <video key={active.id} src={active.mediaSrc} poster={active.thumbnailSrc} controls playsInline onPlay={() => { if (user?.id) void recordUserMediaPostView(active.id); }} className="h-full w-full object-contain" />}
            </div>
            <div className="space-y-2 p-4">
              <h2 className="font-semibold">{active?.caption || "NEXORA Video"}</h2>
              {active && <VideoCreatorFollow ownerId={active.user_id} profile={creatorProfiles[active.user_id ?? ""]} isSelf={user?.id === active.user_id} />}
              {user?.id && active?.user_id === user.id && <Link to="/dashboard" search={{ postId: active.id }} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold text-primary"><BarChart3 className="h-3.5 w-3.5" /> View insights</Link>}
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" /> {Number(active?.view_count ?? 0).toLocaleString()} views · {Number(active?.like_count ?? 0).toLocaleString()} likes · {Number(active?.comment_count ?? 0).toLocaleString()} comments · {Number(active?.share_count ?? 0).toLocaleString()} shares · {active?.duration_seconds ? `${Math.floor(active.duration_seconds / 60)}:${String(active.duration_seconds % 60).padStart(2, "0")}` : "Duration unavailable"}</p>
              {active && <div className="flex flex-wrap gap-2 border-t pt-3">
                <button type="button" onClick={() => void toggleLike(active.id)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${liked.includes(active.id) ? "border-primary text-primary" : ""}`}><Heart className={`h-4 w-4 ${liked.includes(active.id) ? "fill-current" : ""}`} /> {Number(likeCounts[active.id] ?? active.like_count ?? 0).toLocaleString()} Like</button>
                <button type="button" onClick={() => void shareVideo()} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm"><Share2 className="h-4 w-4" /> Share</button>
                <button type="button" onClick={() => void repostVideo(active.id)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${reposted.includes(active.id) ? "text-emerald-600" : ""}`}><Repeat2 className="h-4 w-4" /> Repost</button>
                <button type="button" onClick={() => void toggleSave(active.id)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${saved.includes(active.id) ? "text-amber-600" : ""}`}><Bookmark className="h-4 w-4" /> {saved.includes(active.id) ? "Saved" : "Save"}</button>
                <button type="button" onClick={downloadVideo} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm"><Download className="h-4 w-4" /> Download</button>
              </div>}
            </div>
          </div>
          <h2 className="text-sm font-semibold">Up next · {items.length}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.filter((item) => item.id !== active?.id).map((item) => (
              <button key={item.id} type="button" onClick={() => setActiveId(item.id)} className="flex min-w-0 gap-3 rounded-xl border p-2 text-left transition hover:bg-muted/50">
                <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-black">
                  {item.thumbnailSrc ? <img src={item.thumbnailSrc} alt="" className="h-full w-full object-cover" /> : item.mediaSrc ? <video src={item.mediaSrc} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : null}
                  <Play className="absolute bottom-2 right-2 h-4 w-4 fill-white text-white" />
                </div>
                <span className="line-clamp-3 min-w-0 text-sm font-medium">{item.caption || "NEXORA Video"}</span>
              </button>
            ))}
            {items.length === 1 && <p className="text-sm text-muted-foreground">No other Videos to play next.</p>}
          </div>
        </section>
        <aside className="space-y-3 rounded-2xl border p-3">
          <h2 className="font-semibold">Video library</h2>
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => setActiveId(item.id)} aria-pressed={active?.id === item.id} className={`flex w-full gap-3 rounded-lg p-2 text-left ${active?.id === item.id ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted"}`}>
              <span className="grid h-12 w-20 shrink-0 place-items-center overflow-hidden rounded bg-black">{item.thumbnailSrc ? <img src={item.thumbnailSrc} alt="" className="h-full w-full object-cover" /> : <Play className="h-5 w-5 text-white" />}</span>
              <span className="line-clamp-2 text-xs font-medium">{item.caption || "Untitled Video"}</span>
            </button>
          ))}
        </aside>
      </div>
    </main>
  );
}

function VideoCreatorFollow({ ownerId, profile, isSelf }: { ownerId: string | null; profile?: { display_name: string | null; handle: string; avatar_url: string | null; private_profile: boolean }; isSelf: boolean }) {
  const social = useSocialGraph(ownerId ?? undefined);
  if (!ownerId) return null;
  const label = profile?.display_name || profile?.handle || "NEXORA Creator";
  return <div className="flex items-center gap-3">
    <Link to={profile?.handle ? "/profile/$handle" : "/explore"} params={profile?.handle ? { handle: profile.handle } : undefined} className="flex min-w-0 items-center gap-2">
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-muted font-semibold">{label.slice(0,1).toUpperCase()}</span>}
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">@{profile?.handle || "creator"}</span></span>
    </Link>
    {!isSelf && <button type="button" disabled={social.loading} onClick={() => void social.toggleFollow()} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">{social.isFollowing ? "Following" : "Follow"}</button>}
  </div>;
}
