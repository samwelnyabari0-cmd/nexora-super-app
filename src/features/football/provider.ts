type ProviderStatus = "SCHEDULED" | "LIVE" | "HT" | "FT" | "POSTPONED" | "CANCELLED" | "ABANDONED";

export type ApiFootballMatchRow = {
  provider: "api-football";
  provider_id: string;
  competition_code: string;
  competition_name: string;
  home_team: string;
  away_team: string;
  home_team_provider_id: string | null;
  away_team_provider_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: ProviderStatus;
  elapsed_minute: number | null;
  kickoff_at: string;
  source_url: null;
  is_published: true;
  updated_at: string;
};

type ApiFootballFixture = {
  fixture?: {
    id?: number | string;
    date?: string;
    status?: { short?: string; elapsed?: number | null };
  };
  league?: { id?: number | string; name?: string; country?: string };
  teams?: {
    home?: { id?: number | string; name?: string };
    away?: { id?: number | string; name?: string };
  };
  goals?: { home?: number | null; away?: number | null };
};

function statusFromProvider(value: string | undefined): ProviderStatus {
  if (["1H", "2H", "ET", "BT", "P", "LIVE", "SUSP", "INT"].includes(value ?? "")) return "LIVE";
  if (value === "HT") return "HT";
  if (["FT", "AET", "PEN"].includes(value ?? "")) return "FT";
  if (value === "PST") return "POSTPONED";
  if (value === "CANC") return "CANCELLED";
  if (["ABD", "AWD", "WO"].includes(value ?? "")) return "ABANDONED";
  return "SCHEDULED";
}

function competitionCode(name: string, fallbackId: string, country = ""): string {
  const normalized = name.toLocaleLowerCase();
  if (
    normalized.includes("fkf") ||
    normalized.includes("kenyan premier league") ||
    country.toLocaleLowerCase() === "kenya"
  )
    return "FKF";
  if (normalized.includes("premier league") && !normalized.includes("kenya")) return "EPL";
  if (normalized.includes("champions league")) return "UCL";
  if (normalized.includes("la liga") || normalized.includes("laliga")) return "LALIGA";
  return fallbackId;
}

export function normalizeApiFootballFixture(
  value: unknown,
  updatedAt = new Date().toISOString(),
): ApiFootballMatchRow | null {
  const fixture = value as ApiFootballFixture;
  const id = fixture?.fixture?.id;
  const kickoffAt = fixture?.fixture?.date;
  const homeTeam = fixture?.teams?.home?.name;
  const awayTeam = fixture?.teams?.away?.name;
  const leagueName = fixture?.league?.name;
  if (id === undefined || !kickoffAt || !homeTeam || !awayTeam || !leagueName) return null;
  const kickoffTime = new Date(kickoffAt);
  if (!Number.isFinite(kickoffTime.getTime())) return null;
  const elapsed = fixture.fixture?.status?.elapsed;
  const leagueId = fixture.league?.id;
  return {
    provider: "api-football",
    provider_id: String(id),
    competition_code: competitionCode(
      leagueName,
      leagueId === undefined ? "OTHER" : String(leagueId),
    ),
    competition_name: leagueName,
    home_team: homeTeam,
    away_team: awayTeam,
    home_team_provider_id:
      fixture.teams?.home?.id === undefined ? null : String(fixture.teams.home.id),
    away_team_provider_id:
      fixture.teams?.away?.id === undefined ? null : String(fixture.teams.away.id),
    home_score: fixture.goals?.home ?? null,
    away_score: fixture.goals?.away ?? null,
    status: statusFromProvider(fixture.fixture?.status?.short),
    elapsed_minute: typeof elapsed === "number" ? elapsed : null,
    kickoff_at: kickoffTime.toISOString(),
    source_url: null,
    is_published: true,
    updated_at: updatedAt,
  };
}
