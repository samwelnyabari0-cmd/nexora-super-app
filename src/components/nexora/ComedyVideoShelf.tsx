import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Laugh, Play, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format-relative-time";

type ComedyFeedVideo = {
  provider_id: string;
  match_label: string;
  source_name: string;
  thumbnail_url: string | null;
  video_url: string;
  published_at: string;
};

function youtubeId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1);
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      return url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] || "";
    }
  } catch { /* Ignore malformed publisher URLs. */ }
  return "";
}

/** Loads the publisher feed only when the shelf approaches the viewport. */
export function ComedyVideoShelf({ title = "Comedy Shorts", compact = false }: { title?: string; compact?: boolean }) {
  const root = useRef<HTMLElement>(null);
  const [videos, setVideos] = useState<ComedyFeedVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element || loaded) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      setLoading(true);
      void (supabase as any).from("football_highlights")
        .select("provider_id,match_label,source_name,thumbnail_url,video_url,published_at")
        .eq("provider", "youtube-comedy")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(compact ? 4 : 8)
        .then(({ data, error }: { data: ComedyFeedVideo[] | null; error: { message: string } | null }) => {
          if (error) console.warn("Comedy video shelf unavailable:", error.message);
          else setVideos(data ?? []);
          setLoaded(true);
          setLoading(false);
        });
    }, { rootMargin: "500px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loaded, compact]);

  return (
    <section ref={root} aria-label={title} className="my-5 min-w-0 overflow-hidden rounded-2xl border bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fuchsia-500/10 text-fuchsia-600"><Laugh className="h-5 w-5" /></span>
          <div className="min-w-0"><h2 className="truncate text-sm font-bold">{title}</h2><p className="text-[11px] text-muted-foreground">Official creator videos · tap to watch</p></div>
        </div>
        <Link to="/videos" search={{ post: undefined }} className="shrink-0 text-xs font-semibold text-primary">See all</Link>
      </div>
      {loading && <p className="py-5 text-center text-xs text-muted-foreground">Loading comedy videos…</p>}
      {!loading && loaded && !videos.length && <p className="py-4 text-xs text-muted-foreground">New creator videos will appear here after the next feed sync.</p>}
      {videos.length > 0 && (
        <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-1">
          {videos.map((video) => {
            const id = youtubeId(video.video_url);
            if (!id) return null;
            const playing = playingId === video.provider_id;
            return (
              <article key={video.provider_id} className={compact ? "w-[76%] max-w-[250px] shrink-0 snap-start overflow-hidden rounded-xl border bg-background" : "w-[82%] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-xl border bg-background"}>
                <div className="relative aspect-video bg-black">
                  {playing ? (
                    <iframe className="h-full w-full" src={"https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&playsinline=1&controls=1&rel=0"}
                      title={video.match_label} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
                  ) : (
                    <button type="button" onClick={() => setPlayingId(video.provider_id)} className="absolute inset-0 grid place-items-center" aria-label={"Play " + video.match_label}>
                      <img src={video.thumbnail_url || "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"} alt={video.match_label} loading="lazy" className="h-full w-full object-cover" />
                      <span className="absolute grid h-12 w-12 place-items-center rounded-full bg-black/75 text-white ring-1 ring-white/50"><Play className="ml-0.5 h-5 w-5 fill-current" /></span>
                    </button>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <p className="truncate text-[10px] font-semibold text-fuchsia-600">{video.source_name} · {formatRelativeTime(video.published_at)}</p>
                  <h3 className="line-clamp-2 text-xs font-bold">{video.match_label}</h3>
                  <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 pt-1 text-[10px] font-semibold text-muted-foreground hover:text-primary">Watch on YouTube <ExternalLink className="h-3 w-3" /></a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
