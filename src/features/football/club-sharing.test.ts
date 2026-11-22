import { describe, expect, it } from "vitest";
import { buildMatchShareMessage, hasActiveClubMembership } from "./club-sharing";
import type { FootballMatch } from "./types";

const match: FootballMatch = {
  id: "fixture-1",
  provider: "api-football",
  providerId: "1",
  competitionCode: "EPL",
  competitionName: "Premier League",
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  homeScore: 2,
  awayScore: 1,
  status: "LIVE",
  elapsedMinute: 67,
  kickoffAt: "2026-11-22T14:00:00.000Z",
  updatedAt: "2026-11-22T15:07:00.000Z",
  sourceUrl: null,
};

describe("club match sharing", () => {
  it("allows sharing only when the current user has active club membership", () => {
    expect(hasActiveClubMembership({ user_id: "member-1", status: "active" }, "member-1")).toBe(
      true,
    );
    expect(hasActiveClubMembership({ user_id: "member-1", status: "pending" }, "member-1")).toBe(
      false,
    );
    expect(hasActiveClubMembership({ user_id: "other-user", status: "active" }, "member-1")).toBe(
      false,
    );
    expect(hasActiveClubMembership(null, "member-1")).toBe(false);
    expect(hasActiveClubMembership({ user_id: "member-1", status: "active" }, null)).toBe(false);
  });

  it("builds a compact score card with the live minute", () => {
    expect(buildMatchShareMessage(match)).toBe(
      "⚽ Premier League\nArsenal 2 - 1 Chelsea\nLIVE 67′\nNexora Match Center",
    );
  });
});
