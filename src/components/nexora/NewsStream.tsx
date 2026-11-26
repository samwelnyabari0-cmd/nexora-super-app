import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Newspaper, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format-relative-time";

export type NewsStory = {
  id: string;
  provider: string;
  provider_id: string;
  source_name: string;
  headline: string;
  summary: string | null;
  thumbnail_url: string | null;
  source_url: string;
  published_at: string;
  category: string;
};

const NEWS_PROVIDERS = [
  "sky-sports-rss", "espn-sports-rss", "bbc-sport-rss",
  "world-bbc-rss", "world-aljazeera-rss", "world-dw-rss", "kenya-bbc-africa-rss",
  "kenya-google-news-rss", "politics-bbc-rss", "business-bbc-rss",
  "entertainment-bbc-rss", "science-bbc-rss", "health-bbc-rss",
  "kenya-politics-google-news-rss", "kenya-sports-google-news-rss",
  "kenya-business-google-news-rss", "kenya-entertainment-google-news-rss",
  "trending-google-news-rss", "tech-rss",
];

function categoryForProvider(provider: string) {
  if (provider.includes("sport")) return "Sports";
  if (provider.includes("politics")) return "Politics";
  if (provider.includes("business")) return "Business";
  if (provider.includes("entertainment")) return "Entertainment";
  if (provider.includes("science")) return "Science";
  if (provider.includes("health")) return "Health";
  if (provider.includes("trending")) return "Trending";
  if (provider === "tech-rss") return "Technology";
  if (provider.startsWith("kenya-")) return "Kenya";
  return "World";
}

function validHttps(value: string | null | undefined) {
  if (!value) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export function useNewsStories(limit = 80) {
  const [stories, setStories] = useState<NewsStory[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from("football_announcements")
        .select("id,provider,provider_id,source_name,headline,summary,thumbnail_url,source_url,published_at")
        .in("provider", NEWS_PROVIDERS)
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(limit);
      if (!active) return;
      if (error) {
        console.error("Could not load Nexora news:", error.message);
        return;
      }
      setStories((data ?? []).map((row: Omit<NewsStory, "category">) => ({
        ...row, category: categoryForProvider(row.provider),
      })));
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
  }, [limit]);
  return stories;
}

export function NewsStoryCard({ story }: { story: NewsStory }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = story.headline + " — " + story.source_name + "\n" + story.source_url;
    try {
      if (navigator.share) await navigator.share({ title: story.headline, text, url: story.source_url });
      else { await navigator.clipboard.writeText(text); setCopied(true); }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* Clipboard unavailable. */ }
      }
    }
  };
  return (
    <article className="group min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary/20 via-muted to-cyan-500/10">
        {validHttps(story.thumbnail_url) && !imageFailed ? (
          <img src={story.thumbnail_url!} alt={story.headline} loading="lazy" decoding="async"
            referrerPolicy="no-referrer" onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center"><Newspaper className="h-10 w-10 text-primary/60" /></div>
        )}
        <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
          {story.category}
        </span>
      </div>
      <div className="space-y-2 p-3.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-primary">{story.source_name}</span><span aria-hidden="true">·</span>
          <time dateTime={story.published_at}>{formatRelativeTime(story.published_at)}</time>
        </div>
        <h3 className="line-clamp-2 text-sm font-bold leading-snug">{story.headline}</h3>
        {story.summary && <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{story.summary}</p>}
        <div className="flex flex-wrap items-center gap-4 pt-1">
          {validHttps(story.source_url) ? (
            <a href={story.source_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Read full story <ExternalLink className="h-3 w-3" />
            </a>
          ) : <span className="text-[11px] text-muted-foreground">Publisher link unavailable</span>}
          <button type="button" onClick={() => void share()} aria-label="Share news story"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary">
            <Share2 className="h-3 w-3" /> {copied ? "Copied" : "Share"}
          </button>
        </div>
      </div>
    </article>
  );
}

const CATEGORIES = ["All", "Trending", "Kenya", "World", "Sports", "Politics", "Business", "Entertainment", "Technology", "Science", "Health"];

export function NewsStream({ limit = 24, showFilters = true }: { limit?: number; showFilters?: boolean }) {
  const stories = useNewsStories(100);
  const [category, setCategory] = useState("All");
  const visible = useMemo(() => stories.filter((story) => category === "All" || story.category === category).slice(0, limit), [stories, category, limit]);
  if (!stories.length) return <p className="rounded-xl border p-4 text-sm text-muted-foreground">News updates are temporarily unavailable. Please check again shortly.</p>;
  return (
    <section aria-label="Latest news across categories" className="min-w-0 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Nexora News</p>
        <h2 className="text-lg font-bold">What's happening</h2>
        <p className="text-xs text-muted-foreground">Sports, politics, business, entertainment, technology and more</p>
      </div>
      {showFilters && <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter news by category">
        {CATEGORIES.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item}
          className={category === item ? "shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground" : "shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold"}>
          {item}
        </button>)}
      </div>}
      {visible.length ? <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {visible.map((story) => <NewsStoryCard key={story.provider + ":" + story.provider_id} story={story} />)}
      </div> : <p className="rounded-xl border p-4 text-sm text-muted-foreground">No recent {category.toLowerCase()} stories are available yet.</p>}
    </section>
  );
}
