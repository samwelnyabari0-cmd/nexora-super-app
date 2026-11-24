import type { FootballMatch } from "./types";

export type ArenaCompetitionCode = "ALL" | "PL" | "CL" | "PD" | "BL1" | "SA" | "FL1";
export type ArenaMatchList = "fixtures" | "results";

export const ARENA_COMPETITIONS: { code: Exclude<ArenaCompetitionCode, "ALL">; label: string }[] = [
  { code: "PL", label: "Premier League" },
  { code: "CL", label: "Champions League" },
  { code: "PD", label: "La Liga" },
  { code: "BL1", label: "Bundesliga" },
  { code: "SA", label: "Serie A" },
  { code: "FL1", label: "Ligue 1" },
];

export function selectArenaMatches(
  matches: FootballMatch[],
  list: ArenaMatchList,
  competition: ArenaCompetitionCode = "ALL",
): FootballMatch[] {
  return matches
    .filter((match) => match.provider === "football-data")
    .filter((match) => list === "fixtures"
      ? match.status === "SCHEDULED" || match.status === "POSTPONED"
      : match.status === "FT" || match.status === "CANCELLED" || match.status === "ABANDONED")
    .filter((match) => competition === "ALL" || match.competitionCode === competition)
    .sort((left, right) => list === "fixtures"
      ? left.kickoffAt.localeCompare(right.kickoffAt)
      : right.kickoffAt.localeCompare(left.kickoffAt));
}
