import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FootballMatch } from "./types";

export type FootballStanding = {
  id: string;
  competition_code: string;
  competition_name: string;
  season_id: string;
  current_matchday: number | null;
  standing_type: string;
  group_name: string;
  position: number;
  team_provider_id: string;
  team_name: string;
  team_short_name: string | null;
  team_crest_url: string | null;
  played_games: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  updated_at: string;
};

type MatchRow = {
  id: string;
  provider: string;
  provider_id: string;
  competition_code: string;
  competition_name: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: FootballMatch["status"];
  elapsed_minute: number | null;
  kickoff_at: string;
  updated_at: string;
  source_url: string | null;
};
type QueryResult<T> = { data: T[] | null; error: { message: string } | null };
type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  select: (columns: string) => QueryBuilder<T>;
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  gte: (column: string, value: unknown) => QueryBuilder<T>;
  lte: (column: string, value: unknown) => QueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
};

function table<T>(name: string): QueryBuilder<T> {
  return supabase.from(name as never) as unknown as QueryBuilder<T>;
}

function toMatch(row: MatchRow): FootballMatch {
  return {
    id: row.id,
    provider: row.provider,
    providerId: row.provider_id,
    competitionCode: row.competition_code,
    competitionName: row.competition_name,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    elapsedMinute: row.elapsed_minute,
    kickoffAt: row.kickoff_at,
    updatedAt: row.updated_at,
    sourceUrl: row.source_url,
  };
}

export function useArenaCompetitionData() {
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [standings, setStandings] = useState<FootballStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const now = Date.now();
    const from = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(now + 45 * 24 * 60 * 60 * 1000).toISOString();
    const [matchResult, standingsResult] = await Promise.all([
      table<MatchRow>("football_matches")
        .select("id,provider,provider_id,competition_code,competition_name,home_team,away_team,home_score,away_score,status,elapsed_minute,kickoff_at,updated_at,source_url")
        .eq("provider", "football-data")
        .eq("is_published", true)
        .gte("kickoff_at", from)
        .lte("kickoff_at", to)
        .order("kickoff_at", { ascending: true })
        .limit(250),
      table<FootballStanding>("football_standings")
        .select("*")
        .eq("provider", "football-data")
        .order("position", { ascending: true })
        .limit(200),
    ]);

    if (matchResult.error || standingsResult.error) {
      setError("Fixtures and tables are temporarily unavailable. Please try refreshing.");
      setLoading(false);
      return;
    }

    const nextMatches = (matchResult.data ?? []).map(toMatch);
    const nextStandings = standingsResult.data ?? [];
    setMatches(nextMatches);
    setStandings(nextStandings);
    const timestamps = [
      ...nextMatches.map((match) => match.updatedAt),
      ...nextStandings.map((standing) => standing.updated_at),
    ].filter(Boolean).sort();
    setLastUpdated(timestamps.at(-1) ?? null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { matches, standings, loading, error, lastUpdated, refresh };
}
