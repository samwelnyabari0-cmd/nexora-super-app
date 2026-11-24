type ProviderStatus = "SCHEDULED" | "LIVE" | "HT" | "FT" | "POSTPONED" | "CANCELLED" | "ABANDONED";
type RecordValue = Record<string, unknown>;

type SportScoreMatchRow = {
  provider: "sportscore";
  provider_id: string;
  competition_code: string;
  competition_name: string;
  home_team: string;
  away_team: string;
  home_team_provider_id: string | null;
  away_team_provider_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: ProviderStatus;
  elapsed_minute: number | null;
  kickoff_at: string;
  source_url: null;
  is_published: true;
  updated_at: string;
};

const PROVIDER = "sportscore";
const BASE_URL = "https://sportscore.com";
const DISCOVERY_DAYS = 7;
const DISCOVERY_INTERVAL_MS = 6 * 60 * 60 * 1000;
const WINDOW_BEFORE_MS = 3 * 60 * 60 * 1000;
const WINDOW_AFTER_MS = 2 * 60 * 60 * 1000;

type SyncConnection = {
  club_id: string;
  created_by: string;
  team_name: string;
  team_provider_id: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : {};
}

function first(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const item = record(value);
  const nested = first(item.name, item.title, item.display_name, item.short_name);
  return typeof nested === "string" && nested.trim() ? nested.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function timestampValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value < 10_000_000_000 ? value * 1000 : value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function competitionCode(name: string): string {
  const normalized = name.toLocaleLowerCase();
  if (normalized.includes("fkf") || normalized.includes("kenyan premier league")) return "FKF";
  if (normalized.includes("premier league") && !normalized.includes("kenya")) return "EPL";
  if (normalized.includes("champions league")) return "UCL";
  if (normalized.includes("la liga") || normalized.includes("laliga")) return "LALIGA";
  return "OTHER";
}

function statusFromProvider(status: string, statusText: string): ProviderStatus {
  const value = (status + " " + statusText).trim().toLocaleLowerCase();
  if (/postpon/.test(value)) return "POSTPONED";
  if (/cancel/.test(value)) return "CANCELLED";
  if (/abandon|walkover/.test(value)) return "ABANDONED";
  if (/half.?time|\bht\b|break/.test(value)) return "HT";
  if (/finished|full.?time|\bft\b|after extra|penalt/.test(value)) return "FT";
  if (/live|in.?play|progress|ongoing|playing|first half|second half|extra time|\b1h\b|\b2h\b/.test(value)) return "LIVE";
  return "SCHEDULED";
}

function elapsedMinute(statusText: string, value: unknown): number | null {
  const direct = numberValue(value);
  if (direct !== null) return direct;
  const match = statusText.match(/(\d{1,3})\s*(?:\+\s*\d+)?\s*(?:['′m]|min)/i);
  return match ? Number(match[1]) : null;
}

function normalizeMatch(value: unknown, updatedAt: string): SportScoreMatchRow | null {
  const match = record(value);
  const home = record(first(match.home, match.home_team, match.homeTeam));
  const away = record(first(match.away, match.away_team, match.awayTeam));
  const homeTeam = textValue(first(home.name, home.title, match.home, match.home_team, match.homeTeam));
  const awayTeam = textValue(first(away.name, away.title, match.away, match.away_team, match.awayTeam));
  const competition = record(first(match.competition, match.league, match.tournament));
  const competitionName = textValue(first(
    match.competition_name, match.league_name, competition.name, competition.title,
    match.competition, match.league,
  )) ?? "Football";
  const kickoffAt = timestampValue(first(
    match.kickoff_at, match.kickoff, match.time, match.date, match.start_time, match.startTime,
  ));
  const providerId = textValue(first(match.slug, match.id, match.match_id, match.fixture_id, match.event_id));
  if (!providerId || !homeTeam || !awayTeam || !kickoffAt) return null;

  const score = record(match.score);
  const goals = record(match.goals);
  const statusRecord = record(match.status);
  const statusText = textValue(first(
    match.status_text, match.statusText, statusRecord.description, statusRecord.detail,
    match.elapsed, match.minute,
  )) ?? "";
  const statusValue = textValue(first(
    statusRecord.short, statusRecord.code, statusRecord.name,
    match.status_code, match.state, match.status,
  )) ?? "";
  return {
    provider: PROVIDER,
    provider_id: providerId,
    competition_code: competitionCode(competitionName),
    competition_name: competitionName,
    home_team: homeTeam,
    away_team: awayTeam,
    home_team_provider_id: textValue(first(home.id, match.home_team_id)),
    away_team_provider_id: textValue(first(away.id, match.away_team_id)),
    home_score: numberValue(first(match.home_score, match.homeScore, score.home, goals.home)),
    away_score: numberValue(first(match.away_score, match.awayScore, score.away, goals.away)),
    status: statusFromProvider(statusValue, statusText),
    elapsed_minute: elapsedMinute(statusText, first(match.elapsed_minute, match.elapsedMinute, match.minute)),
    kickoff_at: kickoffAt,
    source_url: null,
    is_published: true,
    updated_at: updatedAt,
  };
}

function fixtureList(payload: unknown): unknown[] {
  const item = record(payload);
  const list = first(item.matches, item.fixtures, item.data, item.results);
  if (Array.isArray(list)) return list;
  if (Array.isArray(payload)) return payload;
  throw new Error("SportScore returned an unrecognised fixture response");
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
  });
  if (!response.ok) throw new Error("Supabase cache request failed (" + response.status + ")");
  return response;
}

async function fetchFixtures(date: string): Promise<unknown[]> {
  const url = new URL("/api/v1/fixtures/", BASE_URL);
  url.searchParams.set("sport", "football");
  url.searchParams.set("date", date);
  url.searchParams.set("limit", "200");
  url.searchParams.set("src", "nexora");
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("SportScore returned HTTP " + response.status);
  return fixtureList(await response.json());
}

async function upsertMatches(matches: unknown[], serviceKey: string, updatedAt: string) {
  const rows = matches
    .map((match) => normalizeMatch(match, updatedAt))
    .filter((match): match is SportScoreMatchRow => match !== null);
  if (rows.length) {
    await restRequest("football_matches?on_conflict=provider,provider_id", serviceKey, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
  }
  return rows;
}

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const parts = date.split("-").map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days)).toISOString().slice(0, 10);
}

function normalizeTeamKey(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!serviceKey) {
    return json({ error: "Football sync is not configured. Supabase service credentials are missing." }, 503);
  }
  if (!bearerToken) return json({ error: "Unauthorized" }, 401);

  try {
    const authResponse = await restRequest("rpc/verify_sportscore_sync_secret", serviceKey, {
      method: "POST",
      body: JSON.stringify({ p_token: bearerToken }),
    });
    if ((await authResponse.json()) !== true) return json({ error: "Unauthorized" }, 401);

    const now = new Date();
    const updatedAt = now.toISOString();
    const today = utcDate(now);
    let dailyFixturesUpdated = 0;
    let discoveryRequests = 0;

    for (let offset = 0; offset <= DISCOVERY_DAYS; offset += 1) {
      const date = addDays(today, offset);
      const stateKey = "sportscore_fixtures_" + date;
      const stateResponse = await restRequest(
        "football_sync_state?key=eq." + encodeURIComponent(stateKey) + "&select=last_synced_at",
        serviceKey,
      );
      const stateRows = await stateResponse.json();
      const lastSyncedAt = stateRows?.[0]?.last_synced_at
        ? new Date(stateRows[0].last_synced_at).getTime()
        : 0;
      if (lastSyncedAt && now.getTime() - lastSyncedAt < DISCOVERY_INTERVAL_MS) continue;

      const fixtures = await fetchFixtures(date);
      const rows = await upsertMatches(fixtures, serviceKey, updatedAt);
      dailyFixturesUpdated += rows.length;
      discoveryRequests += 1;
      await restRequest("football_sync_state?on_conflict=key", serviceKey, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ key: stateKey, last_synced_at: updatedAt }),
      });
    }

    const windowStart = new Date(now.getTime() - WINDOW_BEFORE_MS).toISOString();
    const windowEnd = new Date(now.getTime() + WINDOW_AFTER_MS).toISOString();
    const windowQuery = new URLSearchParams({
      provider: "eq.sportscore",
      status: "in.(SCHEDULED,LIVE,HT)",
      and: "(kickoff_at.gte." + windowStart + ",kickoff_at.lte." + windowEnd + ")",
      select: "provider_id,kickoff_at",
      limit: "100",
    });
    const windowResponse = await restRequest("football_matches?" + windowQuery.toString(), serviceKey);
    const windowMatches = await windowResponse.json();
    if (!windowMatches?.length) {
      return json({
        ok: true, provider: PROVIDER, updated: 0, dailyFixturesUpdated,
        discoveryRequests, autoPosts: 0, skipped: "outside_match_window", updatedAt,
      });
    }

    const matchDates = [...new Set(windowMatches.map((match: { kickoff_at: string }) =>
      utcDate(new Date(match.kickoff_at))
    ))];
    const liveRows: SportScoreMatchRow[] = [];
    for (const date of matchDates) {
      const fixtures = await fetchFixtures(date);
      liveRows.push(...await upsertMatches(fixtures, serviceKey, updatedAt));
    }

    const activeRows = liveRows.filter((match) => ["LIVE", "HT", "FT"].includes(match.status));
    let autoPosts = 0;
    if (activeRows.length) {
      const syncResponse = await restRequest(
        "football_club_team_sync?enabled=eq.true&select=club_id,created_by,team_name,team_provider_id",
        serviceKey,
      );
      const syncRows = await syncResponse.json() as SyncConnection[];
      for (const match of activeRows) {
        const homeKey = normalizeTeamKey(match.home_team);
        const awayKey = normalizeTeamKey(match.away_team);
        const signature = (match.home_score ?? "-") + ":" + (match.away_score ?? "-") + ":" + match.status;
        for (const sync of syncRows) {
          const teamKey = normalizeTeamKey(sync.team_name || sync.team_provider_id);
          if (teamKey !== homeKey && teamKey !== awayKey) continue;
          const score = (match.home_score ?? "–") + " - " + (match.away_score ?? "–");
          const status = match.status === "LIVE" && match.elapsed_minute !== null
            ? "LIVE " + match.elapsed_minute + "′"
            : match.status;
          const message = "⚽ " + match.competition_name + "\n" + match.home_team + " " + score +
            " " + match.away_team + "\n" + status + "\nAutomatic update from Nexora Arena · SportScore";
          const result = await restRequest("rpc/share_football_match_update", serviceKey, {
            method: "POST",
            body: JSON.stringify({
              p_club_id: sync.club_id,
              p_provider: PROVIDER,
              p_provider_id: match.provider_id,
              p_team_provider_id: sync.team_provider_id,
              p_score_signature: signature,
              p_sender_id: sync.created_by,
              p_message: message,
            }),
          });
          if (await result.json()) autoPosts += 1;
        }
      }
    }

    return json({
      ok: true, provider: PROVIDER, updated: liveRows.length, dailyFixturesUpdated,
      discoveryRequests, autoPosts, updatedAt,
    });
  } catch (error) {
    console.error("SportScore football sync failed", error);
    return json({ error: "SportScore sync failed; cached scores were left unchanged." }, 500);
  }
});
