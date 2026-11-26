type TechNewsRow = {
  provider: string;
  provider_id: string;
  source_name: string;
  headline: string;
  summary: string;
  thumbnail_url: string | null;
  source_url: string;
  published_at: string;
  is_published: boolean;
};
type TechVideoRow = {
  provider: string;
  provider_id: string;
  competition_code: string;
  match_label: string;
  score_label: string | null;
  duration_seconds: number | null;
  thumbnail_url: string;
  video_url: string;
  source_name: string;
  published_at: string;
  is_published: boolean;
};

const TECH_RSS = [
  { name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", hosts: ["theverge.com"] },
  { name: "TechCrunch Startups", url: "https://techcrunch.com/category/startups/feed/", hosts: ["techcrunch.com"] },
  { name: "Ars Technica Tech Lab", url: "https://feeds.arstechnica.com/arstechnica/technology-lab", hosts: ["arstechnica.com"] },
  { name: "Cloudflare Engineering", url: "https://blog.cloudflare.com/rss/", hosts: ["blog.cloudflare.com", "cloudflare.com"] },
  { name: "OpenAI Engineering", url: "https://openai.com/news/engineering/rss.xml", hosts: ["openai.com"] },
  { name: "Product Hunt", url: "https://www.producthunt.com/feed", hosts: ["producthunt.com"] },
];
const YOUTUBE_CHANNELS = [
  { name: "Fireship", channelId: "UCsBjURrPoezykLs9EqgamOA" },
  { name: "Marques Brownlee", channelId: "UCBJycsmduvYEL83R_U4JriQ" },
  { name: "Two Minute Papers", channelId: "UCbfYPyITQ-7l4upoX8nvctg" },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
function decodeXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}
function cleanText(value: string, max = 500): string {
  return decodeXml(value).replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, max);
}
function tag(xml: string, name: string): string {
  const match = xml.match(new RegExp("<" + name + "\\b[^>]*>([\\s\\S]*?)</" + name + "\\s*>", "i"));
  return match ? decodeXml(match[1]).trim() : "";
}
function safeUrl(value: string, hosts: string[]): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!hosts.some((host) => url.hostname === host || url.hostname.endsWith("." + host))) return null;
    url.protocol = "https:";
    return url.toString();
  } catch { return null; }
}
function publishedAt(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}
async function fetchXml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      "user-agent": "NexoraTechSync/1.0 (+https://nexora.app)",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("Feed returned HTTP " + response.status);
  return await response.text();
}
function parseTechRss(xml: string, source: typeof TECH_RSS[number]): TechNewsRow[] {
  const blocks = [
    ...[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]),
    ...[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]),
  ];
  const rows: TechNewsRow[] = [];
  for (const block of blocks.slice(0, 15)) {
    const headline = cleanText(tag(block, "title"), 220);
    const rawLink = tag(block, "link") || block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] || "";
    const link = safeUrl(rawLink, source.hosts);
    const rawDate = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date");
    if (!headline || !link) continue;
    const summary = cleanText(tag(block, "description") || tag(block, "summary") || tag(block, "content:encoded") || tag(block, "content"), 600);
    const media = block.match(/<(?:media:thumbnail|media:content|enclosure)\\b[^>]*(?:url|href)=["']([^"']+)["']/i)?.[1] || "";
    const inlineImage = block.match(/<img\\b[^>]*(?:src|data-src)=["']([^"']+)["']/i)?.[1] || "";
    const imageHosts = [...source.hosts, "cloudfront.net", "imgix.net", "arstechnica.net", "arstechnicacdn.net", "vox-cdn.com", "ctfassets.net", "imagedelivery.net", "wp.com"];
    const thumbnail = [media, inlineImage]
      .map((candidate) => candidate ? safeUrl(candidate, imageHosts) : null)
      .find((candidate) => !!candidate) ?? null;
    rows.push({
      provider: "tech-rss",
      provider_id: link,
      source_name: source.name,
      headline,
      summary,
      thumbnail_url: thumbnail,
      source_url: link,
      published_at: publishedAt(rawDate),
      is_published: true,
    });
  }
  return rows;
}
function parseYouTube(xml: string, channel: typeof YOUTUBE_CHANNELS[number]): TechVideoRow[] {
  const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);
  const rows: TechVideoRow[] = [];
  for (const entry of entries.slice(0, 15)) {
    const videoId = tag(entry, "yt:videoId");
    const headline = cleanText(tag(entry, "title"), 220);
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId) || !headline) continue;
    rows.push({
      provider: "youtube-tech",
      provider_id: videoId,
      competition_code: "TECH",
      match_label: headline,
      score_label: null,
      duration_seconds: null,
      thumbnail_url: "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg",
      video_url: "https://www.youtube.com/watch?v=" + videoId,
      source_name: channel.name,
      published_at: publishedAt(tag(entry, "published")),
      is_published: true,
    });
  }
  return rows;
}
async function rest(path: string, serviceKey: string, init: RequestInit = {}): Promise<Response> {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) throw new Error("SUPABASE_URL is missing");
  const response = await fetch(base + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: serviceKey,
      authorization: "Bearer " + serviceKey,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("Supabase cache returned HTTP " + response.status + ": " + (await response.text()).slice(0, 300));
  return response;
}
async function upsert(table: string, rows: unknown[], serviceKey: string): Promise<void> {
  if (!rows.length) return;
  const response = await rest(table + "?on_conflict=provider,provider_id", serviceKey, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  await response.text();
}
async function authorized(candidate: string, serviceKey: string): Promise<boolean> {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) throw new Error("SUPABASE_URL is missing");
  const response = await fetch(base + "/rest/v1/rpc/is_arena_content_sync_authorized", {
    method: "POST",
    headers: { apikey: serviceKey, authorization: "Bearer " + serviceKey, "content-type": "application/json" },
    body: JSON.stringify({ candidate }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Content sync authorization check failed");
  return await response.json() === true;
}
async function cacheIsFresh(serviceKey: string): Promise<boolean> {
  const response = await rest(
    "football_announcements?select=published_at&provider=eq.tech-sync-cache&provider_id=eq.last-successful-sync&order=published_at.desc&limit=1",
    serviceKey,
  );
  const rows = await response.json() as Array<{ published_at: string }>;
  return !!rows[0]?.published_at && Date.now() - Date.parse(rows[0].published_at) < 30 * 60_000;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Technology sync is not configured." }, 503);
  const auth = request.headers.get("authorization") ?? "";
  const candidate = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!candidate || !(await authorized(candidate, serviceKey))) return json({ error: "Unauthorized" }, 401);

  if (await cacheIsFresh(serviceKey)) {
    return json({ ok: true, cached: true, refreshMinutes: 30 });
  }

  const newsResults = await Promise.allSettled(TECH_RSS.map(async (source) => ({
    source,
    rows: parseTechRss(await fetchXml(source.url), source),
  })));
  const videoResults = await Promise.allSettled(YOUTUBE_CHANNELS.map(async (channel) => ({
    channel,
    rows: parseYouTube(await fetchXml("https://www.youtube.com/feeds/videos.xml?channel_id=" + channel.channelId), channel),
  })));

  const newsRows: TechNewsRow[] = [];
  const videoRows: TechVideoRow[] = [];
  const sources: Record<string, unknown> = {};
  for (let index = 0; index < newsResults.length; index += 1) {
    const result = newsResults[index];
    if (result.status === "fulfilled") {
      newsRows.push(...result.value.rows);
      sources[result.value.source.name] = { ok: true, items: result.value.rows.length };
    } else {
      sources[TECH_RSS[index].name] = { ok: false, error: result.reason instanceof Error ? result.reason.message : "Feed unavailable" };
    }
  }
  for (let index = 0; index < videoResults.length; index += 1) {
    const result = videoResults[index];
    if (result.status === "fulfilled") {
      videoRows.push(...result.value.rows);
      sources[result.value.channel.name] = { ok: true, items: result.value.rows.length };
    } else {
      sources[YOUTUBE_CHANNELS[index].name] = { ok: false, error: result.reason instanceof Error ? result.reason.message : "Channel feed unavailable" };
    }
  }
  const successfulFeeds = [...newsResults, ...videoResults].filter((result) => result.status === "fulfilled").length;
  if (!successfulFeeds) return json({ ok: false, error: "All technology feeds failed.", sources }, 502);

  await upsert("football_announcements", newsRows, serviceKey);
  await upsert("football_highlights", videoRows, serviceKey);
  const now = new Date().toISOString();
  await upsert("football_announcements", [{
    provider: "tech-sync-cache",
    provider_id: "last-successful-sync",
    source_name: "NEXORA Technology Sync",
    headline: "Technology feed sync marker",
    summary: "Internal cache marker",
    thumbnail_url: null,
    source_url: "https://nexora.app/",
    published_at: now,
    is_published: false,
  }], serviceKey);

  const cutoff = encodeURIComponent(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString());
  await rest("football_announcements?provider=eq.tech-rss&published_at=lt." + cutoff, serviceKey, {
    method: "DELETE", headers: { Prefer: "return=minimal" },
  });
  await rest("football_highlights?provider=eq.youtube-tech&published_at=lt." + cutoff, serviceKey, {
    method: "DELETE", headers: { Prefer: "return=minimal" },
  });
  return json({
    ok: true,
    technologyStoriesUpdated: newsRows.length,
    creatorVideosUpdated: videoRows.length,
    refreshMinutes: 30,
    sources,
    updatedAt: now,
  });
});
