import type { FootballMatch } from "./types";

export type GoalScoreSnapshot = {
  homeScore: number;
  awayScore: number;
};

export type GoalAlert = {
  id: string;
  matchId: string;
  competitionName: string;
  homeTeam: string;
  awayTeam: string;
  scoringTeam: string;
  side: "home" | "away";
  score: string;
  minute: number | null;
};

export function detectGoalAlerts(
  previous: ReadonlyMap<string, GoalScoreSnapshot>,
  matches: readonly FootballMatch[],
  previouslySeen: ReadonlySet<string> = new Set(),
): {
  alerts: GoalAlert[];
  snapshots: Map<string, GoalScoreSnapshot>;
  seen: Set<string>;
} {
  const snapshots = new Map(previous);
  const seen = new Set(previouslySeen);
  const alerts: GoalAlert[] = [];

  for (const match of matches) {
    if (match.homeScore === null || match.awayScore === null) continue;

    const before = previous.get(match.id);
    const current = { homeScore: match.homeScore, awayScore: match.awayScore };

    // The first observation is a baseline, not a goal notification.
    if (!before) {
      // Mark every already-observed score level as seen so a later score correction
      // and restoration cannot masquerade as a newly scored goal.
      for (const side of ["home", "away"] as const) {
        const baselineScore = side === "home" ? current.homeScore : current.awayScore;
        for (let score = 1; score <= baselineScore; score += 1) {
          seen.add([match.provider, match.providerId, side, score].join(":"));
        }
      }
    }

    if (before) {
      const sides = [
        { side: "home" as const, team: match.homeTeam, oldScore: before.homeScore, newScore: current.homeScore },
        { side: "away" as const, team: match.awayTeam, oldScore: before.awayScore, newScore: current.awayScore },
      ];

      for (const item of sides) {
        if (item.newScore <= item.oldScore) continue;
        for (let score = item.oldScore + 1; score <= item.newScore; score += 1) {
          const id = [match.provider, match.providerId, item.side, score].join(":");
          if (seen.has(id)) continue;
          seen.add(id);
          const homeScore = item.side === "home" ? score : current.homeScore;
          const awayScore = item.side === "away" ? score : current.awayScore;
          alerts.push({
            id,
            matchId: match.id,
            competitionName: match.competitionName,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            scoringTeam: item.team,
            side: item.side,
            score: `${homeScore}–${awayScore}`,
            minute: match.elapsedMinute,
          });
        }
      }
    }

    // Also accept score corrections as the new baseline, but never announce a decrease.
    snapshots.set(match.id, current);
  }

  return { alerts, snapshots, seen };
}
