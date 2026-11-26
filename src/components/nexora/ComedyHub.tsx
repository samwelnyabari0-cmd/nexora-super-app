import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Laugh, Play, Share2, MessageCircle, Clapperboard, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format-relative-time";

type ComedyJoke = {
  id: string;
  provider: string;
  source_name: string;
  headline: string;
  summary: string | null;
  thumbnail_url: string | null;
  source_url: string;
  published_at: string;
};
type ComedyVideo = {
  id: string;
  provider_id: string;
  match_label: string;
  source_name: string;
  thumbnail_url: string | null;
  video_url: string;
  published_at: string;
};
type CommunityComedyPost = {
  id: string;
  author_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  tags: string[] | null;
  created_at: string;
};

function youtubeId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1);
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      return url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] || "";
    }
  } catch { /* Invalid source URL. */ }
  return "";
}

function uniqueComedyVideos(rows: ComedyVideo[]): ComedyVideo[] {
  const seen = new Set<string>();
  return rows.filter((video) => {
    const key = youtubeId(video.video_url) || video.provider_id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ComedyVideoCard({ video }: { video: ComedyVideo }) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(video.video_url);
  if (!id) return null;
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe className="h-full w-full" src={"https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&enablejsapi=1&origin=" + encodeURIComponent(window.location.origin)}
            title={video.match_label} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        ) : (
          <>
            <img src={video.thumbnail_url || "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"} alt={video.match_label}
              loading="lazy" className="h-full w-full object-cover" />
            <button type="button" onClick={() => setPlaying(true)} aria-label={"Play " + video.match_label}
              className="absolute inset-0 grid place-items-center bg-black/15 hover:bg-black/30">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-black/75 text-white ring-1 ring-white/50"><Play className="ml-1 h-6 w-6 fill-current" /></span>
              <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white">Play comedy video</span>
            </button>
          </>
        )}
      </div>
      <div className="space-y-1.5 p-3.5">
        <p className="text-[11px] font-semibold text-primary">{video.source_name} · {formatRelativeTime(video.published_at)}</p>
        <h3 className="line-clamp-2 text-sm font-bold">{video.match_label}</h3>
      </div>
    </article>
  );
}

function JokeCard({ joke }: { joke: ComedyJoke }) {
  const message = [joke.headline, joke.summary, "Shared from Nexora Comedy"].filter(Boolean).join("\n\n");
  const whatsappUrl = "https://wa.me/?text=" + encodeURIComponent(message);
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border bg-card p-4">
      {joke.thumbnail_url && <img src={joke.thumbnail_url} alt="" loading="lazy" className="mb-3 max-h-64 w-full rounded-xl object-cover" />}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Laugh className="h-3.5 w-3.5 text-primary" /><span className="font-semibold text-primary">{joke.source_name}</span>
        <span aria-hidden="true">·</span><time dateTime={joke.published_at}>{formatRelativeTime(joke.published_at)}</time>
      </div>
      <h3 className="mt-2 text-sm font-bold leading-snug">{joke.headline}</h3>
      {joke.summary && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{joke.summary}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-2 text-xs font-semibold text-[#168b45]">
          <Share2 className="h-3.5 w-3.5" /> Share on WhatsApp
        </a>
        <a href={joke.source_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-muted-foreground hover:text-primary">Source</a>
      </div>
    </article>
  );
}

function CommunityComedyCard({ post }: { post: CommunityComedyPost }) {
  const message = [post.caption || "A Nexora community joke", "Shared from Nexora Comedy"].join("\n\n");
  const whatsappUrl = "https://wa.me/?text=" + encodeURIComponent(message);
  const isVideo = Boolean(post.media_url && post.media_type?.toLowerCase().startsWith("video"));
  const isImage = Boolean(post.media_url && post.media_type?.toLowerCase().startsWith("image"));
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      {isVideo && <video src={post.media_url!} controls playsInline preload="metadata" className="max-h-72 w-full bg-black object-contain" />}
      {isImage && <img src={post.media_url!} alt={post.caption || "Nexora community meme"} loading="lazy" className="max-h-72 w-full object-cover" />}
      <div className="space-y-2 p-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.caption || "Community comedy post"}</p>
        <div className="flex flex-wrap gap-1.5">{(post.tags ?? []).filter((tag) => ["comedy", "meme", "skit", "joke"].includes(tag.toLowerCase())).map((tag) => <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">#{tag}</span>)}</div>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-2 text-xs font-semibold text-[#168b45]">
          <Share2 className="h-3.5 w-3.5" /> Share on WhatsApp
        </a>
      </div>
    </article>
  );
}

export function ComedyHub() {
  const [jokes, setJokes] = useState<ComedyJoke[]>([]);
  const [videos, setVideos] = useState<ComedyVideo[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityComedyPost[]>([]);
  const [section, setSection] = useState<"videos" | "lite">("videos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [jokeResult, videoResult, communityResult] = await Promise.all([
        (supabase as any).from("football_announcements")
          .select("id,provider,source_name,headline,summary,thumbnail_url,source_url,published_at")
          .in("provider", ["comedy-jokeapi", "comedy-dadjokes", "comedy-reddit"])
          .eq("is_published", true).order("published_at", { ascending: false }).limit(60),
        (supabase as any).from("football_highlights")
          .select("id,provider_id,match_label,source_name,thumbnail_url,video_url,published_at")
          .eq("provider", "youtube-comedy").eq("is_published", true)
          .order("published_at", { ascending: false }).limit(72),
        (supabase as any).from("posts")
          .select("id,author_id,caption,media_url,media_type,tags,created_at")
          .eq("audience", "public").overlaps("tags", ["comedy", "meme", "skit", "joke"])
          .order("created_at", { ascending: false }).limit(40),
      ]);
      if (!active) return;
      if (!jokeResult.error) setJokes((jokeResult.data ?? []) as ComedyJoke[]);
      else console.warn("Comedy text feed unavailable:", jokeResult.error.message);
      if (!videoResult.error) setVideos(uniqueComedyVideos((videoResult.data ?? []) as ComedyVideo[]));
      else console.warn("Comedy video feed unavailable:", videoResult.error.message);
      if (!communityResult.error) setCommunityPosts((communityResult.data ?? []) as CommunityComedyPost[]);
      else console.warn("Nexora community comedy posts unavailable:", communityResult.error.message);
      setLoading(false);
    };
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(refresh, 15 * 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const contentCount = useMemo(() => section === "videos" ? videos.length : jokes.length + communityPosts.length, [section, videos.length, jokes.length, communityPosts.length]);

  return (
    <section aria-label="Comedy, memes and skits" className="min-w-0 space-y-4">
      <header className="overflow-hidden rounded-2xl border bg-gradient-to-br from-fuchsia-950 via-purple-950 to-slate-950 p-4 text-white sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><Laugh className="h-6 w-6" /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">Nexora Comedy</p>
            <h2 className="text-xl font-black sm:text-2xl">Comedy, Memes & Skits</h2>
            <p className="mt-1 text-xs text-white/70">Short laughs, skits and lightweight jokes for Lite Mode</p>
          </div>
        </div>
        <Link to="/create" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-purple-950">
          <Clapperboard className="h-4 w-4" /> Share your skit
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Comedy content type">
        <button type="button" onClick={() => setSection("videos")} aria-pressed={section === "videos"}
          className={section === "videos" ? "flex items-center gap-2 rounded-xl border border-primary bg-primary/10 p-3 text-left text-sm font-bold" : "flex items-center gap-2 rounded-xl border bg-card p-3 text-left text-sm font-semibold"}>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted"><Clapperboard className="h-4 w-4" /></span>
          <span>Skits & Shorts</span>
        </button>
        <button type="button" onClick={() => setSection("lite")} aria-pressed={section === "lite"}
          className={section === "lite" ? "flex items-center gap-2 rounded-xl border border-primary bg-primary/10 p-3 text-left text-sm font-bold" : "flex items-center gap-2 rounded-xl border bg-card p-3 text-left text-sm font-semibold"}>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted"><MessageCircle className="h-4 w-4" /></span>
          <span>Jokes & Memes</span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{section === "videos" ? "Tap a preview to play with controls." : "Text-first cards use very little mobile data."}</p>
        <span className="text-xs font-semibold text-muted-foreground">{contentCount} items</span>
      </div>
      {loading ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">Loading Comedy…</p> : section === "videos" ? (
        videos.length ? <div className="grid min-w-0 gap-4 sm:grid-cols-2">{videos.map((video) => <ComedyVideoCard key={video.provider_id} video={video} />)}</div>
          : <div className="rounded-xl border p-6 text-center"><Sparkles className="mx-auto mb-2 h-7 w-7 text-primary" /><p className="text-sm font-semibold">Comedy videos are on the way</p><p className="mt-1 text-xs text-muted-foreground">New channel videos appear here after the scheduled feed sync.</p></div>
      ) : jokes.length || communityPosts.length ? (
        <div className="space-y-5">
          {jokes.length > 0 && <div className="grid min-w-0 gap-3 sm:grid-cols-2">{jokes.map((joke) => <JokeCard key={joke.provider + ":" + joke.id} joke={joke} />)}</div>}
          {communityPosts.length > 0 && <div className="space-y-3">
            <div><h3 className="text-sm font-bold">Nexora community jokes & memes</h3><p className="text-xs text-muted-foreground">Public posts tagged #comedy, #meme, #skit or #joke</p></div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">{communityPosts.map((post) => <CommunityComedyCard key={post.id} post={post} />)}</div>
          </div>}
          <p className="text-xs text-muted-foreground">Share your own post with #comedy, #meme, #skit or #joke to add it to this community stream.</p>
        </div>
      ) : <p className="rounded-xl border p-4 text-sm text-muted-foreground">No jokes are available right now. Check back after the next sync.</p>}
    </section>
  );
}
