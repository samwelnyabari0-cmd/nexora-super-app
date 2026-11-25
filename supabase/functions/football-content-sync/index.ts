import { fetchPublisherImage } from "../_shared/news-image-enrichment.ts";
type NewsItem = {
  provider: string;
  provider_id: string;
  source_name: string;
  headline: string;
  summary: string;
  thumbnail_url: string | null;
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
  { name: "BBC World", provider: "world-bbc-rss", url: "https://feeds.bbci.co.uk/news/world/rss.xml", hosts: ["bbc.com", "bbc.co.uk"] },
  { name: "Al Jazeera", provider: "world-aljazeera-rss", url: "https://www.aljazeera.com/xml/rss/all.xml", hosts: ["aljazeera.com"] },
  { name: "DW News", provider: "world-dw-rss", url: "https://rss.dw.com/xml/rss-en-all", hosts: ["dw.com"] },
  { name: "BBC Africa", provider: "kenya-bbc-africa-rss", url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", hosts: ["bbc.com", "bbc.co.uk"] },
  { name: "Kenya Top News", provider: "kenya-google-news-rss", url: "https://news.google.com/rss?hl=en-KE&gl=KE&ceid=KE:en", hosts: ["news.google.com"] },
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
    const fallbackPublisher = source.provider === "kenya-google-news-rss" && rawTitle.includes(" - ")
      ? rawTitle.split(" - ").at(-1) ?? ""
      : "";
    const publisher = googlePublisher || fallbackPublisher || source.name;
    const hasPublisherSuffix = source.provider === "kenya-google-news-rss" && rawTitle.includes(" - ");
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
async function upsertRows(table: string, rows: unknown[], serviceKey: string) {
  if (!rows.length) return;
  await restRequest(table + "?on_conflict=provider,provider_id", serviceKey, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
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
