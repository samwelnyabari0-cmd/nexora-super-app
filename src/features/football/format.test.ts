import { describe, expect, it } from "vitest";
import {
  formatMatchStatus,
  filterMatchesByCompetition,
  isMatchStale,
  normalizeTeamKey,
} from "./format";
import type { FootballMatch } from "./types";

const match: FootballMatch = {
  id: "m1",
  provider: "api-football",
  providerId: "fixture-1",
  competitionCode: "EPL",
  competitionName: "Premier League",
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  homeScore: 2,
  awayScore: 1,
  status: "LIVE",
  elapsedMinute: 67,
  kickoffAt: "2026-11-22T14:00:00Z",
  updatedAt: "2026-11-22T15:07:00Z",
  sourceUrl: null,
};

describe("football match formatting", () => {
  it("formats live, half-time, full-time and scheduled states", () => {
    expect(formatMatchStatus(match)).toBe("LIVE 67′");
    expect(formatMatchStatus({ ...match, status: "HT", elapsedMinute: null })).toBe("HT");
    expect(formatMatchStatus({ ...match, status: "FT", elapsedMinute: null })).toBe("FT");
    expect(formatMatchStatus({ ...match, status: "SCHEDULED", elapsedMinute: null })).toBe("14:00");
  });

  it("filters all, live and selected competitions", () => {
    expect(filterMatchesByCompetition([match], "ALL")).toHaveLength(1);
    expect(filterMatchesByCompetition([match], "LIVE")).toHaveLength(1);
    expect(filterMatchesByCompetition([match], "UCL")).toHaveLength(0);
    expect(filterMatchesByCompetition([match], "EPL")).toHaveLength(1);
  });

  it("marks old cache rows as stale without hiding them", () => {
    expect(isMatchStale(match, new Date("2026-11-22T15:10:00Z"))).toBe(false);
    expect(isMatchStale(match, new Date("2026-11-22T15:20:00Z"))).toBe(true);
  });
});

describe("favorite team keys", () => {
  it("normalizes team names for stable club sync matching", () => {
    expect(normalizeTeamKey(" Manchester United ")).toBe("manchester-united");
    expect(normalizeTeamKey("AFC Wimbledon & Co.")).toBe("afc-wimbledon-co");
  });
});
