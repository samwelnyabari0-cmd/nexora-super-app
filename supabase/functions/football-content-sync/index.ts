import { fetchPublisherImage } from "./news-image-enrichment.ts";
type NewsItem = {
  provider: string;
  provider_id: string;
  source_name: string;
  headline: string;
  summary: string;
  thumbnail_url: string | null;
  video_url: string | null;
  thumbnail_checked_at: string | null;
  source_url: string;
  published_at: string;
  is_published: boolean;
};
type HighlightItem = {
  provider: string;
  provider_id: string;
  competition_code: string | null;
  match_label: string;
  score_label: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  video_url: string;
  source_name: string;
  published_at: string;
  is_published: boolean;
};
const NEWS_FEEDS = [
  { name: "Sky Sports", provider: "sky-sports-rss", url: "https://www.skysports.com/rss/11095", hosts: ["skysports.com"] },
  { name: "ESPN Sports", provider: "espn-sports-rss", url: "https://www.espn.com/espn/rss/news", hosts: ["espn.com", "espncdn.com"] },
  { name: "BBC Sport", provider: "bbc-sport-rss", url: "https://feeds.bbci.co.uk/sport/rss.xml", hosts: ["bbc.com", "bbc.co.uk"] },
  { name: "BBC World", provider: "world-bbc-rss", url: "https://feeds.bbci.co.uk/news/world/rss.xml", hosts: ["bbc.com", "bbc.co.uk"] },
  { name: "Al Jazeera", provider: "world-aljazeera-rss", url: "https://www.aljazeera.com/xml/rss/all.xml", hosts: ["aljazeera.com"] },
  { name: "DW News", provider: "world-dw-rss", url: "https://rss.dw.com/xml/rss-en-all", hosts: ["dw.com"] },
  { name: "BBC Africa", provider: "kenya-bbc-africa-rss", url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", hosts: ["bbc.com", "bbc.co.uk"] },
  { name: "Kenya Top News", provider: "kenya-google-news-rss", url: "https://news.google.com/rss?hl=en-KE&gl=KE&ceid=KE:en", hosts: ["news.google.com"] },
  { name: "BBC Politics", provider: "politics-bbc-rss", url: "https://feeds.bbci.co.uk/news/politics/rss.xml", hosts: ["bbc.com", "bbc.co.uk"] },
  { name: "BBC Business", provider: "business-bbc-rss", url: "https://feeds.bbci.co.uk/news/business/rss.xml", hosts: ["bbc.com", "bbc.co.uk"] },
  { name: "BBC Entertainment", provider: "entertainment-bbc-rss", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", hosts: ["bbc.com", "bbc.co.uk"] },
  { name: "BBC Science", provider: "science-bbc-rss", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", hosts: ["bbc.com", "bbc.co.uk"] },
  { name: "BBC Health", provider: "health-bbc-rss", url: "https://feeds.bbci.co.uk/news/health/rss.xml", hosts: ["bbc.com", "bbc.co.uk"] },
  { name: "Kenya Politics", provider: "kenya-politics-google-news-rss", url: "https://news.google.com/rss/search?q=Kenya+politics&hl=en-KE&gl=KE&ceid=KE:en", hosts: ["news.google.com"] },
  { name: "Kenya Sports", provider: "kenya-sports-google-news-rss", url: "https://news.google.com/rss/search?q=Kenya+sports&hl=en-KE&gl=KE&ceid=KE:en", hosts: ["news.google.com"] },
  { name: "Kenya Business", provider: "kenya-business-google-news-rss", url: "https://news.google.com/rss/search?q=Kenya+business+economy&hl=en-KE&gl=KE&ceid=KE:en", hosts: ["news.google.com"] },
  { name: "Kenya Entertainment", provider: "kenya-entertainment-google-news-rss", url: "https://news.google.com/rss/search?q=Kenya+entertainment&hl=en-KE&gl=KE&ceid=KE:en", hosts: ["news.google.com"] },
  { name: "Trending Kenya", provider: "trending-google-news-rss", url: "https://news.google.com/rss/search?q=trending+OR+viral+OR+popular&hl=en-KE&gl=KE&ceid=KE:en", hosts: ["news.google.com"] },
];
const OFFICIAL_HIGHLIGHT_FEEDS = [
  { name: "Premier League", code: "PL", channelId: "UCG5qGWdu8nIRZqJ_GgDwQ-w" },
  { name: "UEFA", code: "CL", channelId: "UCyGa1YEx9ST66rYrJTGIKOw" },
];
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}
function textTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp("<" + tag + "\\b[^>]*>([\\s\\S]*?)</" + tag + "\\s*>", "i"));
  return match ? decodeXml(match[1]).trim() : "";
}
function cleanText(value: string, maxLength: number): string {
  return decodeXml(value).replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function safeHttpsUrl(value: string, allowedHosts: string[]): string | null {
  try {
    const url = new URL(value);
    const allowed = allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith("." + host));
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !allowed) return null;
    url.protocol = "https:";
    return url.toString();
  } catch { return null; }
}
function imageUrlFromItem(item: string, allowedHosts: string[]): string | null {
  const imageHosts = [...allowedHosts, "bbci.co.uk", "googleusercontent.com", "gstatic.com"];
  const candidates: string[] = [];
  const mediaTags = [...item.matchAll(/<(?:media:thumbnail|media:content|enclosure)\b([^>]*)\/?>(?:<\/(?:media:thumbnail|media:content|enclosure)>)?/gi)];
  for (const tag of mediaTags) {
    const attribute = tag[1].match(/\b(?:url|href)\s*=\s*["']([^"']+)["']/i);
    if (attribute) candidates.push(decodeXml(attribute[1]));
  }
  const htmlImages = [...item.matchAll(/<img\b([^>]*)>/gi)];
  for (const tag of htmlImages) {
    const attribute = tag[1].match(/\b(?:src|data-src)\s*=\s*["']([^"']+)["']/i);
    if (attribute) candidates.push(decodeXml(attribute[1]));
  }
  for (const candidate of candidates) {
    const safe = safeHttpsUrl(candidate, imageHosts);
    if (safe) return safe;
  }
  return null;
}
function videoUrlFromItem(item: string, allowedHosts: string[]): string | null {
  const youtubeId = textTag(item, "yt:videoId");
  if (/^[A-Za-z0-9_-]{6,20}$/.test(youtubeId)) {
    return "https://www.youtube.com/watch?v=" + youtubeId;
  }
  const mediaTags = [...item.matchAll(/<(?:media:content|enclosure)\\b([^>]*)\\/?>(?:<\\/(?:media:content|enclosure)>)?/gi)];
  for (const tag of mediaTags) {
    const attrs = tag[1];
    const type = (attrs.match(/\\btype\\s*=\\s*["']([^"']+)["']/i)?.[1] ?? "").toLowerCase();
    const candidate = attrs.match(/\\b(?:url|href)\\s*=\\s*["']([^"']+)["']/i)?.[1];
    if (!candidate) continue;
    const decoded = decodeXml(candidate);
    if (/youtube\\.com\\/(?:watch|embed)|youtu\\.be\\//i.test(decoded)) {
      try {
        const url = new URL(decoded);
        if (url.hostname === "youtu.be" || url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
          return url.toString();
        }
      } catch { /* Ignore malformed publisher video links. */ }
    }
    if (type.startsWith("video/") || /\\.(?:mp4|webm)(?:$|[?#])/i.test(decoded)) {
      const safe = safeHttpsUrl(decoded, allowedHosts);
      if (safe) return safe;
    }
  }
  return null;
}
function safePublishedAt(value: string): string | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
async function fetchFeed(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      "user-agent": "NexoraArena/1.0 (+https://nexora.app)",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("Feed returned HTTP " + response.status);
  return await response.text();
}
function parseNewsFeed(xml: string, source: typeof NEWS_FEEDS[number]): NewsItem[] {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  const output: NewsItem[] = [];
  for (const item of items) {
    const rawTitle = cleanText(textTag(item, "title"), 320);
    const googlePublisher = cleanText(textTag(item, "source"), 100);
    const fallbackPublisher = source.provider.includes("google-news-rss") && rawTitle.includes(" - ")
      ? rawTitle.split(" - ").at(-1) ?? ""
      : "";
    const publisher = googlePublisher || fallbackPublisher || source.name;
    const hasPublisherSuffix = source.provider.includes("google-news-rss") && rawTitle.includes(" - ");
    const headline = cleanText(
      hasPublisherSuffix ? rawTitle.slice(0, Math.max(0, rawTitle.lastIndexOf(" - "))) : rawTitle,
      220,
    );
    const link = safeHttpsUrl(textTag(item, "link"), source.hosts);
    const publishedAt = safePublishedAt(textTag(item, "pubDate") || textTag(item, "dc:date"));
    if (!headline || !link || !publishedAt) continue;
    output.push({
      provider: source.provider,
      provider_id: link,
      source_name: publisher,
      headline,
      summary: cleanText(textTag(item, "description"), 500),
      thumbnail_url: imageUrlFromItem(item, source.hosts),
      video_url: videoUrlFromItem(item, source.hosts),
      thumbnail_checked_at: null,
      source_url: link,
      published_at: publishedAt,
      is_published: true,
    });
  }
  return output.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)).slice(0, 20);
}
function parseOfficialHighlights(xml: string, source: typeof OFFICIAL_HIGHLIGHT_FEEDS[number]): HighlightItem[] {
  const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((match) => match[1]);
  const output: HighlightItem[] = [];
  const highlightTitle = /(highlight|highlights|every .* goal|goals from|all goals|matchweek.*goal|extended|best goals)/i;
  for (const entry of entries) {
    const videoId = textTag(entry, "yt:videoId");
    const headline = cleanText(textTag(entry, "title"), 220);
    const publishedAt = safePublishedAt(textTag(entry, "published"));
    if (!videoId || !headline || !publishedAt || !highlightTitle.test(headline)) continue;
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) continue;
    output.push({
      provider: "youtube-official",
      provider_id: videoId,
      competition_code: source.code,
      match_label: headline,
      score_label: null,
      duration_seconds: null,
      thumbnail_url: "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg",
      video_url: "https://www.youtube.com/watch?v=" + videoId,
      source_name: source.name + " (Official YouTube)",
      published_at: publishedAt,
      is_published: true,
    });
  }
  return output.slice(0, 12);
}
async function restRequest(path: string, serviceKey: string, init: RequestInit = {}) {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!baseUrl) throw new Error("SUPABASE_URL is missing");
  const response = await fetch(baseUrl + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: serviceKey,
      authorization: "Bearer " + serviceKey,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error("Supabase content cache returned HTTP " + response.status + ": " + detail);
  }
  return response;
}
async function loadThumbnailCache(provider: string, serviceKey: string) {
  const query = "football_announcements?select=provider_id,thumbnail_url,thumbnail_checked_at" +
    "&provider=eq." + encodeURIComponent(provider) + "&limit=500";
  const response = await restRequest(query, serviceKey);
  const rows = await response.json() as Array<{
    provider_id: string;
    thumbnail_url: string | null;
    thumbnail_checked_at: string | null;
  }>;
  return new Map(rows.map((row) => [row.provider_id, row]));
}
async function upsertRows<T extends { provider: string; provider_id: string }>(
  table: string,
  rows: T[],
  serviceKey: string,
) {
  if (!rows.length) return;
  // A single RSS response can repeat the same item. Postgres rejects an
  // ON CONFLICT batch that tries to update the same unique row twice.
  const uniqueRows = new Map<string, T>();
  for (const row of rows) uniqueRows.set(row.provider + "\\0" + row.provider_id, row);
  await restRequest(table + "?on_conflict=provider,provider_id", serviceKey, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([...uniqueRows.values()]),
  });
}
type CachedSportMatch = {
  provider: string;
  provider_id: string;
  competition_code: string;
  competition_name: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: "SCHEDULED" | "LIVE" | "HT" | "FT" | "POSTPONED" | "CANCELLED" | "ABANDONED";
  elapsed_minute: number | null;
  kickoff_at: string;
  updated_at: string;
  source_url: string | null;
};
async function fetchJson(url: string, userAgent = "NexoraArena/1.0"): Promise<any> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": userAgent },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Sports provider returned HTTP " + response.status);
  return await response.json();
}
function parseEspnMatches(payload: any, provider: string): CachedSportMatch[] {
  const output: CachedSportMatch[] = [];
  for (const event of Array.isArray(payload?.events) ? payload.events : []) {
    const competition = event?.competitions?.[0];
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
    const home = competitors.find((team: any) => team.homeAway === "home") ?? competitors[0];
    const away = competitors.find((team: any) => team.homeAway === "away") ?? competitors[1];
    const kickoff = safePublishedAt(event?.date ?? "");
    if (!event?.id || !home?.team?.displayName || !away?.team?.displayName || !kickoff) continue;
    const type = competition?.status?.type ?? event?.status?.type ?? {};
    const state = String(type.state ?? "").toLowerCase();
    const detail = String(type.detail ?? "").toLowerCase();
    const status: CachedSportMatch["status"] = /postponed/.test(detail) ? "POSTPONED"
      : /cancel/.test(detail) ? "CANCELLED"
      : state === "in" && /half|halftime|intermission/.test(detail) ? "HT"
      : state === "in" ? "LIVE"
      : state === "post" ? "FT" : "SCHEDULED";
    const score = (team: any) => {
      const value = Number.parseInt(String(team?.score ?? ""), 10);
      return Number.isFinite(value) ? value : null;
    };
    output.push({
      provider,
      provider_id: String(event.id),
      competition_code: provider.replace("espn-", "").toUpperCase(),
      competition_name: String(payload?.leagues?.[0]?.name ?? provider.replace("espn-", "").toUpperCase()),
      home_team: String(home.team.displayName),
      away_team: String(away.team.displayName),
      home_score: score(home),
      away_score: score(away),
      status,
      elapsed_minute: Number.isFinite(Number(competition?.status?.period)) ? Number(competition.status.period) : null,
      kickoff_at: kickoff,
      updated_at: new Date().toISOString(),
      source_url: Array.isArray(event.links) ? (event.links.find((link: any) => link?.rel?.includes("summary"))?.href ?? null) : null,
    });
  }
  return output;
}

function parseEspnCricketMatches(payload: any, leagueName: string): CachedSportMatch[] {
  const rows: CachedSportMatch[] = [];
  for (const event of Array.isArray(payload?.events) ? payload.events : []) {
    const competition = event?.competitions?.[0] ?? {};
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
    const home = competitors.find((team: any) => team?.homeAway === "home") ?? competitors[0];
    const away = competitors.find((team: any) => team?.homeAway === "away") ?? competitors[1];
    const homeName = String(home?.team?.displayName ?? home?.team?.name ?? "");
    const awayName = String(away?.team?.displayName ?? away?.team?.name ?? "");
    const kickoff = safePublishedAt(String(event?.date ?? ""));
    if (!event?.id || !homeName || !awayName || !kickoff) continue;
    const scoreLabel = (team: any) => {
      const score = String(team?.score ?? "").trim();
      const linescores = Array.isArray(team?.linescores) ? team.linescores : [];
      const overs = linescores.map((line: any) => line?.displayValue ?? line?.value).filter(Boolean).join(" ");
      return [score, overs && !score.includes(overs) ? overs : ""].filter(Boolean).join(" · ");
    };
    const homeScore = scoreLabel(home);
    const awayScore = scoreLabel(away);
    const type = competition?.status?.type ?? event?.status?.type ?? {};
    const state = String(type?.state ?? "").toLowerCase();
    const detail = String(type?.detail ?? type?.description ?? "").toLowerCase();
    const status: CachedSportMatch["status"] = /abandon/.test(detail) ? "ABANDONED"
      : /postpon/.test(detail) ? "POSTPONED"
      : /cancel/.test(detail) ? "CANCELLED"
      : state === "in" && /break|interval|innings/.test(detail) ? "HT"
      : state === "in" ? "LIVE"
      : state === "post" ? "FT" : "SCHEDULED";
    rows.push({
      provider: "espn-cricket",
      provider_id: String(event.id),
      competition_code: "CRICKET",
      competition_name: String(event?.name ?? event?.shortName ?? leagueName ?? "Cricket"),
      home_team: homeName + (homeScore ? " · " + homeScore : ""),
      away_team: awayName + (awayScore ? " · " + awayScore : ""),
      home_score: null,
      away_score: null,
      status,
      elapsed_minute: null,
      kickoff_at: kickoff,
      updated_at: new Date().toISOString(),
      source_url: Array.isArray(event?.links)
        ? (event.links.find((link: any) => Array.isArray(link?.rel) && link.rel.includes("summary"))?.href ?? "https://www.espn.com/cricket/")
        : "https://www.espn.com/cricket/",
    });
  }
  return rows;
}

function tennisScoreLabel(score: any, side: number): string {
  const games = Array.isArray(score?.games?.[side]) ? score.games[side] : [];
  const gameText = games.length ? games.join("-") : "";
  const points = Array.isArray(score?.points) ? score.points[side] : null;
  return [gameText ? "Games " + gameText : "", points != null ? "Points " + String(points) : ""].filter(Boolean).join(" · ");
}
function parseLiveTennisMatches(payload: any): CachedSportMatch[] {
  const rows: CachedSportMatch[] = [];
  const items = Array.isArray(payload?.data) ? payload.data : [];
  for (const match of items) {
    const p1 = match?.players?.p1 ?? {};
    const p2 = match?.players?.p2 ?? {};
    const name1 = String(p1?.name ?? "").trim();
    const name2 = String(p2?.name ?? "").trim();
    const kickoff = safePublishedAt(String(match?.start_time ?? match?.scheduled_at ?? match?.event_date ?? ""));
    if (!match?.id || !name1 || !name2 || !kickoff) continue;
    const score = match?.score ?? match ?? {};
    const sets = Array.isArray(score?.sets) ? score.sets : [];
    const statusText = String(match?.status ?? match?.event_status ?? "live").toLowerCase();
    const status: CachedSportMatch["status"] = /postpon/.test(statusText) ? "POSTPONED"
      : /cancel|abandon/.test(statusText) ? "CANCELLED"
      : /complete|finished|retired|walkover|default/.test(statusText) ? "FT"
      : /pause|break|suspend/.test(statusText) ? "HT" : "LIVE";
    const tournament = String(match?.tournament ?? match?.competition ?? "Tennis");
    const side1 = tennisScoreLabel(score, 0);
    const side2 = tennisScoreLabel(score, 1);
    rows.push({
      provider: "livetennisapi",
      provider_id: String(match.id),
      competition_code: "TENNIS",
      competition_name: tournament + (match?.round ? " · " + String(match.round) : ""),
      home_team: name1 + (side1 ? " · " + side1 : ""),
      away_team: name2 + (side2 ? " · " + side2 : ""),
      home_score: sets[0] != null && Number.isFinite(Number(sets[0])) ? Number(sets[0]) : null,
      away_score: sets[1] != null && Number.isFinite(Number(sets[1])) ? Number(sets[1]) : null,
      status,
      elapsed_minute: null,
      kickoff_at: kickoff,
      updated_at: new Date().toISOString(),
      source_url: "https://livetennisapi.com/",
    });
  }
  return rows;
}
async function syncTennis(serviceKey: string): Promise<{ rows: CachedSportMatch[]; sources: Record<string, unknown> }> {
  const sources: Record<string, unknown> = {};
  const apiKey = Deno.env.get("LIVETENNISAPI_KEY");
  if (!apiKey) {
    sources.Tennis = { ok: false, configured: false, error: "LIVETENNISAPI_KEY is not configured in Supabase Edge Function secrets." };
    return { rows: [], sources };
  }
  // A hidden cache marker records successful empty-board reads too, preventing
  // the 15-minute cron from exhausting the provider's 100-request daily free quota.
  if (await providerCacheIsFresh("livetennisapi-cache", 30 * 60 * 1000, serviceKey)) {
    return { rows: [], sources: { Tennis: { ok: true, cached: true, refreshMinutes: 30 } } };
  }
  try {
    const payload = await fetchProviderJson(
      "https://api.livetennisapi.com/api/public/v1/matches?status=live&limit=100",
      apiKey,
    );
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const rows = parseLiveTennisMatches(payload).filter((row) => Date.parse(row.kickoff_at) >= cutoff);
    await upsertRows("football_matches", rows, serviceKey);
    await restRequest("football_matches?on_conflict=provider,provider_id", serviceKey, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{
        provider: "livetennisapi-cache",
        provider_id: "last-successful-live-board",
        competition_code: "TENNIS_CACHE",
        competition_name: "Tennis sync cache marker",
        home_team: "N/A",
        away_team: "N/A",
        home_score: null,
        away_score: null,
        status: "CANCELLED",
        elapsed_minute: null,
        kickoff_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source_url: null,
        is_published: false,
      }]),
    });
    sources.Tennis = { ok: true, events: rows.length, cached: false, refreshMinutes: 30, source: "Live Tennis API" };
    return { rows, sources };
  } catch (error) {
    sources.Tennis = { ok: false, error: error instanceof Error ? error.message : "Tennis feed unavailable" };
    return { rows: [], sources };
  }
}

async function syncCricket(serviceKey: string): Promise<{ rows: CachedSportMatch[]; sources: Record<string, unknown> }> {
  const sources: Record<string, unknown> = {};
  if (await providerCacheIsFresh("espn-cricket", 10 * 60 * 1000, serviceKey)) {
    return { rows: [], sources: { Cricket: { ok: true, cached: true, refreshMinutes: 10 } } };
  }
  const rows: CachedSportMatch[] = [];
  try {
    const header = await fetchJson(
      "https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&tz=Asia/Calcutta",
    );
    const leagues = Array.isArray(header?.sports?.[0]?.leagues) ? header.sports[0].leagues : [];
    const activeLeagues = leagues
      .filter((league: any) => league?.id && (Array.isArray(league?.events) ? league.events.length > 0 : true))
      .slice(0, 8);
    const results = await Promise.allSettled(activeLeagues.map(async (league: any) => {
      const payload = await fetchJson(
        "https://site.api.espn.com/apis/site/v2/sports/cricket/" + encodeURIComponent(String(league.id)) + "/scoreboard?limit=100",
      );
      return parseEspnCricketMatches(payload, String(league.name ?? "Cricket"));
    }));
    for (const result of results) {
      if (result.status === "fulfilled") rows.push(...result.value);
      else console.warn("Cricket series scoreboard unavailable", result.reason);
    }
    // The header can still contain useful match events if an individual series scoreboard is unavailable.
    if (!rows.length) {
      for (const league of activeLeagues) rows.push(...parseEspnCricketMatches({ events: league.events }, String(league.name ?? "Cricket")));
    }
    const unique = new Map(rows.map((row) => [row.provider_id, row]));
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const fresh = [...unique.values()].filter((row) => {
      const time = Date.parse(row.kickoff_at);
      return time >= cutoff && time <= Date.now() + 14 * 24 * 60 * 60 * 1000;
    });
    await upsertRows("football_matches", fresh, serviceKey);
    sources.Cricket = { ok: true, events: fresh.length, seriesChecked: activeLeagues.length, cached: false, refreshMinutes: 10 };
    return { rows: fresh, sources };
  } catch (error) {
    sources.Cricket = { ok: false, error: error instanceof Error ? error.message : "Cricket feed unavailable" };
    return { rows, sources };
  }
}

async function syncMultiSportScores(serviceKey: string): Promise<{ rows: CachedSportMatch[]; sources: Record<string, unknown> }> {
  const leagues = [
    { label: "NBA", provider: "espn-nba", path: "basketball/nba" },
    { label: "NFL", provider: "espn-nfl", path: "football/nfl" },
    { label: "MLB", provider: "espn-mlb", path: "baseball/mlb" },
    { label: "NHL", provider: "espn-nhl", path: "hockey/nhl" },
  ];
  const sources: Record<string, unknown> = {};
  const results = await Promise.allSettled(leagues.map(async (league) => {
    const payload = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/" + league.path + "/scoreboard");
    return { league, rows: parseEspnMatches(payload, league.provider) };
  }));
  const rows: CachedSportMatch[] = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const league = leagues[index];
    if (result.status === "fulfilled") {
      rows.push(...result.value.rows);
      sources[league.label] = { ok: true, events: result.value.rows.length };
    } else {
      sources[league.label] = { ok: false, error: result.reason instanceof Error ? result.reason.message : "Scoreboard unavailable" };
    }
  }
  try {
    const season = new Date().getUTCFullYear();
    const payload = await fetchJson("https://api.jolpi.ca/ergast/f1/" + season + ".json", "NexoraArena/1.0");
    const races = payload?.MRData?.RaceTable?.Races ?? [];
    for (const race of races) {
      const kickoff = safePublishedAt(String(race.date ?? "") + "T" + String(race.time ?? "12:00:00Z"));
      if (!kickoff || !race.raceName || !race.Circuit?.circuitName) continue;
      rows.push({
        provider: "jolpica-f1",
        provider_id: String(season) + "-" + String(race.round),
        competition_code: "F1",
        competition_name: "Formula 1",
        home_team: String(race.raceName),
        away_team: String(race.Circuit.circuitName),
        home_score: null,
        away_score: null,
        status: Date.parse(kickoff) < Date.now() ? "FT" : "SCHEDULED",
        elapsed_minute: null,
        kickoff_at: kickoff,
        updated_at: new Date().toISOString(),
        source_url: "https://api.jolpi.ca/ergast/f1/" + season + "/" + String(race.round) + "/results.json",
      });
    }
    sources["Formula 1"] = { ok: true, races: races.length };
  } catch (error) {
    sources["Formula 1"] = { ok: false, error: error instanceof Error ? error.message : "F1 calendar unavailable" };
  }
  if (rows.length) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const freshRows = rows.filter((row) => Date.parse(row.kickoff_at) >= Date.parse(cutoff));
    await upsertRows("football_matches", freshRows, serviceKey);
  }
  return { rows, sources };
}


async function fetchProviderJson(url: string, apiKey: string): Promise<any> {
  const response = await fetch(url, {
    headers: { accept: "application/json", authorization: "Bearer " + apiKey, "user-agent": "NexoraArena/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    throw new Error("Sports provider returned HTTP " + response.status + (detail ? ": " + detail : ""));
  }
  return await response.json();
}
async function providerCacheIsFresh(provider: string, staleMs: number, serviceKey: string): Promise<boolean> {
  const response = await restRequest(
    "football_matches?select=updated_at&provider=eq." + encodeURIComponent(provider) + "&order=updated_at.desc&limit=1",
    serviceKey,
  );
  const rows = await response.json() as Array<{ updated_at: string }>;
  return !!rows[0]?.updated_at && Date.now() - Date.parse(rows[0].updated_at) < staleMs;
}
function parseRugbyRows(payload: any): CachedSportMatch[] {
  const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.matches) ? payload.matches : [];
  const rows: CachedSportMatch[] = [];
  for (const item of items) {
    const home = item?.home;
    const away = item?.away;
    const kickoff = safePublishedAt(String(item?.kickoff_utc ?? item?.kickoff_at ?? item?.date ?? ""));
    if (!item?.id || !home?.name || !away?.name || !kickoff) continue;
    const raw = String(item?.status ?? "").toLowerCase();
    const status: CachedSportMatch["status"] = /live|in.play|in_progress/.test(raw) ? "LIVE"
      : /half/.test(raw) ? "HT"
      : /finish|complete|full.time/.test(raw) ? "FT"
      : /postpon/.test(raw) ? "POSTPONED"
      : /cancel/.test(raw) ? "CANCELLED" : "SCHEDULED";
    const score = (value: any) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
    rows.push({
      provider: "rugbyapi",
      provider_id: String(item.id),
      competition_code: "RUGBY",
      competition_name: String(item?.competition?.name ?? "Rugby"),
      home_team: String(home.name),
      away_team: String(away.name),
      home_score: score(home.score),
      away_score: score(away.score),
      status,
      elapsed_minute: Number.isFinite(Number(item?.minute)) ? Number(item.minute) : null,
      kickoff_at: kickoff,
      updated_at: new Date().toISOString(),
      source_url: typeof item?.url === "string" && item.url.startsWith("https://") ? item.url : "https://rugbyapi.com/",
    });
  }
  return rows;
}
function parseMmaEvents(payload: any): CachedSportMatch[] {
  const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.events) ? payload.events : [];
  const rows: CachedSportMatch[] = [];
  for (const item of items) {
    const kickoff = safePublishedAt(String(item?.starts_at ?? item?.start_at ?? item?.date ?? ""));
    const id = item?.id ?? item?.slug;
    const title = String(item?.title ?? item?.name ?? item?.short_title ?? "");
    if (!id || !title || !kickoff) continue;
    const raw = String(item?.status ?? "").toLowerCase();
    const status: CachedSportMatch["status"] = /live|in.progress/.test(raw) ? "LIVE"
      : /complete|finished|over/.test(raw) ? "FT"
      : /postpon/.test(raw) ? "POSTPONED"
      : /cancel/.test(raw) ? "CANCELLED" : "SCHEDULED";
    const venue = item?.venue;
    const venueLabel = [venue?.name, venue?.city, venue?.country].filter(Boolean).join(" · ");
    rows.push({
      provider: "ufcalendar-mma",
      provider_id: String(id),
      competition_code: "MMA",
      competition_name: String(item?.org?.toUpperCase?.() ?? item?.organization?.name ?? "MMA / UFC"),
      home_team: title,
      away_team: venueLabel || "Fight card",
      home_score: null,
      away_score: null,
      status,
      elapsed_minute: null,
      kickoff_at: kickoff,
      updated_at: new Date().toISOString(),
      source_url: "https://www.ufcalendar.com/",
    });
  }
  return rows;
}
async function syncRugbyAndMma(serviceKey: string): Promise<{ rows: CachedSportMatch[]; sources: Record<string, unknown> }> {
  const rows: CachedSportMatch[] = [];
  const sources: Record<string, unknown> = {};
  const rugbyKey = Deno.env.get("RUGBYAPI_KEY");
  if (!rugbyKey) {
    sources.Rugby = { ok: false, error: "RUGBYAPI_KEY is not configured in Supabase Edge Function secrets." };
  } else {
    try {
      if (await providerCacheIsFresh("rugbyapi", 60 * 60 * 1000, serviceKey)) {
        sources.Rugby = { ok: true, cached: true };
      } else {
        const [fixtures, results] = await Promise.all([
          fetchProviderJson("https://api.rugbyapi.com/v1/fixtures", rugbyKey),
          fetchProviderJson("https://api.rugbyapi.com/v1/results", rugbyKey),
        ]);
        const combined = [...parseRugbyRows(fixtures), ...parseRugbyRows(results)];
        const unique = new Map(combined.map((row) => [row.provider_id, row]));
        const fresh = [...unique.values()].filter((row) => {
          const time = Date.parse(row.kickoff_at);
          return time >= Date.now() - 30 * 24 * 60 * 60 * 1000 && time <= Date.now() + 14 * 24 * 60 * 60 * 1000;
        });
        rows.push(...fresh);
        sources.Rugby = { ok: true, events: fresh.length, cached: false, refreshMinutes: 60, planNote: "Free tier fixtures and results; live match-day push requires RugbyAPI Live." };
      }
    } catch (error) {
      sources.Rugby = { ok: false, error: error instanceof Error ? error.message : "Rugby feed unavailable" };
    }
  }
  const mmaKey = Deno.env.get("UFCAL_API_KEY");
  if (!mmaKey) {
    sources["MMA / UFC"] = { ok: false, error: "UFCAL_API_KEY is not configured in Supabase Edge Function secrets." };
  } else {
    try {
      if (await providerCacheIsFresh("ufcalendar-mma", 8 * 60 * 60 * 1000, serviceKey)) {
        sources["MMA / UFC"] = { ok: true, cached: true };
      } else {
        const payload = await fetchProviderJson("https://api.ufcalendar.com/v1/events?org=ufc&status=upcoming&limit=25", mmaKey);
        const fresh = parseMmaEvents(payload).filter((row) => Date.parse(row.kickoff_at) <= Date.now() + 365 * 24 * 60 * 60 * 1000);
        rows.push(...fresh);
        sources["MMA / UFC"] = { ok: true, events: fresh.length, cached: false, refreshHours: 8 };
      }
    } catch (error) {
      sources["MMA / UFC"] = { ok: false, error: error instanceof Error ? error.message : "MMA feed unavailable" };
    }
  }
  if (rows.length) await upsertRows("football_matches", rows, serviceKey);
  return { rows, sources };
}

async function isAuthorized(candidate: string, serviceKey: string): Promise<boolean> {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!baseUrl) throw new Error("SUPABASE_URL is missing");
  const response = await fetch(baseUrl + "/rest/v1/rpc/is_arena_content_sync_authorized", {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: "Bearer " + serviceKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ candidate }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Arena content sync authorization check failed");
  return await response.json() === true;
}
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Arena content sync is not configured." }, 503);
  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!candidate || !(await isAuthorized(candidate, serviceKey))) return json({ error: "Unauthorized" }, 401);

  const sourceResults: Record<string, unknown> = {};
  let newsRows: NewsItem[] = [];
  try {
    const sportScores = await syncMultiSportScores(serviceKey);
    Object.assign(sourceResults, sportScores.sources);
  } catch (error) {
    sourceResults["Multi-sport scoreboards"] = { ok: false, error: error instanceof Error ? error.message : "Scoreboard sync failed" };
  }
  try {
    const extendedSports = await syncRugbyAndMma(serviceKey);
    Object.assign(sourceResults, extendedSports.sources);
  } catch (error) {
    sourceResults["Extended sports"] = { ok: false, error: error instanceof Error ? error.message : "Extended sports sync failed" };
  }
  try {
    const cricket = await syncCricket(serviceKey);
    Object.assign(sourceResults, cricket.sources);
  } catch (error) {
    sourceResults.Cricket = { ok: false, error: error instanceof Error ? error.message : "Cricket sync failed" };
  }
  try {
    const tennis = await syncTennis(serviceKey);
    Object.assign(sourceResults, tennis.sources);
  } catch (error) {
    sourceResults.Tennis = { ok: false, error: error instanceof Error ? error.message : "Tennis sync failed" };
  }
  let highlightRows: HighlightItem[] = [];
  const newsResults = await Promise.allSettled(NEWS_FEEDS.map(async (source) => {
    const xml = await fetchFeed(source.url);
    return { source, rows: parseNewsFeed(xml, source) };
  }));
  for (let index = 0; index < newsResults.length; index += 1) {
    const result = newsResults[index];
    const source = NEWS_FEEDS[index];
    if (result.status === "fulfilled") {
      newsRows.push(...result.value.rows);
      sourceResults[source.name] = { ok: true, items: result.value.rows.length };
    } else {
      sourceResults[source.name] = {
        ok: false,
        error: result.reason instanceof Error ? result.reason.message : "Feed unavailable",
      };
    }
  }
  // Reuse previously discovered images and negative-cache misses to avoid re-fetching article pages.
  const cacheResults = await Promise.allSettled(
    NEWS_FEEDS.map(async (source) => ({
      source,
      cache: await loadThumbnailCache(source.provider, serviceKey),
    })),
  );
  const thumbnailCaches = new Map<string, Map<string, {
    provider_id: string;
    thumbnail_url: string | null;
    thumbnail_checked_at: string | null;
  }>>();
  for (const result of cacheResults) {
    if (result.status === "fulfilled") {
      thumbnailCaches.set(result.value.source.provider, result.value.cache);
    } else {
      console.warn("Could not load cached news thumbnails", result.reason);
    }
  }

  for (const row of newsRows) {
    const cached = thumbnailCaches.get(row.provider)?.get(row.provider_id);
    if (!row.thumbnail_url && cached?.thumbnail_url) row.thumbnail_url = cached.thumbnail_url;
    row.thumbnail_checked_at = cached?.thumbnail_checked_at ?? null;
  }

  // Keep each scheduled run bounded: at most 12 article-page lookups, six at a time.
  // Google News URLs redirect to arbitrary publishers, so they are deliberately excluded.
  const recheckAfterMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const imageCandidates = newsRows
    .filter((row) => {
      if (row.thumbnail_url || row.provider === "kenya-google-news-rss") return false;
      const checkedAt = row.thumbnail_checked_at ? Date.parse(row.thumbnail_checked_at) : 0;
      return !checkedAt || now - checkedAt >= recheckAfterMs;
    })
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
    .slice(0, 12);

  let enrichedImages = 0;
  for (let index = 0; index < imageCandidates.length; index += 6) {
    const batch = imageCandidates.slice(index, index + 6);
    await Promise.all(batch.map(async (row) => {
      const source = NEWS_FEEDS.find((candidate) => candidate.provider === row.provider);
      if (!source) return;
      try {
        row.thumbnail_url = await fetchPublisherImage(row.source_url, source.hosts);
      } catch (error) {
        console.warn("Publisher image lookup failed", source.name, error);
        row.thumbnail_url = null;
      }
      row.thumbnail_checked_at = new Date().toISOString();
      if (row.thumbnail_url) enrichedImages += 1;
    }));
  }
  sourceResults["Article image enrichment"] = {
    checked: imageCandidates.length,
    found: enrichedImages,
    maxPerRun: 12,
    cacheDays: 7,
  };

  const highlightResults = await Promise.allSettled(OFFICIAL_HIGHLIGHT_FEEDS.map(async (source) => {
    const url = "https://www.youtube.com/feeds/videos.xml?channel_id=" + source.channelId;
    const xml = await fetchFeed(url);
    return { source, rows: parseOfficialHighlights(xml, source) };
  }));
  for (const result of highlightResults) {
    if (result.status === "fulfilled") {
      highlightRows.push(...result.value.rows);
      sourceResults[result.value.source.name + " Official YouTube"] = {
        ok: true, items: result.value.rows.length,
      };
    } else {
      sourceResults["Official YouTube"] = {
        ok: false,
        error: result.reason instanceof Error ? result.reason.message : "Feed unavailable",
      };
    }
  }
  try {
    await upsertRows("football_announcements", newsRows, serviceKey);
    await upsertRows("football_highlights", highlightRows, serviceKey);
    const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    if (newsResults.some((result) => result.status === "fulfilled")) {
      await restRequest(
        "football_announcements?provider=eq.sky-sports-rss&published_at=lt." + encodeURIComponent(cutoff),
        serviceKey, { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
    }
    for (const result of highlightResults) {
      if (result.status !== "fulfilled") continue;
      await restRequest(
        "football_highlights?provider=eq.youtube-official&competition_code=eq." +
          encodeURIComponent(result.value.source.code) + "&published_at=lt." + encodeURIComponent(cutoff),
        serviceKey, { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
    }
    const anyFeedSucceeded = Object.values(sourceResults).some(
      (value) => typeof value === "object" && value !== null && (value as { ok?: boolean }).ok === true,
    );
    if (!anyFeedSucceeded) return json({
      ok: false, error: "All news and official highlight feeds failed.", sources: sourceResults,
    }, 502);
    return json({
      ok: true, newsUpdated: newsRows.length, highlightsUpdated: highlightRows.length,
      sources: sourceResults, updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Arena news/highlights sync failed", error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "Arena content sync failed",
      sources: sourceResults,
    }, 500);
  }
});
