import { useEffect, useState } from "react";
import { ExternalLink, Laugh, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format-relative-time";

type ComedyVideo = { provider_id: string; match_label: string; source_name: string; thumbnail_url: string | null; video_url: string; published_at: string };

function getYoutubeId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1);
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) return url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] || "";
  } catch { /* Invalid publisher URL. */ }
  return "";
}

export function ComedyVideoStream({ limit = 12, title = "Comedy videos" }: { limit?: number; title?: string }) {
  const [videos, setVideos] = useState<ComedyVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await (supabase as any).from("football_highlights")
        .select("provider_id,match_label,source_name,thumbnail_url,video_url,published_at")
        .eq("provider", "youtube-comedy").eq("is_published", true)
        .order("published_at", { ascending: false }).limit(limit);
      if (!active) return;
      if (error) console.error("Could not load comedian videos:", error.message);
      setVideos((data ?? []) as ComedyVideo[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [limit]);
  if (loading) return <p className="rounded-xl border p-4 text-sm text-muted-foreground">Loading comedian videos…</p>;
  if (!videos.length) return null;
  return <section aria-label={title} className="min-w-0 space-y-3">
    <h2 className="flex items-center gap-2 text-sm font-bold"><Laugh className="h-4 w-4 text-fuchsia-500" />{title}</h2>
    <div className="space-y-4">{videos.map((video) => {
      const id = getYoutubeId(video.video_url);
      if (!id) return null;
      return <article key={video.provider_id} className="min-w-0 overflow-hidden rounded-2xl border bg-card">
        <div className="relative aspect-video bg-black">
          {playing === video.provider_id ? <iframe title={video.match_label} src={"https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&playsinline=1&rel=0"} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="h-full w-full" /> :
            <button type="button" onClick={() => setPlaying(video.provider_id)} aria-label={"Play " + video.match_label} className="absolute inset-0 h-full w-full">
              <img src={video.thumbnail_url || "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"} alt="" loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-black/15"><span className="grid h-12 w-12 place-items-center rounded-full bg-black/75 text-white"><Play className="ml-0.5 h-5 w-5 fill-current" /></span></span>
            </button>}
        </div>
        <div className="space-y-1 p-3"><p className="text-[11px] font-semibold text-fuchsia-600">{video.source_name} · {formatRelativeTime(video.published_at)}</p><h3 className="text-sm font-bold leading-snug">{video.match_label}</h3>
          <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-muted-foreground hover:text-primary">Watch on YouTube <ExternalLink className="h-3 w-3" /></a></div>
      </article>;
    })}</div>
  </section>;
}
