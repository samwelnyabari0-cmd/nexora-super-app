type ProviderStatus = "SCHEDULED" | "LIVE" | "HT" | "FT" | "POSTPONED" | "CANCELLED" | "ABANDONED";
type ApiFootballMatchRow = {
  provider: "api-football";
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
type ApiFootballFixture = {
  fixture?: {
    id?: number | string;
    date?: string;
    status?: { short?: string; elapsed?: number | null };
  };
  league?: { id?: number | string; name?: string; country?: string };
  teams?: {
    home?: { id?: number | string; name?: string };
    away?: { id?: number | string; name?: string };
  };
  goals?: { home?: number | null; away?: number | null };
};

function statusFromProvider(value?: string): ProviderStatus {
  if (["1H", "2H", "ET", "BT", "P", "LIVE", "SUSP", "INT"].includes(value ?? "")) return "LIVE";
  if (value === "HT") return "HT";
  if (["FT", "AET", "PEN"].includes(value ?? "")) return "FT";
  if (value === "PST") return "POSTPONED";
  if (value === "CANC") return "CANCELLED";
  if (["ABD", "AWD", "WO"].includes(value ?? "")) return "ABANDONED";
  return "SCHEDULED";
}

function competitionCode(name: string, fallbackId: string, country = ""): string {
  const normalized = name.toLocaleLowerCase();
  if (
    normalized.includes("fkf") ||
    normalized.includes("kenyan premier league") ||
    country.toLocaleLowerCase() === "kenya"
  )
    return "FKF";
  if (normalized.includes("premier league") && !normalized.includes("kenya")) return "EPL";
  if (normalized.includes("champions league")) return "UCL";
  if (normalized.includes("la liga") || normalized.includes("laliga")) return "LALIGA";
  return fallbackId;
}

function normalizeApiFootballFixture(
  value: unknown,
  updatedAt: string,
): ApiFootballMatchRow | null {
  const fixture = value as ApiFootballFixture;
  const id = fixture?.fixture?.id;
  const kickoffAt = fixture?.fixture?.date;
  const homeTeam = fixture?.teams?.home?.name;
  const awayTeam = fixture?.teams?.away?.name;
  const leagueName = fixture?.league?.name;
  if (id === undefined || !kickoffAt || !homeTeam || !awayTeam || !leagueName) return null;
  const kickoffTime = new Date(kickoffAt);
  if (!Number.isFinite(kickoffTime.getTime())) return null;
  const elapsed = fixture.fixture?.status?.elapsed;
  const leagueId = fixture.league?.id;
  return {
    provider: PROVIDER,
    provider_id: String(id),
    competition_code: competitionCode(
      leagueName,
      leagueId === undefined ? "OTHER" : String(leagueId),
      fixture.league?.country,
    ),
    competition_name: leagueName,
    home_team: homeTeam,
    away_team: awayTeam,
    home_team_provider_id:
      fixture.teams?.home?.id === undefined ? null : String(fixture.teams.home.id),
    away_team_provider_id:
      fixture.teams?.away?.id === undefined ? null : String(fixture.teams.away.id),
    home_score: fixture.goals?.home ?? null,
    away_score: fixture.goals?.away ?? null,
    status: statusFromProvider(fixture.fixture?.status?.short),
    elapsed_minute: typeof elapsed === "number" ? elapsed : null,
    kickoff_at: kickoffTime.toISOString(),
    source_url: null,
    is_published: true,
    updated_at: updatedAt,
  };
}

const PROVIDER = "api-football";
const MATCH_WINDOW_BEFORE_MS = 3 * 60 * 60 * 1000;
const MATCH_WINDOW_AFTER_MS = 2 * 60 * 60 * 1000;
const DAILY_FIXTURE_REFRESH_MS = 6 * 60 * 60 * 1000;

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

function normalizeTeamKey(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function nairobiDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

async function restRequest(path: string, serviceKey: string, init: RequestInit = {}) {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!baseUrl) throw new Error("SUPABASE_URL is missing");
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase cache request failed (${response.status})`);
  return response;
}

async function fetchFixtures(url: string, apiKey: string) {
  const response = await fetch(url, {
    headers: { "x-apisports-key": apiKey, accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Football provider returned ${response.status}`);
  const payload = await response.json();
  const providerErrors = payload?.errors;
  if (
    providerErrors &&
    (Array.isArray(providerErrors)
      ? providerErrors.length > 0
      : Object.keys(providerErrors).length > 0)
  ) {
    throw new Error("Football provider rejected the sync request");
  }
  return Array.isArray(payload?.response) ? payload.response : [];
}

async function upsertMatches(fixtures: unknown[], serviceKey: string, updatedAt: string) {
  const rows = fixtures
    .map((fixture) => normalizeApiFootballFixture(fixture, updatedAt))
    .filter((row): row is ApiFootballMatchRow => row !== null);
  if (rows.length) {
    await restRequest("football_matches?on_conflict=provider,provider_id", serviceKey, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
  }
  return rows;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const syncSecret = Deno.env.get("FOOTBALL_SYNC_SECRET");
  const apiKey = Deno.env.get("API_FOOTBALL_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!syncSecret || !apiKey || !serviceKey) {
    return json(
      {
        error:
          "Football sync is not configured. Add server-side football and Supabase secrets first.",
      },
      503,
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${syncSecret}`)
    return json({ error: "Unauthorized" }, 401);

  try {
    const now = new Date();
    const updatedAt = now.toISOString();
    const today = nairobiDate(now);
    const endDate = addDays(today, 7);
    const stateResponse = await restRequest(
      "football_sync_state?key=eq.daily_fixtures&select=last_synced_at",
      serviceKey,
    );
    const stateRows = await stateResponse.json();
    const lastDailySync = stateRows?.[0]?.last_synced_at
      ? new Date(stateRows[0].last_synced_at).getTime()
      : 0;
    let dailyFixturesUpdated = 0;

    if (!lastDailySync || now.getTime() - lastDailySync >= DAILY_FIXTURE_REFRESH_MS) {
      const fixtureUrl = `https://v3.football.api-sports.io/fixtures?from=${today}&to=${endDate}&timezone=Africa/Nairobi`;
      const fixtures = await fetchFixtures(fixtureUrl, apiKey);
      const rows = await upsertMatches(fixtures, serviceKey, updatedAt);
      dailyFixturesUpdated = rows.length;
      await restRequest("football_sync_state?on_conflict=key", serviceKey, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ key: "daily_fixtures", last_synced_at: updatedAt }),
      });
    }

    const windowStart = new Date(now.getTime() - MATCH_WINDOW_BEFORE_MS).toISOString();
    const windowEnd = new Date(now.getTime() + MATCH_WINDOW_AFTER_MS).toISOString();
    const windowQuery = new URLSearchParams({
      status: "in.(SCHEDULED,LIVE,HT)",
      provider: "eq.api-football",
      competition_code: "in.(EPL,UCL,LALIGA,FKF)",
      and: `(kickoff_at.gte.${windowStart},kickoff_at.lte.${windowEnd})`,
      select: "provider_id",
      limit: "20",
    });
    const windowResponse = await restRequest(
      `football_matches?${windowQuery.toString()}`,
      serviceKey,
    );
    const windowMatches = await windowResponse.json();
    if (!windowMatches?.length) {
      return json({
        ok: true,
        updated: 0,
        dailyFixturesUpdated,
        autoPosts: 0,
        skipped: "outside_match_window",
        updatedAt,
      });
    }

    const fixtureIds = windowMatches
      .map((match: { provider_id: string }) => match.provider_id)
      .join("-");
    const matchFixtures = await fetchFixtures(
      `https://v3.football.api-sports.io/fixtures?ids=${encodeURIComponent(fixtureIds)}&timezone=Africa/Nairobi`,
      apiKey,
    );
    const liveRows = await upsertMatches(matchFixtures, serviceKey, updatedAt);
    const activeRows = liveRows.filter((match) => ["LIVE", "HT", "FT"].includes(match.status));
    let autoPosts = 0;

    if (activeRows.length) {
      const syncResponse = await restRequest(
        "football_club_team_sync?enabled=eq.true&select=club_id,created_by,team_name,team_provider_id",
        serviceKey,
      );
      const syncRows = (await syncResponse.json()) as SyncConnection[];
      for (const match of activeRows) {
        const homeKey = normalizeTeamKey(match.home_team);
        const awayKey = normalizeTeamKey(match.away_team);
        const signature = `${match.home_score ?? "-"}:${match.away_score ?? "-"}:${match.status}`;
        for (const sync of syncRows) {
          const teamKey = normalizeTeamKey(sync.team_name || sync.team_provider_id);
          if (teamKey !== homeKey && teamKey !== awayKey) continue;
          const score = `${match.home_score ?? "–"} - ${match.away_score ?? "–"}`;
          const status =
            match.status === "LIVE" && match.elapsed_minute !== null
              ? `LIVE ${match.elapsed_minute}′`
              : match.status;
          const message = `⚽ ${match.competition_name}\n${match.home_team} ${score} ${match.away_team}\n${status}\nAutomatic update from Nexora Match Center`;
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

    return json({ ok: true, updated: liveRows.length, dailyFixturesUpdated, autoPosts, updatedAt });
  } catch (error) {
    console.error("Football sync failed", error);
    return json({ error: "Football sync failed; cached scores were left unchanged." }, 500);
  }
});
