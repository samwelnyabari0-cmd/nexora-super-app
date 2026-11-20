import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Play, AlertCircle, Film } from "lucide-react";
import { catalog } from "@/features/core/data";
import { Chip, DemoBadge, PageHeader } from "@/components/nexora/ui";
import { useSession } from "@/lib/session";
import { fetchWatchProgress, fetchWatchTitles, type WatchProgress, type WatchTitle } from "@/features/watch/data";
import { normalizeWatchCategory, resolveWatchStatus, matchesWatchCategory, watchProgressPercent, type WatchCategory } from "@/features/watch/logic";
import { WatchPlayer } from "@/features/watch/WatchPlayer";

export const Route = createFileRoute("/watch")({
  validateSearch: (search: Record<string, unknown>) => ({
    category: normalizeWatchCategory(search.category),
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Watch — NEXORA" },
      { name: "description", content: "Discover films, documentaries, series and food stories on Nexora Watch." },
      { property: "og:title", content: "Watch — NEXORA" },
      { property: "og:description", content: "Discover films, documentaries and series on Nexora Watch." },
    ],
  }),
  component: Watch,
});

type DisplayTitle = {
  id: string;
  title: string;
  category: string;
  year: number | null;
  image: string;
  length: string;
  status: "pending" | "processing" | "ready" | "unavailable";
  manifestUrl: string | null;
  progress: number;
  isDemo: boolean;
  featured: boolean;
  contentType: "single" | "series";
};

function durationLabel(seconds: number | null) {
  if (!seconds || seconds <= 0) return "Duration pending";
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

function Watch() {
  const session = useSession();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const category = search.category as WatchCategory;
  const [titles, setTitles] = useState<WatchTitle[]>([]);
  const [progress, setProgress] = useState<WatchProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [usingDemo, setUsingDemo] = useState(false);
  const [activeTitle, setActiveTitle] = useState<DisplayTitle | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    void (async () => {
      const result = await fetchWatchTitles();
      if (cancelled) return;
      if (result.error) {
        setLoadError("The live catalogue could not be reached. Showing labelled sample titles.");
        setTitles([]);
        setUsingDemo(true);
      } else {
        setTitles(result.data ?? []);
        setUsingDemo((result.data ?? []).length === 0);
      }
      if (session.user?.id) {
        const saved = await fetchWatchProgress(session.user.id);
        if (!cancelled) setProgress(saved.error ? [] : saved.data ?? []);
      } else {
        setProgress([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session.user?.id]);

  const displayTitles = useMemo<DisplayTitle[]>(() => {
    if (usingDemo || titles.length === 0) {
      return catalog.filter((item) => !item.live).map((item) => ({
        id: item.id,
        title: item.title,
        category: item.genre,
        year: item.year,
        image: item.image,
        length: item.length,
        status: "pending",
        manifestUrl: null,
        progress: 0,
        isDemo: true,
        featured: item.id === catalog[0]?.id,
        contentType: item.genre === "Series" ? "series" : "single",
      }));
    }
    return titles.map((item) => {
      const saved = progress.find((entry) => entry.title_id === item.id);
      const status = resolveWatchStatus(item.status, item.hls_manifest_url);
      return {
        id: item.id,
        title: item.title,
        category: item.category,
        year: item.release_year,
        image: item.thumbnail_url,
        length: durationLabel(item.duration_seconds),
        status,
        manifestUrl: status === "ready" ? item.hls_manifest_url : null,
        progress: saved ? watchProgressPercent(saved.progress_seconds, saved.total_seconds) : 0,
        isDemo: false,
        featured: item.is_featured,
        contentType: item.content_type === "series" ? "series" : "single",
      };
    });
  }, [progress, titles, usingDemo]);

  const visibleTitles = useMemo(
    () => displayTitles.filter((item) => matchesWatchCategory({ category: item.category, content_type: item.contentType }, category)),
    [category, displayTitles],
  );
  const hero = displayTitles.find((item) => item.featured) ?? displayTitles[0];

  const chooseCategory = (next: WatchCategory) => {
    void navigate({ search: { category: next } });
  };

  const play = (item: DisplayTitle) => {
    if (item.status !== "ready" || !item.manifestUrl || item.isDemo) return;
    setActiveTitle(item);
  };

  return (
    <div>
      <PageHeader title="Watch" action={usingDemo ? <DemoBadge>Demo catalogue</DemoBadge> : undefined} />
      {loadError && <p className="mb-4 flex items-center gap-2 text-xs text-amber-300"><AlertCircle className="h-4 w-4" />{loadError}</p>}
      {hero && (
        <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-3xl bg-card md:aspect-[21/9]">
          <img src={hero.image} alt="" className="h-full w-full object-cover" />
          <div className="bg-scrim absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
            <p className="text-xs uppercase tracking-widest text-accent">{usingDemo ? "Featured · Demo" : "Featured"}</p>
            <h2 className="mt-1 text-2xl font-bold text-white sm:text-4xl">{hero.title}</h2>
            <p className="mt-1 text-sm text-white/75">{hero.category} · {hero.year ?? "Year pending"} · {hero.length}</p>
            <button
              onClick={() => play(hero)}
              disabled={hero.status !== "ready" || hero.isDemo}
              className="mt-3 flex items-center gap-2 rounded-full bg-white px-5 py-2 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-75"
            >
              <Play className="h-4 w-4 fill-current" />
              {hero.isDemo ? "Demo preview" : hero.status === "ready" ? "Play" : "Stream assets pending"}
            </button>
          </div>
        </div>
      )}

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {(["All", "Documentary", "Series", "Food"] as const).map((item) => (
          <Chip key={item} active={category === item} onClick={() => chooseCategory(item)}>{item}</Chip>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="animate-pulse">
              <div className="aspect-video rounded-2xl bg-muted" />
              <div className="mt-3 h-4 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : visibleTitles.length === 0 ? (
        <div className="rounded-2xl border border-border p-8 text-center">
          <Film className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">No titles in this category yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another category or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {visibleTitles.map((item) => (
            <button key={item.id} onClick={() => play(item)} disabled={item.status !== "ready" || item.isDemo} className="group text-left disabled:cursor-default">
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted">
                <img src={item.image} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                {item.isDemo ? (
                  <span className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 text-[10px] font-bold text-white">DEMO</span>
                ) : item.status !== "ready" ? (
                  <span className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 text-[10px] font-bold text-white">{item.status === "processing" ? "PROCESSING" : "STREAM PENDING"}</span>
                ) : null}
                {item.progress > 0 && (
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25"><span className="block h-full bg-brand" style={{ width: `${item.progress}%` }} /></span>
                )}
              </div>
              <p className="mt-2 font-semibold">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.category} · {item.year ?? "Year pending"} · {item.length}</p>
            </button>
          ))}
        </div>
      )}
      {activeTitle && session.user && (
        <WatchPlayer
          titleId={activeTitle.id}
          title={activeTitle.title}
          manifestUrl={activeTitle.manifestUrl ?? ""}
          userId={session.user.id}
          initialProgress={progress.find((item) => item.title_id === activeTitle.id)?.progress_seconds ?? 0}
          onClose={() => setActiveTitle(null)}
        />
      )}
      {activeTitle && !session.user && (
        <WatchPlayer
          titleId={activeTitle.id}
          title={activeTitle.title}
          manifestUrl={activeTitle.manifestUrl ?? ""}
          onClose={() => setActiveTitle(null)}
        />
      )}
    </div>
  );
}
