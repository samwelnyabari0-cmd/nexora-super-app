import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatMatchStatus } from "@/features/football/format";
import type { FootballMatch } from "@/features/football/types";

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

function mapMatch(row: MatchRow): FootballMatch {
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

export function FootballMatchPreview() {
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const query = supabase
        .from("football_matches" as never)
        .select("*")
        .eq("is_published", true)
        .gte("kickoff_at", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
        .lte("kickoff_at", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("kickoff_at", { ascending: true })
        .limit(3);
      const result = await (query as unknown as Promise<{
        data: MatchRow[] | null;
        error: { message: string } | null;
      }>);
      if (active && !result.error) setMatches((result.data ?? []).map(mapMatch));
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      className="mb-5 rounded-2xl border bg-card p-3"
      aria-label="Football match center preview"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Trophy className="h-4 w-4 text-primary" />
          Football Match Center
        </h2>
        <Link
          to="/match-center"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {matches.length ? (
        <div className="divide-y">
          {matches.map((match) => (
            <div key={match.id} className="flex items-center justify-between gap-3 py-2 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] text-muted-foreground">
                  {match.competitionName}
                </p>
                <p className="truncate font-medium">
                  {match.homeTeam}{" "}
                  <span className="font-bold tabular-nums">
                    {match.homeScore ?? "–"}:{match.awayScore ?? "–"}
                  </span>{" "}
                  {match.awayTeam}
                </p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-semibold ${match.status === "LIVE" ? "text-red-500" : "text-muted-foreground"}`}
              >
                {formatMatchStatus(match)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-2 text-xs text-muted-foreground">
          Live scores will appear here when the football cache is connected.
        </p>
      )}
    </section>
  );
}
