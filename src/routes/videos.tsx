import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Play, Video, ArrowLeft, BarChart3, Heart, Share2, Repeat2, Bookmark,
  Download, Eye, Search, House, Music2, Trophy, Clapperboard, Tv, Radio,
  ListVideo, Gamepad2, GraduationCap, Newspaper, Cpu, Laugh, MessageCircle,
} from "lucide-react";
import { useStrictMediaItems } from "@/components/nexora/StrictMediaFeed";
import { useSession } from "@/lib/session";
import { profilePathForUser } from "@/lib/profile-navigation";
import { recordUserMediaPostView } from "@/lib/post-views";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSocialGraph } from "@/features/social/useSocialGraph";
import { MediaComments } from "@/components/nexora/MediaComments";
import { formatRelativeTime, formatExactDateTime } from "@/lib/format-relative-time";
import { saveCommuteMedia } from "@/lib/offline-storage";

const categories = [
  { label: "Home", icon: House, terms: [] as string[] },
  { label: "Music", icon: Music2, terms: ["music", "song", "audio", "concert", "beat", "dj", "afrobeats", "gospel", "hip hop", "rap"] },
  { label: "Gaming", icon: Gamepad2, terms: ["game", "gaming", "gamer", "gameplay", "playstation", "xbox", "nintendo", "esports", "minecraft", "fortnite", "pubg", "free fire"] },
  { label: "Sports", icon: Trophy, terms: ["sport", "football", "soccer", "basketball", "rugby", "tennis", "match", "goal", "fitness"] },
  { label: "Movies", icon: Clapperboard, terms: ["movie", "film", "cinema", "trailer", "short film"] },
  { label: "Series & Shows", icon: Tv, terms: ["series", "episode", "show", "season", "drama", "comedy", "documentary"] },
  { label: "Education", icon: GraduationCap, terms: ["learn", "lesson", "tutorial", "education", "course", "study", "how to", "explained", "school"] },
  { label: "News", icon: Newspaper, terms: ["news", "breaking", "politics", "update", "report", "headline", "current affairs"] },
  { label: "Technology", icon: Cpu, terms: ["tech", "technology", "ai", "artificial intelligence", "software", "gadget", "phone", "review", "coding"] },
  { label: "Comedy", icon: Laugh, terms: ["comedy", "funny", "humor", "prank", "skit", "joke", "memes"] },
] as const;

export const Route = createFileRoute("/videos")({
  validateSearch: (search: Record<string, unknown>) => ({
    post: typeof search.post === "string" ? search.post : undefined,
  }),
  head: () => ({ meta: [{ title: "Videos — NEXORA" }, { name: "description", content: "Discover, search and watch videos on NEXORA." }] }),
  component: Videos,
});

function Videos() {
  const { items, loading, error } = useStrictMediaItems("video");
  const { user } = useSession();
  const navigate = useNavigate({ from: "/videos" });
  const { post: requestedPostId } = Route.useSearch();
  const [activeId, setActiveId] = useState<string | null>(requestedPostId ?? null);
  const [searchText, setSearchText] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [category, setCategory] = useState<string>("Home");
  const [liked, setLiked] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [reposted, setReposted] = useState<string[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, { display_name: string | null; handle: string; avatar_url: string | null; private_profile: boolean }>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [savingOffline, setSavingOffline] = useState(false);

  useEffect(() => {
    setActiveId(requestedPostId ?? null);
  }, [requestedPostId]);

  useEffect(() => {
    let mounted = true;
    if (!user?.id) return;
    void Promise.all([
      supabase.rpc("get_my_liked_user_media_posts"),
      (supabase as any).from("user_media_post_saves").select("post_id").eq("user_id", user.id),
      supabase.rpc("get_my_reposted_user_media_posts"),
      (supabase as any).rpc("get_discoverable_profiles", { p_query: null, p_limit: 60 }),
    ]).then(([likes, saves, reposts, profiles]) => {
      if (!mounted) return;
      if (!likes.error) setLiked((likes.data ?? []) as string[]);
      if (!saves.error) setSaved((saves.data ?? []).map((row: { post_id: string }) => row.post_id));
      if (!reposts.error) setReposted((reposts.data ?? []) as string[]);
      if (!profiles.error) {
        const next: typeof creatorProfiles = {};
        for (const profile of profiles.data ?? []) next[profile.id] = profile;
        setCreatorProfiles(next);
      }
    });
    return () => { mounted = false; };
  }, [user?.id]);

  const active = items.find((item) => item.id === activeId) ?? null;
  const normalizedSearch = submittedSearch.trim().toLowerCase();
  const filteredItems = useMemo(() => items.filter((item) => {
    const text = (item.caption ?? "").toLowerCase();
    const matchesSearch = !normalizedSearch || text.includes(normalizedSearch);
    const selected = categories.find((entry) => entry.label === category);
    const matchesCategory = !selected || selected.terms.length === 0 || selected.terms.some((term) => text.includes(term));
    return matchesSearch && matchesCategory;
  }), [items, normalizedSearch, category]);

  const recommendations = useMemo(() => {
    if (!active) return [];
    const words = (active.caption ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
    return items.filter((item) => item.id !== active.id)
      .map((item) => {
        const caption = (item.caption ?? "").toLowerCase();
        const score = words.reduce((total, word) => total + (caption.includes(word) ? 1 : 0), 0);
        return { item, score };
      })
      .sort((a, b) => b.score - a.score || new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime())
      .slice(0, 12)
      .map(({ item }) => item);
  }, [active, items]);

  async function openVideo(postId: string) {
    setActiveId(postId);
    await navigate({ to: "/videos", search: { post: postId }, replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function backToVideos() {
    setActiveId(null);
    await navigate({ to: "/videos", search: { post: undefined }, replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
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
    } catch (shareError) { if ((shareError as Error).name !== "AbortError") toast.error("Could not share video."); }
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

  async function saveActiveOffline() {
    if (!active?.mediaSrc) return toast.error("Video file is unavailable.");
    setSavingOffline(true);
    try {
      const result = await saveCommuteMedia({
        id: active.id,
        title: active.caption || "NEXORA Video",
        mediaUrl: active.mediaSrc,
        thumbnailUrl: active.thumbnailSrc ?? null,
        mediaType: "video",
        contentType: "video",
      });
      window.dispatchEvent(new Event("nexora:offline-pack-updated"));
      toast.success("Saved to your Daily Commute Pack (" + (result.item.sizeBytes / 1048576).toFixed(1) + " MB).");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not save this video offline.");
    } finally {
      setSavingOffline(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading Videos…</div>;
  if (error) return <div role="alert" className="py-16 text-center text-sm text-muted-foreground">{error}</div>;
  if (!items.length) return <div className="mx-auto max-w-md py-16 text-center"><Video className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><h1 className="font-semibold">No Videos yet</h1><p className="mt-1 text-sm text-muted-foreground">Videos uploaded to NEXORA will appear here.</p><Link to="/create" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Upload a Video</Link></div>;

  if (activeId && !active) return <div className="mx-auto max-w-5xl py-12"><button onClick={() => void backToVideos()} className="mb-5 inline-flex items-center gap-2 text-sm font-medium"><ArrowLeft className="h-4 w-4" /> Back to Videos</button><p className="text-sm text-muted-foreground">This video is unavailable or you do not have permission to view it.</p></div>;

  if (active) return (
    <main className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <button onClick={() => void backToVideos()} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium"><ArrowLeft className="h-4 w-4" /> Videos</button>
        <Link to="/videos" className="text-lg font-black tracking-tight">NEXORA <span className="text-primary">Videos</span></Link>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-xl bg-black">
            <div className="aspect-video">
              {active.mediaSrc && <video key={active.id} src={active.mediaSrc} poster={active.thumbnailSrc} controls autoPlay muted playsInline onPlay={() => { if (user?.id) void recordUserMediaPostView(active.id); }} className="h-full w-full object-contain" />}
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-lg font-bold leading-snug md:text-xl">{active.caption || "NEXORA Video"}</h1>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <VideoCreatorFollow ownerId={active.user_id} profile={creatorProfiles[active.user_id ?? ""]} isSelf={user?.id === active.user_id} />
                {user?.id && active.user_id === user.id && <Link to="/dashboard" search={{ postId: active.id }} className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold text-primary"><BarChart3 className="h-3.5 w-3.5" /> Insights</Link>}
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" /> {Number(active.view_count ?? 0).toLocaleString()} views · <time dateTime={active.created_at} title={formatExactDateTime(active.created_at)}>{formatRelativeTime(active.created_at)}</time></p>
            </div>
            <div aria-label="Video actions" className="no-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto border-y py-3">
              <button type="button" onClick={() => void toggleLike(active.id)} className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-3 py-2 text-xs font-medium ${liked.includes(active.id) ? "text-primary" : ""}`}><Heart className={`h-4 w-4 ${liked.includes(active.id) ? "fill-current" : ""}`} /> {Number(likeCounts[active.id] ?? active.like_count ?? 0).toLocaleString()} Like</button>
              <button type="button" onClick={() => setCommentsOpen((open) => !open)} aria-label="Open comments" aria-expanded={commentsOpen} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-3 py-2 text-xs font-medium"><MessageCircle className="h-4 w-4" /> {Number(commentCounts[active.id] ?? active.comment_count ?? 0).toLocaleString()} Comments</button>
              <button type="button" onClick={() => void shareVideo()} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-3 py-2 text-xs font-medium"><Share2 className="h-4 w-4" /> Share</button>
              <button type="button" onClick={downloadVideo} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-3 py-2 text-xs font-medium"><Download className="h-4 w-4" /> Download</button>
              <button type="button" onClick={() => void saveActiveOffline()} disabled={savingOffline} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary/10 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-60"><Download className="h-4 w-4" /> {savingOffline ? "Saving…" : "Save offline"}</button>
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"><Eye className="h-4 w-4" /> {Number(active.view_count ?? 0).toLocaleString()} views</span>
              <button type="button" onClick={() => void repostVideo(active.id)} className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-3 py-2 text-xs font-medium ${reposted.includes(active.id) ? "text-emerald-600" : ""}`}><Repeat2 className="h-4 w-4" /> Repost</button>
              <button type="button" onClick={() => void toggleSave(active.id)} className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-3 py-2 text-xs font-medium ${saved.includes(active.id) ? "text-amber-600" : ""}`}><Bookmark className="h-4 w-4" /> {saved.includes(active.id) ? "Saved" : "Save"}</button>
            </div>
            <MediaComments postId={active.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} onCountChange={(count) => setCommentCounts((current) => ({ ...current, [active.id]: count }))} />
            <div className="rounded-xl bg-muted/60 p-3 text-sm">
              <p className="font-semibold">{Number(active.view_count ?? 0).toLocaleString()} views</p>
              <p className="mt-1 whitespace-pre-wrap">{active.caption || "No description added."}</p>
              <p className="mt-2 text-xs text-muted-foreground" title={formatExactDateTime(active.created_at)}>Posted {formatRelativeTime(active.created_at)}</p>
            </div>
          </div>
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-base font-bold"><ListVideo className="h-5 w-5" /> Related videos</h2>
            <div className="space-y-3">
              {recommendations.map((item) => <VideoRecommendation key={item.id} item={item} onOpen={() => void openVideo(item.id)} profile={creatorProfiles[item.user_id ?? ""]} />)}
              {!recommendations.length && <p className="text-sm text-muted-foreground">More videos will appear here as creators upload them.</p>}
            </div>
          </section>
        </section>
        <aside className="hidden space-y-3 xl:block">
          <h2 className="text-sm font-bold">Up next</h2>
          {recommendations.slice(0, 5).map((item) => <VideoRecommendation key={item.id} item={item} onOpen={() => void openVideo(item.id)} compact profile={creatorProfiles[item.user_id ?? ""]} />)}
        </aside>
      </div>
    </main>
  );

  return (
    <main className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Play className="h-5 w-5 fill-current" /></span><div><h1 className="text-xl font-black tracking-tight">NEXORA Videos</h1><p className="text-xs text-muted-foreground">Watch what moves you</p></div></div>
        <form className="flex w-full max-w-xl items-center gap-2" onSubmit={(event) => { event.preventDefault(); setSubmittedSearch(searchText); }}>
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border bg-muted/40 px-4 py-2.5"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="sr-only">Search videos</span><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search videos" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <button type="submit" aria-label="Search videos" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted hover:bg-muted/80"><Search className="h-4 w-4" /></button>
        </form>
      </header>
      <nav aria-label="Video categories" className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {categories.map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => setCategory(label)} aria-pressed={category === label} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${category === label ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80"}`}><Icon className="h-4 w-4" />{label}</button>)}
        <Link to="/live" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted px-4 py-2.5 text-sm font-semibold hover:bg-muted/80"><Radio className="h-4 w-4 text-red-500" /> Live</Link>
      </nav>
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{submittedSearch ? `Search results for “${submittedSearch}”` : category === "Home" ? "Recommended videos" : category}</h2><span className="text-xs text-muted-foreground">{filteredItems.length} videos</span></div>
      {filteredItems.length ? <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => <button key={item.id} type="button" onClick={() => void openVideo(item.id)} className="group min-w-0 text-left">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
            {item.thumbnailSrc ? <img src={item.thumbnailSrc} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" /> : item.mediaSrc ? <video src={item.mediaSrc} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Play className="h-8 w-8 text-white" /></div>}
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">{item.duration_seconds ? `${Math.floor(item.duration_seconds / 60)}:${String(item.duration_seconds % 60).padStart(2, "0")}` : "VIDEO"}</span>
            <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100"><Play className="h-12 w-12 fill-white text-white drop-shadow" /></span>
          </div>
          <div className="mt-3 flex gap-3">
            <CreatorAvatar profile={creatorProfiles[item.user_id ?? ""]} />
            <div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-sm font-semibold leading-5">{item.caption || "NEXORA Video"}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{creatorProfiles[item.user_id ?? ""]?.display_name || creatorProfiles[item.user_id ?? ""]?.handle || "NEXORA Creator"}</p><p className="mt-1 text-xs text-muted-foreground">{Number(item.view_count ?? 0).toLocaleString()} views · {formatRelativeTime(item.created_at)}</p></div>
          </div>
        </button>)}
      </div> : <div className="rounded-2xl border py-16 text-center"><Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h3 className="font-semibold">No videos found</h3><p className="mt-1 text-sm text-muted-foreground">Try another search or choose Home to browse all videos.</p><button onClick={() => { setSearchText(""); setSubmittedSearch(""); setCategory("Home"); }} className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Show all videos</button></div>}
    </main>
  );
}

function CreatorAvatar({ profile }: { profile?: { display_name: string | null; handle: string; avatar_url: string | null } }) {
  const label = profile?.display_name || profile?.handle || "NEXORA Creator";
  return profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold">{label.slice(0, 1).toUpperCase()}</span>;
}

function VideoRecommendation({ item, onOpen, profile, compact = false }: { item: { id: string; caption: string | null; thumbnailSrc?: string; mediaSrc?: string; duration_seconds: number | null; view_count: number | null; created_at: string }; onOpen: () => void; profile?: { display_name: string | null; handle: string; avatar_url: string | null }; compact?: boolean }) {
  return <button type="button" onClick={onOpen} className={`flex w-full min-w-0 gap-3 rounded-xl text-left transition hover:bg-muted/50 ${compact ? "p-1" : "p-2"}`}>
    <div className={`relative shrink-0 overflow-hidden rounded-lg bg-black ${compact ? "w-40" : "w-[42%] max-w-64"} aspect-video`}>{item.thumbnailSrc ? <img src={item.thumbnailSrc} alt="" className="h-full w-full object-cover" /> : item.mediaSrc ? <video src={item.mediaSrc} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : null}<span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px] text-white">{item.duration_seconds ? `${Math.floor(item.duration_seconds / 60)}:${String(item.duration_seconds % 60).padStart(2, "0")}` : "VIDEO"}</span></div>
    <span className="min-w-0 flex-1"><span className="line-clamp-2 block text-sm font-semibold">{item.caption || "NEXORA Video"}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{profile?.display_name || profile?.handle || "NEXORA Creator"}</span><span className="mt-1 block text-xs text-muted-foreground">{Number(item.view_count ?? 0).toLocaleString()} views · {formatRelativeTime(item.created_at)}</span></span>
  </button>;
}

function VideoCreatorFollow({ ownerId, profile, isSelf }: { ownerId: string | null; profile?: { display_name: string | null; handle: string; avatar_url: string | null; private_profile: boolean }; isSelf: boolean }) {
  const social = useSocialGraph(ownerId ?? undefined);
  if (!ownerId) return null;
  const label = profile?.display_name || profile?.handle || "NEXORA Creator";
  const profilePath = isSelf ? "/profile" : profilePathForUser(ownerId);
  const identity = (
    <span className="flex min-w-0 items-center gap-2">
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-muted font-semibold">{label.slice(0,1).toUpperCase()}</span>}
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">@{profile?.handle || "creator"}</span></span>
    </span>
  );
  return (
    <div className="flex items-center gap-3">
      {profilePath ? (
        <Link to={profilePath as any} className="flex min-w-0 items-center gap-2">{identity}</Link>
      ) : (
        <div className="flex min-w-0 items-center gap-2" aria-label="Creator profile unavailable">{identity}</div>
      )}
      {!isSelf && <button type="button" disabled={social.loading} onClick={() => void social.toggleFollow()} className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background">{social.isFollowing ? "Following" : social.isPending ? "Requested" : "Subscribe"}</button>}
    </div>
  );
}
