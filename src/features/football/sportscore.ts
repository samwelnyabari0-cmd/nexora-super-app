import type { FootballMatch } from "./types";

export function normalizeSportScoreMatches(
  _payload: unknown,
  _updatedAt = new Date().toISOString(),
): FootballMatch[] {
  return [];
}
