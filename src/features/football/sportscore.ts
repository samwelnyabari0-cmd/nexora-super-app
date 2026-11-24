import type { FootballMatch, FootballMatchStatus } from "./types";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function first(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const item = asRecord(value);
  const nested = first(item.name, item.title, item.display_name, item.short_name);
  return typeof nested === "string" && nested.trim() ? nested.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function timestampValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value < 10_000_000_000 ? value * 1000 : value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function competitionCode(name: string): string {
  const normalized = name.toLocaleLowerCase();
  if (normalized.includes("fkf") || normalized.includes("kenyan premier league")) return "FKF";
  if (normalized.includes("premier league") && !normalized.includes("kenya")) return "EPL";
  if (normalized.includes("champions league")) return "UCL";
  if (normalized.includes("la liga") || normalized.includes("laliga")) return "LALIGA";
  return "OTHER";
}

function statusFromProvider(status: string, statusText: string): FootballMatchStatus {
  const value = (status + " " + statusText).trim().toLocaleLowerCase();
  if (/postpon/.test(value)) return "POSTPONED";
  if (/cancel/.test(value)) return "CANCELLED";
  if (/abandon|walkover/.test(value)) return "ABANDONED";
  if (/half.?time|\bht\b|break/.test(value)) return "HT";
  if (/finished|full.?time|\bft\b|after extra|penalt/.test(value)) return "FT";
  if (/live|in.?play|progress|ongoing|playing|first half|second half|extra time|\b1h\b|\b2h\b/.test(value)) {
    return "LIVE";
  }
  return "SCHEDULED";
}

function elapsedMinute(statusText: string, value: unknown): number | null {
  const direct = numberValue(value);
  if (direct !== null) return direct;
  const match = statusText.match(/(\d{1,3})\s*(?:\+\s*\d+)?\s*(?:['′m]|min)/i);
  return match ? Number(match[1]) : null;
}

function matchesFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  const nested = asRecord(root.data);
  const matches = first(root.matches, root.fixtures, root.results, nested.matches, nested.fixtures);
  if (!Array.isArray(matches)) throw new Error("SportScore returned an unexpected live-score response.");
  return matches;
}

export function normalizeSportScoreMatches(
  payload: unknown,
  updatedAt = new Date().toISOString(),
): FootballMatch[] {
  const matches = matchesFromPayload(payload);
  const normalized = matches
    .map((value): FootballMatch | null => {
      const match = asRecord(value);
      const home = asRecord(first(match.home, match.home_team, match.homeTeam));
      const away = asRecord(first(match.away, match.away_team, match.awayTeam));
      const homeTeam = textValue(first(home.name, home.title, match.home, match.home_team, match.homeTeam));
      const awayTeam = textValue(first(away.name, away.title, match.away, match.away_team, match.awayTeam));
      const providerId = textValue(first(match.slug, match.id, match.match_id, match.fixture_id, match.event_id));
      const kickoffAt = timestampValue(first(
        match.time, match.kickoff_at, match.kickoff, match.date, match.start_time, match.startTime,
      ));
      if (!providerId || !homeTeam || !awayTeam || !kickoffAt) return null;

      const competition = asRecord(first(match.competition, match.league, match.tournament));
      const competitionName = textValue(first(
        match.competition_name, match.league_name, competition.name, competition.title,
        match.competition, match.league,
      )) ?? "Football";
      const score = asRecord(match.score);
      const goals = asRecord(match.goals);
      const status = asRecord(match.status);
      const statusText = textValue(first(
        match.status_text, match.statusText, status.description, status.detail,
        match.elapsed, match.minute,
      )) ?? "";
      const statusValue = textValue(first(
        status.short, status.code, status.name, match.status_code, match.state, match.status,
      )) ?? "";

      return {
        id: "sportscore:" + providerId,
        provider: "sportscore",
        providerId,
        competitionCode: competitionCode(competitionName),
        competitionName,
        homeTeam,
        awayTeam,
        homeScore: numberValue(first(match.home_score, match.homeScore, score.home, goals.home)),
        awayScore: numberValue(first(match.away_score, match.awayScore, score.away, goals.away)),
        status: statusFromProvider(statusValue, statusText),
        elapsedMinute: elapsedMinute(
          statusText,
          first(match.elapsed_minute, match.elapsedMinute, match.minute),
        ),
        kickoffAt,
        updatedAt: textValue(match.updated_at) ?? updatedAt,
        sourceUrl: null,
      };
    })
    .filter((match): match is FootballMatch => match !== null);

  const unique = new Map<string, FootballMatch>();
  for (const match of normalized) unique.set(match.providerId, match);
  return [...unique.values()];
}

export async function fetchSportScoreMatches(
  fetcher: typeof fetch = fetch,
): Promise<FootballMatch[]> {
  const url = new URL("https://sportscore.com/api/widget/matches/");
  url.searchParams.set("sport", "football");
  url.searchParams.set("limit", "50");
  url.searchParams.set("src", "nexora");
  const response = await fetcher(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("SportScore live scores are temporarily unavailable.");
  return normalizeSportScoreMatches(await response.json());
}
