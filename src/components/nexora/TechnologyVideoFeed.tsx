import { useEffect, useState } from "react";
import { Cpu, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format-relative-time";

export type TechnologyCreatorVideo = {
  id: string;
  provider_id: string;
  match_label: string;
  source_name: string;
  thumbnail_url: string | null;
  published_at: string;
};

export function useTechnologyCreatorVideos(limit = 12) {
  const [videos, setVideos] = useState<TechnologyCreatorVideo[]>([]);
  useEffect(() => {
    let active = true;
    void (supabase as any).from("football_highlights")
      .select("id,provider_id,match_label,source_name,thumbnail_url,published_at")
      .eq("provider", "youtube-tech")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(limit)
      .then(({ data, error }: { data: TechnologyCreatorVideo[] | null; error: { message: string } | null }) => {
        if (!active) return;
        if (error) {
          console.error("Could not load technology creator videos:", error.message);
          setVideos([]);
        } else {
          setVideos(data ?? []);
        }
      });
    return () => { active = false; };
  }, [limit]);
  return videos;
}

export function TechnologyVideoCard({ video }: { video: TechnologyCreatorVideo }) {
  const [playing, setPlaying] = useState(false);
  const embedUrl = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(video.provider_id) + "?autoplay=1&rel=0";
  const thumbnail = video.thumbnail_url || "https://i.ytimg.com/vi/" + encodeURIComponent(video.provider_id) + "/hqdefault.jpg";
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary"><Cpu className="h-3.5 w-3.5" /> Technology pick</span>
        <span className="truncate text-[11px] text-muted-foreground">{video.source_name}</span>
      </div>
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe title={video.match_label} src={embedUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen className="h-full w-full" />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={"Play " + video.match_label} className="group relative h-full w-full">
            <img src={thumbnail} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
            <span className="absolute inset-0 grid place-items-center bg-black/20 transition group-hover:bg-black/35">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"><Play className="h-6 w-6 fill-current" /></span>
            </span>
          </button>
        )}
      </div>
      <div className="space-y-1.5 p-3.5">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug">{video.match_label}</h3>
        <p className="text-[11px] text-muted-foreground">{video.source_name} · {formatRelativeTime(video.published_at)}</p>
        <a href={"https://www.youtube.com/watch?v=" + encodeURIComponent(video.provider_id)} target="_blank" rel="noopener noreferrer" className="inline-flex text-xs font-semibold text-primary">Watch on YouTube</a>
      </div>
    </article>
  );
}

export function TechnologyVideoShelf({ limit = 4 }: { limit?: number }) {
  const videos = useTechnologyCreatorVideos(limit);
  if (!videos.length) return null;
  return (
    <section aria-label="Technology creator videos" className="min-w-0 space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">From the technology community</p>
        <h2 className="text-lg font-bold">Tech & Creator Videos</h2>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {videos.map((video) => <TechnologyVideoCard key={video.id} video={video} />)}
      </div>
    </section>
  );
}
