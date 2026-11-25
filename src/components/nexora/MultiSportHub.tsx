import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SportKey = "all" | "football" | "nba" | "nfl" | "mlb" | "nhl" | "f1" | "rugby" | "mma" | "cricket" | "tennis";
type NewsRow = {
  id: string;
  provider: string;
  source_name: string;
  headline: string;
  summary: string;
  thumbnail_url: string | null;
  source_url: string;
  published_at: string;
};
type MatchRow = {
  id: string;
  provider: string;
  competition_name: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  elapsed_minute: number | null;
  kickoff_at: string;
  source_url: string | null;
};
const SPORTS: { key: SportKey; label: string; icon: string; terms: RegExp }[] = [
  { key: "all", label: "All Sports", icon: "🏆", terms: /.*/i },
  { key: "football", label: "Football", icon: "⚽", terms: /football|soccer|premier league|champions league|goal|striker|transfer|manchester|arsenal|chelsea|liverpool|real madrid|barcelona/i },
  { key: "nba", label: "NBA", icon: "🏀", terms: /nba|basketball|celtics|lakers|warriors|knicks|bucks|nuggets|wnba/i },
  { key: "nfl", label: "NFL", icon: "🏈", terms: /nfl|american football|touchdown|quarterback|super bowl|chiefs|eagles|cowboys/i },
  { key: "mlb", label: "MLB", icon: "⚾", terms: /mlb|baseball|world series|home run|yankees|dodgers|red sox/i },
  { key: "nhl", label: "NHL", icon: "🏒", terms: /nhl|ice hockey|stanley cup|oilers|maple leafs|bruins/i },
  { key: "f1", label: "Formula 1", icon: "🏎️", terms: /formula 1|formula one|\bf1\b|grand prix|motorsport|verstappen|hamilton|leclerc|norris|ferrari|mclaren/i },
  { key: "rugby", label: "Rugby", icon: "🏉", terms: /rugby|six nations|world rugby|super rugby|premiership rugby|all blacks|springboks|crusaders/i },
  { key: "mma", label: "MMA / UFC", icon: "🥊", terms: /mma|ufc|mixed martial arts|cage warriors|bellator|octagon|fight night|dana white/i },
  { key: "cricket", label: "Cricket", icon: "🏏", terms: /cricket|icc|ipl|t20|test match|ashes|odi|wicket|virat kohli|world cup/i },
  { key: "tennis", label: "Tennis", icon: "🎾", terms: /tennis|atp|wta|wimbledon|us open|french open|australian open|grand slam|djokovic|alcaraz|swiatek/i },
];
const SCORE_PROVIDERS = ["sportscore", "espn-nba", "espn-nfl", "espn-mlb", "espn-nhl", "jolpica-f1"];
function relativeTime(value: string) {
  const date = new Date(value);
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "Just now" : minutes + "m ago";
  if (minutes < 1440) return Math.floor(minutes / 60) + "h ago";
  return Math.floor(minutes / 1440) + "d ago";
}
function eventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
export function MultiSportHub() {
  const [activeSport, setActiveSport] = useState<SportKey>("all");
  const [news, setNews] = useState<NewsRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const [newsResult, matchResult] = await Promise.all([
        (supabase as any).from("football_announcements")
          .select("id,provider,source_name,headline,summary,thumbnail_url,source_url,published_at")
          .eq("is_published", true)
          .in("provider", ["sky-sports-rss", "espn-sports-rss", "bbc-sport-rss"])
          .order("published_at", { ascending: false }).limit(100),
        (supabase as any).from("football_matches")
          .select("id,provider,competition_name,home_team,away_team,home_score,away_score,status,elapsed_minute,kickoff_at,source_url")
          .eq("is_published", true)
          .in("provider", SCORE_PROVIDERS)
          .gte("kickoff_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .lte("kickoff_at", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
          .order("kickoff_at", { ascending: true }).limit(120),
      ]);
      if (!mounted) return;
      setNews(newsResult.error ? [] : (newsResult.data ?? []) as NewsRow[]);
      setMatches(matchResult.error ? [] : (matchResult.data ?? []) as MatchRow[]);
      setUpdatedAt(new Date().toISOString());
      setLoading(false);
    };
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { mounted = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  const selected = SPORTS.find((sport) => sport.key === activeSport) ?? SPORTS[0];
  const filteredNews = useMemo(() => activeSport === "all"
    ? news
    : news.filter((item) => selected.terms.test(item.headline + " " + item.summary)), [activeSport, news, selected]);
  const filteredMatches = useMemo(() => {
    if (activeSport === "all") return matches;
    const provider = activeSport === "football" ? "sportscore"
      : activeSport === "nba" ? "espn-nba"
      : activeSport === "nfl" ? "espn-nfl"
      : activeSport === "mlb" ? "espn-mlb"
      : activeSport === "nhl" ? "espn-nhl"
      : activeSport === "f1" ? "jolpica-f1" : "";
    return provider ? matches.filter((match) => match.provider === provider) : [];
  }, [activeSport, matches]);

  return <section aria-label="Multi-sport hub" className="space-y-4 rounded-2xl border bg-card p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Nexora Arena</p><h2 className="text-xl font-black">Sports Live Hub</h2><p className="text-xs text-muted-foreground">Scores, race weekends and breaking sports news</p></div>
      <span className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">{loading ? "Updating…" : "Cached updates"}{updatedAt ? " · " + relativeTime(updatedAt) : ""}</span>
    </div>
    <nav aria-label="Choose a sport" className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {SPORTS.map((sport) => <button key={sport.key} type="button" onClick={() => setActiveSport(sport.key)} aria-pressed={activeSport === sport.key} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${activeSport === sport.key ? "border-primary bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted"}`}><span aria-hidden="true" className="text-base">{sport.icon}</span>{sport.label}</button>)}
    </nav>
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2"><h3 className="font-bold">{activeSport === "all" ? "Live scores & upcoming events" : selected.label + " scores & events"}</h3><span className="text-[11px] text-muted-foreground">Auto-refreshes while open</span></div>
      {filteredMatches.length ? <div className="grid gap-2 sm:grid-cols-2">
        {filteredMatches.slice(0, 8).map((match) => <article key={match.id} className="rounded-xl border bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-2"><span className="truncate text-[11px] font-semibold text-muted-foreground">{match.competition_name}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${match.status === "LIVE" || match.status === "HT" ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground"}`}>{match.status === "LIVE" ? "LIVE" : match.status === "HT" ? "HALF TIME" : match.status === "FT" ? "FULL TIME" : match.status}</span></div>
          {match.provider === "jolpica-f1" ? <><p className="font-bold">{match.home_team}</p><p className="mt-1 text-xs text-muted-foreground">{match.away_team}</p></> : <div className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 flex-1 truncate font-semibold">{match.home_team}</span><strong className="tabular-nums">{match.home_score ?? "–"} : {match.away_score ?? "–"}</strong><span className="min-w-0 flex-1 truncate text-right font-semibold">{match.away_team}</span></div>}
          <p className="mt-2 text-[10px] text-muted-foreground">{eventTime(match.kickoff_at)}{match.elapsed_minute ? " · Period " + match.elapsed_minute : ""}</p>
        </article>)}
      </div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{loading ? "Loading cached scores…" : activeSport === "rugby" || activeSport === "mma" || activeSport === "cricket" || activeSport === "tennis" ? "Breaking news and sport updates are shown below. Live score coverage for this sport is not connected yet." : "No cached fixtures or live scores are available right now."}</p>}
    </div>
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2"><h3 className="font-bold">{activeSport === "all" ? "Sports breaking news" : selected.label + " news"}</h3><span className="text-xs text-muted-foreground">{filteredNews.length} stories</span></div>
      {filteredNews.length ? <div className="grid gap-3 md:grid-cols-2">
        {filteredNews.slice(0, 12).map((item) => <a key={item.id} href={item.source_url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 gap-3 rounded-xl border p-3 transition hover:bg-muted/40">
          {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" loading="lazy" className="h-20 w-24 shrink-0 rounded-lg object-cover" /> : <span className="grid h-20 w-24 shrink-0 place-items-center rounded-lg bg-primary/10 text-2xl">📰</span>}
          <span className="min-w-0"><span className="line-clamp-2 block text-sm font-bold">{item.headline}</span><span className="mt-1 block text-xs text-muted-foreground">{item.source_name} · {relativeTime(item.published_at)}</span>{item.summary && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{item.summary}</span>}</span>
        </a>)}
      </div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{loading ? "Loading sports news…" : "No matching stories yet. Check back after the next scheduled news sync."}</p>}
    </div>
    <p className="text-[10px] text-muted-foreground">Scoreboards and news are supplied by third-party public feeds and may be delayed or temporarily unavailable.</p>
  </section>;
}
