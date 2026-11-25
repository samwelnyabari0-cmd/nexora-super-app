type NewsItem = {
  provider: string;
  provider_id: string;
  source_name: string;
  headline: string;
  summary: string;
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
const NEWS_FEEDS = [{
  name: "Sky Sports",
  provider: "sky-sports-rss",
  url: "https://www.skysports.com/rss/11095",
  host: "skysports.com",
}];
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
function safeHttpsUrl(value: string, allowedHost: string): string | null {
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || (url.hostname !== allowedHost && !url.hostname.endsWith("." + allowedHost))) return null;
    url.protocol = "https:";
    return url.toString();
  } catch { return null; }
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
    const headline = cleanText(textTag(item, "title"), 220);
    const link = safeHttpsUrl(textTag(item, "link"), source.host);
    const publishedAt = safePublishedAt(textTag(item, "pubDate"));
    if (!headline || !link || !publishedAt) continue;
    output.push({
      provider: source.provider,
      provider_id: link,
      source_name: source.name,
      headline,
      summary: "",
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
async function upsertRows(table: string, rows: unknown[], serviceKey: string) {
  if (!rows.length) return;
  await restRequest(table + "?on_conflict=provider,provider_id", serviceKey, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const syncSecret = Deno.env.get("ARENA_FOOTBALL_SYNC_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!syncSecret || !serviceKey) return json({ error: "Arena content sync is not configured." }, 503);
  if (request.headers.get("authorization") !== "Bearer " + syncSecret) return json({ error: "Unauthorized" }, 401);

  const sourceResults: Record<string, unknown> = {};
  let newsRows: NewsItem[] = [];
  let highlightRows: HighlightItem[] = [];
  const newsResults = await Promise.allSettled(NEWS_FEEDS.map(async (source) => {
    const xml = await fetchFeed(source.url);
    return { source, rows: parseNewsFeed(xml, source) };
  }));
  for (const result of newsResults) {
    if (result.status === "fulfilled") {
      newsRows.push(...result.value.rows);
      sourceResults[result.value.source.name] = { ok: true, items: result.value.rows.length };
    } else {
      sourceResults["Sky Sports"] = {
        ok: false,
        error: result.reason instanceof Error ? result.reason.message : "Feed unavailable",
      };
    }
  }
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
