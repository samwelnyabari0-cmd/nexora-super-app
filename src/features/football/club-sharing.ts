import type { FootballMatch } from "./types";

export type ClubMembershipAccess = { user_id: string; status: string } | null;

export function hasActiveClubMembership(
  membership: ClubMembershipAccess,
  userId: string | null,
): boolean {
  return Boolean(
    userId && membership && membership.user_id === userId && membership.status === "active",
  );
}

export function buildMatchShareMessage(match: FootballMatch): string {
  const score = `${match.homeScore ?? "–"} - ${match.awayScore ?? "–"}`;
  const status =
    match.status === "LIVE" && match.elapsedMinute !== null
      ? `LIVE ${match.elapsedMinute}′`
      : match.status;
  return `⚽ ${match.competitionName}\n${match.homeTeam} ${score} ${match.awayTeam}\n${status}\nNexora Match Center`;
}
