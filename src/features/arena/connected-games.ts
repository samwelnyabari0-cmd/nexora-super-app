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

function createCoverArt(kind: "football" | "racing", title: string, accent: string, secondary: string): string {
  const scene = kind === "football"
    ? `<path d="M0 240 Q160 170 320 240 T640 220 V360 H0Z" fill="#0b563c"/><path d="M0 275 Q160 205 320 275 T640 255" fill="none" stroke="#8cf2b4" stroke-width="3" opacity=".65"/><path d="M320 205 V360 M220 275 H420" stroke="#d8ffe7" stroke-width="3" opacity=".55"/><circle cx="320" cy="275" r="48" fill="none" stroke="#d8ffe7" stroke-width="3" opacity=".55"/><circle cx="390" cy="210" r="25" fill="#fff"/><path d="m390 194 12 9-5 14h-14l-5-14z" fill="#1c2434"/>`
    : `<path d="M0 250 150 190 260 235 390 150 520 210 640 145 V360 H0Z" fill="#151a2c"/><path d="M0 290 640 205" stroke="#fff" stroke-width="3" opacity=".28"/><path d="M0 325 640 240" stroke="#fff" stroke-width="3" opacity=".18"/><path d="M120 275 170 235h175l70 40-20 42H140Z" fill="${accent}" stroke="#fff" stroke-width="3"/><path d="m210 236 25-30h75l28 30" fill="#a9d9ff" opacity=".85"/><circle cx="195" cy="316" r="25" fill="#090b13" stroke="#aab3c8" stroke-width="7"/><circle cx="370" cy="316" r="25" fill="#090b13" stroke="#aab3c8" stroke-width="7"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${secondary}"/><stop offset="1" stop-color="#10111b"/></linearGradient><radialGradient id="glow"><stop stop-color="${accent}" stop-opacity=".65"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><rect width="640" height="360" fill="url(#bg)"/><circle cx="500" cy="65" r="190" fill="url(#glow)"/><path d="M0 0H640V360H0Z" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="2"/>${scene}<rect x="0" y="0" width="640" height="360" fill="url(#bg)" opacity=".12"/><text x="34" y="54" fill="#fff" font-family="Arial,sans-serif" font-size="18" font-weight="700" letter-spacing="3">NEXORA • INSTANT PLAY</text><text x="34" y="105" fill="#fff" font-family="Arial,sans-serif" font-size="30" font-weight="800">${title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text><path d="M34 125H150" stroke="${accent}" stroke-width="6" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const connectedGames: readonly ConnectedGame[] = Object.freeze([
  {
    id: "soccer-lat",
    title: "Soccer Lat: 3D Football Online",
    description: "Play real-time 3D football matches, from 1v1 up to 11v11, with touch controls on mobile.",
    category: "football",
    provider: "CrazyGames · Soccer Lat",
    thumbnailUrl: createCoverArt("football", "SOCCER LAT", "#8b5cf6", "#182d3d"),
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
    thumbnailUrl: createCoverArt("football", "SOCCER 5", "#22c55e", "#123b37"),
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
    thumbnailUrl: createCoverArt("racing", "XTREME DRIFT", "#f97316", "#3d1830"),
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
    thumbnailUrl: createCoverArt("racing", "RACING LIMITS", "#06b6d4", "#102b48"),
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
