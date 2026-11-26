import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FootballCentre } from "./FootballCentre";


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
type F1Race = {
  raceName?: string;
  date?: string;
  time?: string;
  Circuit?: { circuitName?: string; Location?: { locality?: string; country?: string } };
  QualifyingResults?: Array<{
    position?: string;
    Driver?: { givenName?: string; familyName?: string; code?: string };
    Constructor?: { name?: string };
    Q1?: string;
    Q2?: string;
    Q3?: string;
  }>;
  Results?: Array<{
    position?: string;
    points?: string;
    status?: string;
    Time?: { time?: string };
    FastestLap?: { Time?: { time?: string } };
    Driver?: { givenName?: string; familyName?: string; code?: string };
    Constructor?: { name?: string };
  }>;
};
type F1Standing = {
  position?: string;
  points?: string;
  wins?: string;
  Driver?: { givenName?: string; familyName?: string; code?: string };
  Constructors?: Array<{ name?: string }>;
  Constructor?: { name?: string };
};
type F1PanelData = {
  qualifyingRace: F1Race | null;
  resultRace: F1Race | null;
  drivers: F1Standing[];
  constructors: F1Standing[];
  errors: string[];
};
type F1Tab = "qualifying" | "results" | "drivers" | "teams";
const SPORTS: { key: SportKey; label: string; icon: string; terms: RegExp }[] = [
  { key: "all", label: "All Sports", icon: "🏆", terms: /.*/i },
  { key: "football", label: "Football", icon: "⚽", terms: /football|soccer|premier league|champions league|goal|striker|transfer|manchester|arsenal|chelsea|liverpool|real madrid|barcelona/i },
  { key: "nba", label: "NBA", icon: "🏀", terms: /nba|basketball|celtics|lakers|warriors|knicks|bucks|nuggets|wnba/i },
  { key: "nfl", label: "NFL", icon: "🏈", terms: /nfl|american football|touchdown|quarterback|super bowl|chiefs|eagles|cowboys/i },
  { key: "mlb", label: "MLB", icon: "⚾", terms: /mlb|baseball|world series|home run|yankees|dodgers|red sox/i },
  { key: "nhl", label: "NHL", icon: "🏒", terms: /nhl|ice hockey|stanley cup|oilers|maple leafs|bruins/i },
  { key: "f1", label: "Formula 1", icon: "🏎️", terms: /formula 1|formula one|\\bf1\\b|grand prix|motorsport|verstappen|hamilton|leclerc|norris|ferrari|mclaren/i },
  { key: "rugby", label: "Rugby", icon: "🏉", terms: /rugby|six nations|world rugby|super rugby|premiership rugby|all blacks|springboks|crusaders/i },
  { key: "mma", label: "MMA / UFC", icon: "🥊", terms: /mma|ufc|mixed martial arts|cage warriors|bellator|octagon|fight night|dana white/i },
  { key: "cricket", label: "Cricket", icon: "🏏", terms: /cricket|icc|ipl|t20|test match|ashes|odi|wicket|virat kohli|world cup/i },
  { key: "tennis", label: "Tennis", icon: "🎾", terms: /tennis|atp|wta|wimbledon|us open|french open|australian open|grand slam|djokovic|alcaraz|swiatek/i },
];
const SCORE_PROVIDERS = ["football-data", "sportscore", "espn-nba", "espn-nfl", "espn-mlb", "espn-nhl", "jolpica-f1", "rugbyapi", "ufcalendar-mma", "espn-cricket", "livetennisapi"];
const F1_API = "https://api.jolpi.ca/ergast/f1";
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
function f1DriverName(driver?: F1Standing["Driver"]) {
  return [driver?.givenName, driver?.familyName].filter(Boolean).join(" ") || "Driver";
}
async function fetchF1Endpoint(path: string) {
  const response = await fetch(F1_API + path + ".json?limit=100", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("F1 data returned HTTP " + response.status);
  return response.json();
}
export function MultiSportHub() {
  const [activeSport, setActiveSport] = useState<SportKey>("all");
  const [news, setNews] = useState<NewsRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [f1Tab, setF1Tab] = useState<F1Tab>("qualifying");
  const [f1Data, setF1Data] = useState<F1PanelData | null>(null);
  const [f1Loading, setF1Loading] = useState(false);
  const [f1UpdatedAt, setF1UpdatedAt] = useState<string | null>(null);

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
          .lte("kickoff_at", new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString())
          .order("kickoff_at", { ascending: true }).limit(500),
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

  useEffect(() => {
    if (activeSport !== "f1") return;
    let mounted = true;
    const loadF1 = async () => {
      setF1Loading(true);
      const season = new Date().getUTCFullYear();
      const endpoints = [
        fetchF1Endpoint("/" + season + "/last/qualifying"),
        fetchF1Endpoint("/" + season + "/last/results"),
        fetchF1Endpoint("/" + season + "/driverstandings"),
        fetchF1Endpoint("/" + season + "/constructorstandings"),
      ];
      const responses = await Promise.allSettled(endpoints);
      if (!mounted) return;
      const errors = responses.flatMap((result, index) => result.status === "rejected"
        ? [["Latest qualifying", "Latest race results", "Driver standings", "Constructor standings"][index] + " unavailable"] : []);
      const value = (index: number) => responses[index].status === "fulfilled" ? responses[index].value : null;
      const qualifyingRaces = value(0)?.MRData?.RaceTable?.Races ?? [];
      const resultRaces = value(1)?.MRData?.RaceTable?.Races ?? [];
      const driverRows = value(2)?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
      const constructorRows = value(3)?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
      setF1Data({
        qualifyingRace: qualifyingRaces[0] ?? null,
        resultRace: resultRaces[0] ?? null,
        drivers: driverRows,
        constructors: constructorRows,
        errors,
      });
      setF1UpdatedAt(new Date().toISOString());
      setF1Loading(false);
    };
    void loadF1();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadF1();
    }, 5 * 60_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void loadF1(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeSport]);

  const selected = SPORTS.find((sport) => sport.key === activeSport) ?? SPORTS[0];
  const filteredNews = useMemo(() => activeSport === "all"
    ? news
    : news.filter((item) => selected.terms.test(item.headline + " " + item.summary)), [activeSport, news, selected]);
  const filteredMatches = useMemo(() => {
    const provider = activeSport === "all" ? null : activeSport === "football" ? "football-data"
      : activeSport === "nba" ? "espn-nba"
      : activeSport === "nfl" ? "espn-nfl"
      : activeSport === "mlb" ? "espn-mlb"
      : activeSport === "nhl" ? "espn-nhl"
      : activeSport === "f1" ? "jolpica-f1"
      : activeSport === "rugby" ? "rugbyapi"
      : activeSport === "mma" ? "ufcalendar-mma"
      : activeSport === "cricket" ? "espn-cricket"
      : activeSport === "tennis" ? "livetennisapi" : "";
    const selectedMatches = provider === null ? matches : provider ? matches.filter((match) => match.provider === provider) : [];
    return selectedMatches.sort((left, right) => {
      const priority = (status: string) => status === "LIVE" || status === "HT" ? 0 : status === "SCHEDULED" ? 1 : status === "FT" ? 2 : 3;
      return priority(left.status) - priority(right.status) || left.kickoff_at.localeCompare(right.kickoff_at);
    });
  }, [activeSport, matches]);

  const qualifyingRace = f1Data?.qualifyingRace;
  const resultRace = f1Data?.resultRace;
  const activeRace = f1Tab === "qualifying" ? qualifyingRace : resultRace;
  const f1SessionRows: any[] = f1Tab === "qualifying" ? activeRace?.QualifyingResults ?? [] : activeRace?.Results ?? [];

  return <section aria-label="Multi-sport hub" className="min-w-0 w-full max-w-full space-y-4 overflow-hidden rounded-2xl border bg-card p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Nexora Arena</p><h2 className="text-xl font-black">Sports Live Hub</h2><p className="text-xs text-muted-foreground">Scores, race weekends and breaking sports news</p></div>
      <span className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">{loading ? "Updating…" : "Cached updates"}{updatedAt ? " · " + relativeTime(updatedAt) : ""}</span>
    </div>
    <nav aria-label="Choose a sport" className="flex min-w-0 flex-wrap gap-2 pb-1">
      {SPORTS.map((sport) => <button key={sport.key} type="button" onClick={() => setActiveSport(sport.key)} aria-pressed={activeSport === sport.key} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${activeSport === sport.key ? "border-primary bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted"}`}><span aria-hidden="true" className="text-base">{sport.icon}</span>{sport.label}</button>)}
    </nav>
    <div className="space-y-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><h3 className="min-w-0 break-words font-bold">{activeSport === "all" ? "Live scores & upcoming events" : selected.label + " scores & events"}</h3><span className="text-[11px] text-muted-foreground">Auto-refreshes while open</span></div>
      {filteredMatches.length ? <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        {filteredMatches.slice(0, 8).map((match) => <article key={match.id} className="min-w-0 max-w-full overflow-hidden rounded-xl border bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-2"><span className="truncate text-[11px] font-semibold text-muted-foreground">{match.competition_name}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${match.status === "LIVE" || match.status === "HT" ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground"}`}>{match.status === "LIVE" ? "LIVE" : match.status === "HT" ? "HALF TIME" : match.status === "FT" ? "FULL TIME" : match.status}</span></div>
          {match.provider === "jolpica-f1" || match.provider === "ufcalendar-mma" || match.provider === "espn-cricket" ? <><p className="font-bold">{match.home_team}</p><p className="mt-1 text-xs text-muted-foreground">{match.away_team}</p></> : match.provider === "livetennisapi" ? <div className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 flex-1 truncate font-semibold">{match.home_team}</span><strong className="shrink-0 tabular-nums">{match.home_score ?? "–"} : {match.away_score ?? "–"}</strong><span className="min-w-0 flex-1 truncate text-right font-semibold">{match.away_team}</span></div> : <div className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 flex-1 truncate font-semibold">{match.home_team}</span><strong className="tabular-nums">{match.home_score ?? "–"} : {match.away_score ?? "–"}</strong><span className="min-w-0 flex-1 truncate text-right font-semibold">{match.away_team}</span></div>}
          <p className="mt-2 break-words text-[10px] text-muted-foreground">{eventTime(match.kickoff_at)}{match.elapsed_minute ? " · Period " + match.elapsed_minute : ""}</p>
        </article>)}
      </div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{loading ? "Loading cached scores…" : activeSport === "tennis" ? "No tennis matches are live right now, or the tennis feed key has not been connected yet." : "No cached fixtures or live scores are available right now."}</p>}
    </div>
    {activeSport === "football" && <FootballCentre />}
    {activeSport === "football" && <FootballCentre />}
    {activeSport === "f1" && <section aria-label="Formula 1 championship centre" className="space-y-3 rounded-xl border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="font-black">Formula 1 Championship Centre</h3><p className="text-xs text-muted-foreground">{new Date().getUTCFullYear()} season · Qualifying, race classification and standings</p></div>
        <span className="text-[10px] text-muted-foreground">{f1Loading ? "Refreshing…" : f1UpdatedAt ? "Updated " + relativeTime(f1UpdatedAt) : "Loading F1 data…"}</span>
      </div>
      <nav aria-label="Formula 1 data" className="flex min-w-0 flex-wrap gap-2 pb-1">
        {([
          ["qualifying", "Qualifying"],
          ["results", "Race results"],
          ["drivers", "Drivers"],
          ["teams", "Constructors"],
        ] as [F1Tab, string][]).map(([tab, label]) => <button key={tab} type="button" onClick={() => setF1Tab(tab)} aria-pressed={f1Tab === tab} className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold ${f1Tab === tab ? "border-primary bg-primary text-primary-foreground" : "bg-muted/50"}`}>{label}</button>)}
      </nav>
      {(f1Tab === "qualifying" || f1Tab === "results") ? <>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-bold">{activeRace?.raceName ?? (f1Tab === "qualifying" ? "Latest qualifying session" : "Latest race classification")}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{activeRace?.Circuit?.circuitName ?? "Session data will appear when published"}{activeRace?.date ? " · " + new Date(activeRace.date + "T12:00:00Z").toLocaleDateString() : ""}</p>
        </div>
        {f1SessionRows.length ? <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[440px] text-left text-xs">
            <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground"><tr><th className="p-2">Pos</th><th className="p-2">Driver</th><th className="p-2">Team</th>{f1Tab === "qualifying" ? <><th className="p-2">Q1</th><th className="p-2">Q2</th><th className="p-2">Q3</th></> : <><th className="p-2">Time / Status</th><th className="p-2">Pts</th></>}</tr></thead>
            <tbody>{f1SessionRows.map((row: any, index: number) => <tr key={(row.Driver?.code ?? row.Driver?.familyName ?? "driver") + "-" + index} className="border-t">
              <td className="p-2 font-bold">{row.position ?? index + 1}</td>
              <td className="p-2 font-semibold">{f1DriverName(row.Driver)}</td>
              <td className="p-2 text-muted-foreground">{row.Constructor?.name ?? "—"}</td>
              {f1Tab === "qualifying" ? <><td className="p-2 tabular-nums">{row.Q1 ?? "—"}</td><td className="p-2 tabular-nums">{row.Q2 ?? "—"}</td><td className="p-2 tabular-nums">{row.Q3 ?? "—"}</td></> : <><td className="p-2">{row.Time?.time ?? row.status ?? "—"}</td><td className="p-2 tabular-nums">{row.points ?? "0"}</td></>}
            </tr>)}</tbody>
          </table>
        </div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{f1Loading ? "Loading session data…" : "No session classification has been published for the latest round yet."}</p>}
      </> : <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[340px] text-left text-xs">
          <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground"><tr><th className="p-2">Pos</th><th className="p-2">{f1Tab === "drivers" ? "Driver" : "Constructor"}</th><th className="p-2">Points</th><th className="p-2">Wins</th></tr></thead>
          <tbody>{(f1Tab === "drivers" ? f1Data?.drivers ?? [] : f1Data?.constructors ?? []).map((row, index) => <tr key={f1Tab === "drivers" ? row.Driver?.code ?? index : row.Constructor?.name ?? index} className="border-t">
            <td className="p-2 font-bold">{row.position ?? index + 1}</td>
            <td className="p-2 font-semibold">{f1Tab === "drivers" ? f1DriverName(row.Driver) : row.Constructor?.name ?? "Constructor"}</td>
            <td className="p-2 font-bold tabular-nums">{row.points ?? "0"}</td>
            <td className="p-2 tabular-nums">{row.wins ?? "0"}</td>
          </tr>)}</tbody>
        </table>
        {!f1Loading && !(f1Tab === "drivers" ? f1Data?.drivers.length : f1Data?.constructors.length) && <p className="p-4 text-sm text-muted-foreground">Championship standings are not available yet.</p>}
      </div>}
      {f1Data?.errors.length ? <p role="status" className="text-xs text-amber-600">Some F1 feeds could not be reached: {f1Data.errors.join(", ")}. Other available sections remain usable.</p> : null}
      <p className="text-[10px] text-muted-foreground">F1 data via Jolpica API. Session classifications and championship points update when the source publishes official data.</p>
    </section>}
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2"><h3 className="font-bold">{activeSport === "all" ? "Sports breaking news" : selected.label + " news"}</h3><span className="text-xs text-muted-foreground">{filteredNews.length} stories</span></div>
      {filteredNews.length ? <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        {filteredNews.slice(0, 12).map((item) => <a key={item.id} href={item.source_url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 gap-3 rounded-xl border p-3 transition hover:bg-muted/40">
          {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" loading="lazy" className="h-20 w-24 shrink-0 rounded-lg object-cover" /> : <span className="grid h-20 w-24 shrink-0 place-items-center rounded-lg bg-primary/10 text-2xl">📰</span>}
          <span className="min-w-0"><span className="line-clamp-2 block text-sm font-bold">{item.headline}</span><span className="mt-1 block text-xs text-muted-foreground">{item.source_name} · {relativeTime(item.published_at)}</span>{item.summary && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{item.summary}</span>}</span>
        </a>)}
      </div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{loading ? "Loading sports news…" : "No matching stories yet. Check back after the next scheduled news sync."}</p>}
    </div>
    <p className="text-[10px] text-muted-foreground">Scoreboards and news are supplied by third-party public feeds and may be delayed or temporarily unavailable.</p>
  </section>;
}
