import type { FootballMatch } from "./types";

export type CompetitionFilter = "ALL" | "LIVE" | "EPL" | "UCL" | "LALIGA" | "FKF";

export function formatMatchStatus(match: FootballMatch): string {
  if (match.status === "LIVE")
    return match.elapsedMinute === null ? "LIVE" : `LIVE ${match.elapsedMinute}′`;
  if (match.status === "SCHEDULED") {
    return new Date(match.kickoffAt).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (match.status === "POSTPONED") return "PST";
  if (match.status === "CANCELLED") return "CANC";
  if (match.status === "ABANDONED") return "ABD";
  return match.status;
}

export function filterMatchesByCompetition(
  matches: FootballMatch[],
  filter: CompetitionFilter,
): FootballMatch[] {
  if (filter === "ALL") return matches;
  if (filter === "LIVE")
    return matches.filter((match) => match.status === "LIVE" || match.status === "HT");
  return matches.filter((match) => match.competitionCode.toUpperCase() === filter);
}

export function isMatchStale(
  match: FootballMatch,
  now = new Date(),
  maxAgeMs = 5 * 60 * 1000,
): boolean {
  const updatedAt = new Date(match.updatedAt).getTime();
  return !Number.isFinite(updatedAt) || now.getTime() - updatedAt > maxAgeMs;
}

export function normalizeTeamKey(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
