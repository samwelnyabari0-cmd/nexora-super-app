import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format-relative-time";

type NewsVertical = "world" | "kenya";
type NewsRow = {
  provider: string;
  provider_id: string;
  source_name: string;
  headline: string;
  summary: string | null;
  source_url: string;
  published_at: string;
};
type NewsItem = NewsRow & { vertical: NewsVertical };
type NewsQuery = {
  select: (columns: string) => NewsQuery;
  in: (column: string, values: string[]) => NewsQuery;
  eq: (column: string, value: unknown) => NewsQuery;
  order: (column: string, options?: { ascending?: boolean }) => NewsQuery;
  limit: (count: number) => Promise<{
    data: NewsRow[] | null;
    error: { message: string } | null;
  }>;
};

const NEWS_PROVIDERS = [
  "world-bbc-rss",
  "world-aljazeera-rss",
  "world-dw-rss",
  "kenya-bbc-africa-rss",
  "kenya-google-news-rss",
];

function verticalForProvider(provider: string): NewsVertical {
  return provider.startsWith("kenya-") ? "kenya" : "world";
}

function validPublisherUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function shareHeadline(item: NewsItem) {
  const shareUrl = item.source_url;
  const shareText = item.headline + " — " + item.source_name;
  try {
    if (navigator.share) {
      await navigator.share({
        title: item.headline,
        text: shareText,
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(shareText + "\n" + shareUrl);
    }
  } catch (error) {
    if (error instanceof Error && error.name !== "AbortError") {
      try {
        await navigator.clipboard.writeText(shareText + "\n" + shareUrl);
      } catch {
        console.error("Could not share news headline", error);
      }
    }
  }
}

export function WorldNewsPanel({
  variant = "full",
  maxItems = 30,
}: {
  variant?: "briefing" | "full";
  maxItems?: number;
}) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | NewsVertical>("all");
  const [liteMode, setLiteMode] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const loadNews = async () => {
      const query = (
        supabase as unknown as {
          from: (table: string) => NewsQuery;
        }
      ).from("football_announcements");
      const { data, error: queryError } = await query
        .select("provider,provider_id,source_name,headline,summary,source_url,published_at")
        .in("provider", NEWS_PROVIDERS)
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(60);

      if (!active) return;
      if (queryError) {
        console.error("World news could not load:", queryError.message);
        setError(true);
        setItems([]);
      } else {
        setError(false);
        setItems(
          (data ?? []).map((item) => ({
            ...item,
            vertical: verticalForProvider(item.provider),
          })),
        );
      }
      setLoading(false);
    };

    void loadNews();
    const refreshInterval = window.setInterval(() => void loadNews(), 15 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, []);

  const visible = useMemo(
    () =>
      items
        .filter((item) => filter === "all" || item.vertical === filter)
        .slice(0, variant === "briefing" ? 5 : maxItems),
    [items, filter, maxItems, variant],
  );

  return (
    <section className="space-y-3" aria-label="World and Kenya news">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Globe2 className="h-4 w-4 text-primary" />
            {variant === "briefing" ? "Morning Briefing" : "World Daily News"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {variant === "briefing"
              ? "Top 5 headlines · a quick 60-second scan"
              : "Publisher headlines from around the world and Kenya"}
          </p>
        </div>
        {variant === "full" && (
          <button
            type="button"
            onClick={() => setLiteMode((value) => !value)}
            aria-pressed={liteMode}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold"
          >
            {liteMode ? "Lite reader on" : "Lite reader off"}
          </button>
        )}
      </div>

      {variant === "full" && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="News region">
          {(["all", "world", "kenya"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={
                filter === value
                  ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  : "rounded-full border bg-card px-3 py-1.5 text-xs font-semibold"
              }
            >
              {value === "all" ? "All news" : value === "world" ? "World" : "Kenya"}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          Loading publisher headlines…
        </p>
      ) : error ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          News is temporarily unavailable. Try again shortly.
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          No recent headlines yet. The next RSS sync runs automatically.
        </p>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {visible.map((item) => (
            <article
              key={item.provider + ":" + item.provider_id}
              className="flex items-start gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-primary">
                    {item.vertical === "kenya" ? "KENYA" : "WORLD"}
                  </span>
                  <span>{item.source_name}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={item.published_at}>
                    {formatRelativeTime(item.published_at)}
                  </time>
                </div>
                {validPublisherUrl(item.source_url) ? (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm font-semibold leading-snug hover:text-primary"
                  >
                    {item.headline}
                  </a>
                ) : (
                  <p className="text-sm font-semibold">{item.headline}</p>
                )}
                {!liteMode && item.summary && (
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {item.summary}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3">
                  {validPublisherUrl(item.source_url) && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
                    >
                      Read at publisher <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void shareHeadline(item)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"
                  >
                    <Share2 className="h-3 w-3" /> Share headline
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
