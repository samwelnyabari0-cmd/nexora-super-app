import { describe, expect, it } from "vitest";
import { selectArenaMatches } from "./arena-fixtures";
import type { FootballMatch } from "./types";

function match(overrides: Partial<FootballMatch> = {}): FootballMatch {
  return {
    id: "match-1",
    provider: "football-data",
    providerId: "1",
    competitionCode: "PL",
    competitionName: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    homeScore: null,
    awayScore: null,
    status: "SCHEDULED",
    elapsedMinute: null,
    kickoffAt: "2026-11-26T17:00:00.000Z",
    updatedAt: "2026-11-25T10:00:00.000Z",
    sourceUrl: null,
    ...overrides,
  };
}

describe("selectArenaMatches", () => {
  it("returns only upcoming provider fixtures in kickoff order", () => {
    const later = match({ id: "later", kickoffAt: "2026-11-27T17:00:00.000Z" });
    const earlier = match({ id: "earlier", kickoffAt: "2026-11-26T12:00:00.000Z" });
    const finished = match({ id: "finished", status: "FT" });
    const otherProvider = match({ id: "sportscore", provider: "sportscore" });

    expect(selectArenaMatches([later, finished, earlier, otherProvider], "fixtures").map((item) => item.id))
      .toEqual(["earlier", "later"]);
  });

  it("returns completed results newest first", () => {
    const older = match({ id: "older", status: "FT", kickoffAt: "2026-11-24T17:00:00.000Z" });
    const newer = match({ id: "newer", status: "FT", kickoffAt: "2026-11-25T17:00:00.000Z" });

    expect(selectArenaMatches([older, newer], "results").map((item) => item.id))
      .toEqual(["newer", "older"]);
  });

  it("filters by competition without mixing other leagues", () => {
    const premierLeague = match();
    const championsLeague = match({ id: "ucl", competitionCode: "CL" });

    expect(selectArenaMatches([premierLeague, championsLeague], "fixtures", "CL").map((item) => item.id))
      .toEqual(["ucl"]);
  });
});
