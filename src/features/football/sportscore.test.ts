import { describe, expect, it } from "vitest";
import { normalizeSportScoreMatches } from "./sportscore";

describe("SportScore widget normalization", () => {
  it("normalizes live scores and their competition metadata", () => {
    const matches = normalizeSportScoreMatches({
      matches: [
        {
          slug: "arsenal-chelsea-2026-11-24",
          home: "Arsenal",
          away: "Chelsea",
          home_score: 2,
          away_score: 1,
          status: "live",
          status_text: "67'",
          time: "2026-11-24T19:00:00Z",
          competition_name: "Premier League",
        },
      ],
    }, "2026-11-24T20:07:00Z");

    expect(matches).toEqual([
      {
        id: "sportscore:arsenal-chelsea-2026-11-24",
        provider: "sportscore",
        providerId: "arsenal-chelsea-2026-11-24",
        competitionCode: "EPL",
        competitionName: "Premier League",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        homeScore: 2,
        awayScore: 1,
        status: "LIVE",
        elapsedMinute: 67,
        kickoffAt: "2026-11-24T19:00:00.000Z",
        updatedAt: "2026-11-24T20:07:00Z",
        sourceUrl: null,
      },
    ]);
  });

  it("marks finished games and ignores incomplete records", () => {
    const matches = normalizeSportScoreMatches({
      matches: [
        {
          slug: "finished-game",
          home: "Team A",
          away: "Team B",
          home_score: 0,
          away_score: 0,
          status: "finished",
          status_text: "FT",
          time: "2026-11-24T16:00:00Z",
        },
        { home: "Missing ID", away: "Team C" },
      ],
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      provider: "sportscore",
      status: "FT",
      homeScore: 0,
      awayScore: 0,
    });
  });
});
