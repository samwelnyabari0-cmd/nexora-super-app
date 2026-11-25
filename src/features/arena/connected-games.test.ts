import { describe, expect, it } from "vitest";
import {
  connectedGames,
  isApprovedEmbedUrl,
  isSafeGameUrl,
  type ConnectedGame,
} from "./connected-games";

const embeddedGame: ConnectedGame = {
  id: "demo",
  title: "Demo Game",
  description: "A reviewed browser game.",
  category: "arcade",
  provider: "Example Provider",
  thumbnailUrl: "https://cdn.example.com/demo.webp",
  gameUrl: "https://games.example.com/demo",
  mode: "embed",
  embedUrl: "https://play.example.com/demo",
  embedOrigin: "https://play.example.com",
  approved: true,
  attribution: "Example Provider",
};

describe("connected games registry", () => {
  it("exposes only the four curated external browser games", () => {
    expect(connectedGames.map((game) => game.id)).toEqual([
      "soccer-lat",
      "soccer-5",
      "xtreme-drift-racing",
      "racing-limits",
    ]);
    expect(connectedGames.every((game) => game.approved && game.mode === "external")).toBe(true);
    expect(connectedGames.every((game) => isSafeGameUrl(game.gameUrl))).toBe(true);
    expect(connectedGames.every((game) => !game.embedUrl && !game.embedOrigin)).toBe(true);
  });

  it("accepts HTTPS embed URLs only at the exact approved origin", () => {
    expect(isApprovedEmbedUrl(embeddedGame, "https://play.example.com/demo?level=1")).toBe(true);
    expect(isApprovedEmbedUrl(embeddedGame, "https://play.example.com:443/demo")).toBe(true);
  });

  it.each([
    "http://play.example.com/demo",
    "javascript:alert(1)",
    "https://user:pass@play.example.com/demo",
    "https://play.example.com:8443/demo",
    "https://evil.example.com/demo",
    "not a url",
  ])("rejects unsafe or unapproved embed URL %s", (candidate) => {
    expect(isApprovedEmbedUrl(embeddedGame, candidate)).toBe(false);
  });

  it("does not allow external-play entries to be embedded", () => {
    expect(
      isApprovedEmbedUrl({ ...embeddedGame, mode: "external", embedUrl: undefined }, embeddedGame.embedUrl!),
    ).toBe(false);
  });

  it("rejects entries that are not approved or have no declared embed origin", () => {
    expect(isApprovedEmbedUrl({ ...embeddedGame, approved: false }, embeddedGame.embedUrl!)).toBe(false);
    expect(isApprovedEmbedUrl({ ...embeddedGame, embedOrigin: undefined }, embeddedGame.embedUrl!)).toBe(false);
  });
});

describe("connected game outbound URL policy", () => {
  it("allows only HTTPS URLs without credentials or non-standard ports", () => {
    expect(isSafeGameUrl("https://games.example.com/title")).toBe(true);
    expect(isSafeGameUrl("https://games.example.com:443/title")).toBe(true);
    expect(isSafeGameUrl("http://games.example.com/title")).toBe(false);
    expect(isSafeGameUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeGameUrl("https://user:pass@games.example.com/title")).toBe(false);
    expect(isSafeGameUrl("https://games.example.com:8443/title")).toBe(false);
    expect(isSafeGameUrl("not a URL")).toBe(false);
  });
});
