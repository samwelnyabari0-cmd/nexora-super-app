import { describe, expect, it } from "vitest";
import type { FootballMatch } from "./types";
import { detectGoalAlerts } from "./goal-alerts";

const match = (overrides: Partial<FootballMatch> = {}): FootballMatch => ({
  id: "sportscore:arsenal-chelsea",
  provider: "sportscore",
  providerId: "arsenal-chelsea",
  competitionCode: "EPL",
  competitionName: "Premier League",
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  homeScore: 0,
  awayScore: 0,
  status: "LIVE",
  elapsedMinute: 12,
  kickoffAt: "2026-11-25T18:00:00.000Z",
  updatedAt: "2026-11-25T18:12:00.000Z",
  sourceUrl: null,
  ...overrides,
});

describe("automatic goal alert detection", () => {
  it("seeds the first score as a baseline without alerting", () => {
    const result = detectGoalAlerts(new Map(), [match({ homeScore: 2, awayScore: 1 })]);
    expect(result.alerts).toEqual([]);
    expect(result.snapshots.get("sportscore:arsenal-chelsea")).toEqual({ homeScore: 2, awayScore: 1 });
  });

  it("announces a home or away score increase once", () => {
    const baseline = new Map([["sportscore:arsenal-chelsea", { homeScore: 0, awayScore: 0 }]]);
    const result = detectGoalAlerts(baseline, [match({ homeScore: 1, awayScore: 1 })]);
    expect(result.alerts.map(({ scoringTeam, side, score }) => ({ scoringTeam, side, score }))).toEqual([
      { scoringTeam: "Arsenal", side: "home", score: "1–1" },
      { scoringTeam: "Chelsea", side: "away", score: "1–1" },
    ]);
    const repeated = detectGoalAlerts(result.snapshots, [match({ homeScore: 1, awayScore: 1 })], result.seen);
    expect(repeated.alerts).toEqual([]);
  });

  it("emits one event for each newly observed score increment", () => {
    const baseline = new Map([["sportscore:arsenal-chelsea", { homeScore: 0, awayScore: 0 }]]);
    const result = detectGoalAlerts(baseline, [match({ homeScore: 2, awayScore: 0 })]);
    expect(result.alerts.map((alert) => alert.score)).toEqual(["1–0", "2–0"]);
  });

  it("ignores minute and status changes and score decreases", () => {
    const baseline = new Map([["sportscore:arsenal-chelsea", { homeScore: 1, awayScore: 0 }]]);
    const result = detectGoalAlerts(baseline, [match({ homeScore: 1, awayScore: 0, status: "HT", elapsedMinute: null })]);
    expect(result.alerts).toEqual([]);
    const corrected = detectGoalAlerts(baseline, [match({ homeScore: 0, awayScore: 0 })]);
    expect(corrected.alerts).toEqual([]);
  });

  it("does not announce a score that returns after a correction", () => {
    const baseline = new Map([["sportscore:arsenal-chelsea", { homeScore: 1, awayScore: 0 }]]);
    const seen = new Set(["sportscore:arsenal-chelsea:home:2"]);
    const result = detectGoalAlerts(baseline, [match({ homeScore: 0, awayScore: 0 })], seen);
    const restored = detectGoalAlerts(result.snapshots, [match({ homeScore: 2, awayScore: 0 })], result.seen);
    expect(restored.alerts).toEqual([]);
  });

  it("does not infer a goal when either score is missing", () => {
    const baseline = new Map([["sportscore:arsenal-chelsea", { homeScore: 0, awayScore: 0 }]]);
    const result = detectGoalAlerts(baseline, [match({ homeScore: null })]);
    expect(result.alerts).toEqual([]);
    expect(result.snapshots.get("sportscore:arsenal-chelsea")).toEqual({ homeScore: 0, awayScore: 0 });
  });
});
