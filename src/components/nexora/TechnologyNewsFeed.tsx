import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format-relative-time";

export type TechnologyNewsStory = {
  id: string;
  source_name: string;
  headline: string;
  summary: string;
  thumbnail_url: string | null;
  source_url: string;
  published_at: string;
};

export function useTechnologyNews(limit = 8) {
  const [stories, setStories] = useState<TechnologyNewsStory[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from("football_announcements")
        .select("id,source_name,headline,summary,thumbnail_url,source_url,published_at")
        .eq("provider", "tech-rss")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(limit);

      if (!active) return;
      if (error) {
        console.error("Could not load technology news:", error.message);
        return;
      }
      setStories((data ?? []) as TechnologyNewsStory[]);
    };

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30 * 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [limit]);

  return stories;
}

export function TechnologyNewsCard({ story }: { story: TechnologyNewsStory }) {
  const [imageFailed, setImageFailed] = useState(false);
  const safeUrl = (() => {
    try {
      return new URL(story.source_url).protocol === "https:" ? story.source_url : "";
    } catch {
      return "";
    }
  })();

  return (
    <article className="group min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-indigo-500/20 via-muted to-cyan-500/10">
        {story.thumbnail_url && !imageFailed ? (
          <img
            src={story.thumbnail_url}
            alt={story.headline}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Newspaper className="h-10 w-10 text-primary/60" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
          Technology
        </span>
      </div>
      <div className="space-y-2 p-3.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-primary">{story.source_name}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={story.published_at}>{formatRelativeTime(story.published_at)}</time>
        </div>
        <h3 className="line-clamp-2 text-sm font-bold leading-snug">{story.headline}</h3>
        {story.summary && (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{story.summary}</p>
        )}
        {safeUrl ? (
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-primary hover:underline"
          >
            Read full story <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="pt-1 text-[11px] text-muted-foreground">Publisher link unavailable</p>
        )}
      </div>
    </article>
  );
}

export function TechnologyNewsFeed({ limit = 6 }: { limit?: number }) {
  const stories = useTechnologyNews(limit);
  if (!stories.length) return null;

  return (
    <section aria-label="Technology news" className="min-w-0 space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Latest stories</p>
          <h2 className="text-lg font-bold">Technology News</h2>
          <p className="text-xs text-muted-foreground">Headlines, context and updates from trusted publishers</p>
        </div>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {stories.map((story) => <TechnologyNewsCard key={story.id} story={story} />)}
      </div>
    </section>
  );
}
