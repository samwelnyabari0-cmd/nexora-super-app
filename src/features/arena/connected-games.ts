export const connectedGameCategories = [
  "football",
  "racing",
  "sports",
  "arcade",
  "puzzle",
  "strategy",
] as const;

export type ConnectedGameCategory = (typeof connectedGameCategories)[number];
export type ConnectedGameMode = "embed" | "external";

export type ConnectedGame = {
  id: string;
  title: string;
  description: string;
  category: ConnectedGameCategory;
  provider: string;
  thumbnailUrl?: string;
  gameUrl: string;
  mode: ConnectedGameMode;
  embedUrl?: string;
  embedOrigin?: string;
  approved: boolean;
  attribution?: string;
  allowFullscreen?: boolean;
};

export const connectedGames: readonly ConnectedGame[] = Object.freeze([
  {
    id: "soccer-lat",
    title: "Soccer Lat: 3D Football Online",
    description: "Play real-time 3D football matches, from 1v1 up to 11v11, with touch controls on mobile.",
    category: "football",
    provider: "CrazyGames · Soccer Lat",
    gameUrl: "https://www.crazygames.com/game/soccer-lat-3d-football-online",
    mode: "external",
    approved: true,
    attribution: "Game by its original publisher; opens on CrazyGames.",
  },
  {
    id: "soccer-5",
    title: "Soccer 5",
    description: "Fast five-a-side football. Play solo or challenge a friend on the same device.",
    category: "football",
    provider: "Poki · Radical Play",
    gameUrl: "https://poki.com/en/g/soccer-5",
    mode: "external",
    approved: true,
    attribution: "Game by Radical Play; opens on Poki.",
  },
  {
    id: "xtreme-drift-racing",
    title: "Xtreme DRIFT Racing",
    description: "Drift across five tracks and choose from more than 30 cars, including tuned and cyberpunk styles.",
    category: "racing",
    provider: "CrazyGames · Kraken Ink Studio",
    gameUrl: "https://www.crazygames.com/game/xtreme-drift-racing",
    mode: "external",
    approved: true,
    attribution: "Game by Kraken Ink Studio; opens on CrazyGames.",
  },
  {
    id: "racing-limits",
    title: "Racing Limits",
    description: "Race through city and highway traffic with career, time, infinite, and free modes.",
    category: "racing",
    provider: "CrazyGames · Valvolex",
    gameUrl: "https://www.crazygames.com/game/racing-limits",
    mode: "external",
    approved: true,
    attribution: "Game by Valvolex; opens on CrazyGames.",
  },
]);

export function isApprovedEmbedUrl(game: ConnectedGame, candidate: string): boolean {
  if (!game.approved || game.mode !== "embed" || !game.embedOrigin || !game.embedUrl) {
    return false;
  }

  try {
    const candidateUrl = new URL(candidate);
    const configuredUrl = new URL(game.embedUrl);
    const approvedOrigin = new URL(game.embedOrigin);

    if (
      candidateUrl.protocol !== "https:" ||
      configuredUrl.protocol !== "https:" ||
      approvedOrigin.protocol !== "https:" ||
      candidateUrl.username ||
      candidateUrl.password ||
      configuredUrl.username ||
      configuredUrl.password ||
      approvedOrigin.username ||
      approvedOrigin.password ||
      candidateUrl.port !== "" && candidateUrl.port !== "443" ||
      configuredUrl.port !== "" && configuredUrl.port !== "443" ||
      approvedOrigin.port !== "" && approvedOrigin.port !== "443"
    ) {
      return false;
    }

    return candidateUrl.origin === approvedOrigin.origin &&
      configuredUrl.origin === approvedOrigin.origin &&
      candidateUrl.origin === configuredUrl.origin;
  } catch {
    return false;
  }
}

export function isSafeGameUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.port === "" || url.port === "443");
  } catch {
    return false;
  }
}
