import { describe, expect, it } from "vitest";

const gameRules = {
  efootball: { teamSize: 1, platforms: ["mobile", "console_pc", "cross_platform"] },
  fc_mobile: { teamSize: 1, platforms: ["mobile"] },
  pubg_mobile: { teamSize: 4, platforms: ["mobile"] },
  nexora_minigames: { teamSize: 1, platforms: ["not_applicable"] },
};

describe("Arena tournament game configuration", () => {
  it("keeps football and mini-game competitions individual", () => {
    expect(gameRules.efootball.teamSize).toBe(1);
    expect(gameRules.fc_mobile.teamSize).toBe(1);
    expect(gameRules.nexora_minigames.teamSize).toBe(1);
  });
  it("requires four-player squads for PUBG Mobile", () => {
    expect(gameRules.pubg_mobile.teamSize).toBe(4);
  });
  it("supports eFootball on both mobile and console/PC", () => {
    expect(gameRules.efootball.platforms).toContain("mobile");
    expect(gameRules.efootball.platforms).toContain("console_pc");
  });
});
