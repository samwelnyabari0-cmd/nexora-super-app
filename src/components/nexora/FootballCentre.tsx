import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type FootballTab = "live" | "fixtures" | "results" | "table" | "scorers";
type Competition = { code: string; label: string };
type Match = {
  id: string; competition_code: string; competition_name: string;
  home_team: string; away_team: string; home_score: number | null;
  away_score: number | null; status: string; elapsed_minute: number | null;
  kickoff_at: string; updated_at: string;
};
type Standing = {
  id: string; position: number; team_name: string; team_short_name: string | null;
  team_crest_url: string | null; played_games: number; won: number; drawn: number;
  lost: number; goals_for: number; goals_against: number; goal_difference: number; points: number;
};
type Scorer = {
  id: string; player_name: string; team_name: string; goals: number; assists: number; penalties: number; updated_at: string;
};
const COMPETITIONS: Competition[] = [
  { code: "PL", label: "Premier League" },
  { code: "CL", label: "Champions League" },
  { code: "PD", label: "La Liga" },
  { code: "BL1", label: "Bundesliga" },
  { code: "SA", label: "Serie A" },
  { code: "FL1", label: "Ligue 1" },
];
const TABS: { key: FootballTab; label: string }[] = [
  { key: "live", label: "Live scores" },
  { key: "fixtures", label: "Fixtures" },
  { key: "results", label: "Results" },
  { key: "table", label: "League table" },
  { key: "scorers", label: "Top scorers" },
];
function matchDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function scoreText(match: Match) {
  return match.home_score === null || match.away_score === null ? "— : —" : match.home_score + " : " + match.away_score;
}
export function FootballCentre() {
  const [tab, setTab] = useState<FootballTab>("live");
  const [competition, setCompetition] = useState("PL");
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const now = Date.now();
      const [matchResult, tableResult, scorerResult] = await Promise.all([
        (supabase as any).from("football_matches")
          .select("id,competition_code,competition_name,home_team,away_team,home_score,away_score,status,elapsed_minute,kickoff_at,updated_at")
          .eq("provider", "football-data").eq("is_published", true)
          .gte("kickoff_at", new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString())
          .lte("kickoff_at", new Date(now + 45 * 24 * 60 * 60 * 1000).toISOString())
          .order("kickoff_at", { ascending: true }).limit(500),
        (supabase as any).from("football_standings")
          .select("id,position,team_name,team_short_name,team_crest_url,played_games,won,drawn,lost,goals_for,goals_against,goal_difference,points,updated_at")
          .eq("provider", "football-data").eq("competition_code", competition)
          .eq("standing_type", "TOTAL").order("position", { ascending: true }).limit(50),
        (supabase as any).from("football_scorers")
          .select("id,player_name,team_name,goals,assists,penalties,updated_at")
          .eq("provider", "football-data").eq("competition_code", competition)
          .order("goals", { ascending: false }).order("assists", { ascending: false }).limit(20),
      ]);
      if (!mounted) return;
      const failures = [matchResult.error, tableResult.error, scorerResult.error].filter(Boolean);
      setError(failures.length ? "Some football data could not be loaded. Please try again shortly." : null);
      setMatches(matchResult.error ? [] : (matchResult.data ?? []) as Match[]);
      setStandings(tableResult.error ? [] : (tableResult.data ?? []) as Standing[]);
      setScorers(scorerResult.error ? [] : (scorerResult.data ?? []) as Scorer[]);
      const timestamps = [
        ...((matchResult.data ?? []) as Match[]).map((row) => row.updated_at),
        ...((tableResult.data ?? []) as Standing[]).map((row) => row.updated_at),
        ...((scorerResult.data ?? []) as Scorer[]).map((row) => row.updated_at),
      ].filter(Boolean).sort();
      setUpdatedAt(timestamps.at(-1) ?? new Date().toISOString());
      setLoading(false);
    };
    setLoading(true);
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5 * 60_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [competition]);

  const liveMatches = useMemo(() => matches.filter((match) => match.status === "LIVE" || match.status === "HT"), [matches]);
  const fixtures = useMemo(() => matches.filter((match) => match.status === "SCHEDULED" && Date.parse(match.kickoff_at) >= Date.now()).sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at)), [matches]);
  const results = useMemo(() => matches.filter((match) => match.status === "FT" || (Date.parse(match.kickoff_at) < Date.now() && match.status !== "SCHEDULED")).sort((a, b) => b.kickoff_at.localeCompare(a.kickoff_at)), [matches]);

  return <section aria-label="Football championship centre" className="min-w-0 space-y-3 rounded-xl border bg-background p-3">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-black">Football Championship Centre</h3><p className="text-xs text-muted-foreground">Scores, fixtures, results, standings and top scorers</p></div>
      <span className="text-[10px] text-muted-foreground">{loading ? "Refreshing…" : updatedAt ? "Data updated " + matchDate(updatedAt) : "Waiting for football data"}</span>
    </div>
    <label className="block text-xs font-semibold text-muted-foreground" htmlFor="football-competition">Competition</label>
    <select id="football-competition" value={competition} onChange={(event) => setCompetition(event.target.value)} className="w-full min-w-0 rounded-lg border bg-card px-3 py-2.5 text-sm font-semibold">
      {COMPETITIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
    </select>
    <nav aria-label="Football data sections" className="flex min-w-0 flex-wrap gap-2">
      {TABS.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} aria-pressed={tab === item.key} className={`rounded-lg border px-3 py-2 text-xs font-bold ${tab === item.key ? "border-primary bg-primary text-primary-foreground" : "bg-muted/50"}`}>{item.label}</button>)}
    </nav>
    {error && <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700">{error}</p>}
    {tab === "table" ? <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[620px] text-left text-xs">
        <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground"><tr><th className="p-2">Pos</th><th className="p-2">Club</th><th className="p-2">P</th><th className="p-2">W</th><th className="p-2">D</th><th className="p-2">L</th><th className="p-2">GF</th><th className="p-2">GA</th><th className="p-2">GD</th><th className="p-2">Pts</th></tr></thead>
        <tbody>{standings.map((row) => <tr key={row.id} className="border-t">
          <td className="p-2 font-bold">{row.position}</td><td className="p-2 font-semibold"><span className="flex items-center gap-2">{row.team_crest_url ? <img src={row.team_crest_url} alt="" loading="lazy" className="h-5 w-5 object-contain" /> : null}<span>{row.team_short_name || row.team_name}</span></span></td>
          <td className="p-2">{row.played_games}</td><td className="p-2">{row.won}</td><td className="p-2">{row.drawn}</td><td className="p-2">{row.lost}</td><td className="p-2">{row.goals_for}</td><td className="p-2">{row.goals_against}</td><td className="p-2">{row.goal_difference > 0 ? "+" : ""}{row.goal_difference}</td><td className="p-2 font-black">{row.points}</td>
        </tr>)}</tbody>
      </table>
      {!loading && !standings.length && <p className="p-4 text-sm text-muted-foreground">No table has been published for this competition yet.</p>}
    </div> : null}
    {tab === "scorers" ? <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[420px] text-left text-xs">
        <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground"><tr><th className="p-2">Pos</th><th className="p-2">Player</th><th className="p-2">Club</th><th className="p-2">Goals</th><th className="p-2">Assists</th></tr></thead>
        <tbody>{scorers.map((row, index) => <tr key={row.id} className="border-t"><td className="p-2 font-bold">{index + 1}</td><td className="p-2 font-semibold">{row.player_name}</td><td className="p-2 text-muted-foreground">{row.team_name}</td><td className="p-2 font-black">{row.goals}</td><td className="p-2">{row.assists}</td></tr>)}</tbody>
      </table>
      {!loading && !scorers.length && <p className="p-4 text-sm text-muted-foreground">Top scorers are not available for this competition yet.</p>}
    </div> : null}
    {tab === "live" || tab === "fixtures" || tab === "results" ? <div className="space-y-2">
      {(tab === "live" ? liveMatches : tab === "fixtures" ? fixtures : results).filter((match) => match.competition_code === competition).slice(0, tab === "fixtures" ? 30 : 20).map((match) => <article key={match.id} className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
        <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-muted-foreground">{match.competition_name}</p><p className="mt-1 truncate text-sm font-bold">{match.home_team}</p><p className="mt-1 truncate text-sm font-bold">{match.away_team}</p><p className="mt-1 text-[10px] text-muted-foreground">{matchDate(match.kickoff_at)}</p></div>
        <div className="shrink-0 text-right"><p className={`text-xs font-black ${match.status === "LIVE" || match.status === "HT" ? "text-red-600" : ""}`}>{tab === "fixtures" ? "UPCOMING" : scoreText(match)}</p><p className="mt-1 text-[10px] font-semibold text-muted-foreground">{match.status === "FT" ? "FULL TIME" : match.status === "HT" ? "HALF TIME" : match.status === "LIVE" ? "LIVE" : match.status}</p>{match.elapsed_minute ? <p className="text-[10px] text-muted-foreground">{match.elapsed_minute}'</p> : null}</div>
      </article>)}
      {!loading && !(tab === "live" ? liveMatches : tab === "fixtures" ? fixtures : results).some((match) => match.competition_code === competition) && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{tab === "live" ? "No live matches at this moment." : tab === "fixtures" ? "No upcoming fixtures are currently available." : "No recent results are currently available."}</p>}
    </div> : null}
    <p className="text-[10px] text-muted-foreground">Football data is refreshed from the connected provider on its schedule. Live scores may be delayed by the provider.</p>
  </section>;
}
