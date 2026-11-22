import { describe, expect, it } from "vitest";
import { normalizeApiFootballFixture } from "./provider";

describe("API-Football fixture adapter", () => {
  it("normalizes live match data and maps supported competition names", () => {
    const row = normalizeApiFootballFixture(
      {
        fixture: {
          id: 1234,
          date: "2026-11-22T14:00:00+00:00",
          status: { short: "2H", elapsed: 67 },
        },
        league: { id: 39, name: "Premier League" },
        teams: { home: { id: 42, name: "Arsenal" }, away: { id: 49, name: "Chelsea" } },
        goals: { home: 2, away: 1 },
      },
      "2026-11-22T15:07:00.000Z",
    );
    expect(row).toMatchObject({
      provider: "api-football",
      provider_id: "1234",
      competition_code: "EPL",
      home_team: "Arsenal",
      away_team: "Chelsea",
      home_score: 2,
      away_score: 1,
      status: "LIVE",
      elapsed_minute: 67,
      home_team_provider_id: "42",
      away_team_provider_id: "49",
    });
  });

  it("returns null for malformed fixtures and maps terminal states", () => {
    expect(
      normalizeApiFootballFixture({ fixture: {}, league: {}, teams: {}, goals: {} }),
    ).toBeNull();
    const row = normalizeApiFootballFixture({
      fixture: { id: 2, date: "2026-11-22T14:00:00Z", status: { short: "FT", elapsed: 90 } },
      league: { id: 2, name: "UEFA Champions League" },
      teams: { home: { id: 1, name: "A" }, away: { id: 2, name: "B" } },
      goals: { home: 0, away: 0 },
    });
    expect(row?.status).toBe("FT");
    expect(row?.competition_code).toBe("UCL");
    const fkf = normalizeApiFootballFixture({
      fixture: { id: 3, date: "2026-11-22T14:00:00Z", status: { short: "NS" } },
      league: { id: 289, name: "FKF Premier League" },
      teams: { home: { id: 10, name: "Gor Mahia" }, away: { id: 11, name: "AFC Leopards" } },
      goals: { home: null, away: null },
    });
    expect(fkf?.competition_code).toBe("FKF");
  });
});
