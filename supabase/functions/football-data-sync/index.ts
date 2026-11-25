type ProviderStatus = "SCHEDULED" | "LIVE" | "HT" | "FT" | "POSTPONED" | "CANCELLED" | "ABANDONED";

type Competition = { code: string; name: string };
type FootballDataMatch = {
  id?: number | string;
  utcDate?: string;
  status?: string;
  minute?: number | null;
  competition?: { code?: string; name?: string };
  homeTeam?: { id?: number | string; name?: string };
  awayTeam?: { id?: number | string; name?: string };
  score?: { fullTime?: { home?: number | null; away?: number | null }; regularTime?: { home?: number | null; away?: number | null } };
};
type FootballDataStandingRow = {
  position?: number;
  team?: { id?: number | string; name?: string; shortName?: string; crest?: string };
  playedGames?: number;
  won?: number;
  draw?: number;
  lost?: number;
  points?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
};
type FootballDataScorers = {
  competition?: { code?: string; name?: string };
  season?: { id?: number | string };
  scorers?: Array<{ player?: { id?: number | string; name?: string }; team?: { id?: number | string; name?: string }; goals?: number | null; assists?: number | null; penalties?: number | null }>;
};

function normalizeScorers(payload: FootballDataScorers, competition: Competition, updatedAt: string) {
  if (!payload.season?.id) return [];
  return (payload.scorers ?? []).flatMap((scorer) => {
    const player = scorer.player; const team = scorer.team;
    if (!player?.name || !team?.name) return [];
    return [{ provider: PROVIDER, competition_code: payload.competition?.code ?? competition.code, competition_name: payload.competition?.name ?? competition.name, season_id: String(payload.season.id), player_provider_id: player.id === undefined ? null : String(player.id), player_name: player.name, team_provider_id: team.id === undefined ? null : String(team.id), team_name: team.name, goals: scorer.goals ?? 0, assists: scorer.assists ?? 0, penalties: scorer.penalties ?? 0, updated_at: updatedAt }];
  });
}

type FootballDataStandings = {
  competition?: { code?: string; name?: string };
  season?: { id?: number | string; startDate?: string; endDate?: string; currentMatchday?: number | null };
  standings?: Array<{ type?: string; group?: string | null; table?: FootballDataStandingRow[] }>;
};

const COMPETITIONS: Competition[] = [
  { code: "PL", name: "Premier League" },
  { code: "CL", name: "UEFA Champions League" },
  { code: "PD", name: "La Liga" },
  { code: "BL1", name: "Bundesliga" },
  { code: "SA", name: "Serie A" },
  { code: "FL1", name: "Ligue 1" },
];
const PROVIDER = "football-data";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function dateInNairobi(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function statusFromProvider(value?: string): ProviderStatus {
  switch (value) {
    case "IN_PLAY":
    case "LIVE":
    case "SUSPENDED":
      return "LIVE";
    case "PAUSED":
      return "HT";
    case "FINISHED":
    case "AWARDED":
      return "FT";
    case "POSTPONED":
      return "POSTPONED";
    case "CANCELLED":
      return "CANCELLED";
    case "SCHEDULED":
    case "TIMED":
    default:
      return "SCHEDULED";
  }
}

function normalizeMatch(value: FootballDataMatch, updatedAt: string) {
  const id = value.id;
  const kickoff = value.utcDate;
  const home = value.homeTeam?.name;
  const away = value.awayTeam?.name;
  const competitionCode = value.competition?.code;
  const competitionName = value.competition?.name;
  if (id === undefined || !kickoff || !home || !away || !competitionCode || !competitionName) return null;
  const kickoffAt = new Date(kickoff);
  if (!Number.isFinite(kickoffAt.getTime())) return null;
  const fullTime = value.score?.fullTime ?? value.score?.regularTime;
  const status = statusFromProvider(value.status);
  return {
    provider: PROVIDER,
    provider_id: String(id),
    competition_code: competitionCode,
    competition_name: competitionName,
    home_team: home,
    away_team: away,
    home_team_provider_id: value.homeTeam?.id === undefined ? null : String(value.homeTeam.id),
    away_team_provider_id: value.awayTeam?.id === undefined ? null : String(value.awayTeam.id),
    home_score: fullTime?.home ?? null,
    away_score: fullTime?.away ?? null,
    status,
    elapsed_minute: typeof value.minute === "number" ? value.minute : null,
    kickoff_at: kickoffAt.toISOString(),
    source_url: null,
    is_published: true,
    updated_at: updatedAt,
  };
}

function normalizeStandings(payload: FootballDataStandings, competition: Competition, updatedAt: string) {
  const season = payload.season;
  if (!season?.id) return [];
  const competitionCode = payload.competition?.code ?? competition.code;
  const competitionName = payload.competition?.name ?? competition.name;
  const rows: Record<string, unknown>[] = [];
  for (const standing of payload.standings ?? []) {
    for (const row of standing.table ?? []) {
      const team = row.team;
      if (!row.position || team?.id === undefined || !team.name) continue;
      rows.push({
        provider: PROVIDER,
        competition_code: competitionCode,
        competition_name: competitionName,
        season_id: String(season.id),
        season_start: season.startDate ?? null,
        season_end: season.endDate ?? null,
        current_matchday: season.currentMatchday ?? null,
        standing_type: standing.type ?? "TOTAL",
        group_name: standing.group ?? "",
        position: row.position,
        team_provider_id: String(team.id),
        team_name: team.name,
        team_short_name: team.shortName ?? null,
        team_crest_url: team.crest ?? null,
        played_games: row.playedGames ?? 0,
        won: row.won ?? 0,
        drawn: row.draw ?? 0,
        lost: row.lost ?? 0,
        points: row.points ?? 0,
        goals_for: row.goalsFor ?? 0,
        goals_against: row.goalsAgainst ?? 0,
        goal_difference: row.goalDifference ?? 0,
        updated_at: updatedAt,
      });
    }
  }
  return rows;
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

let lastProviderRequestAt = 0;
const PROVIDER_REQUEST_INTERVAL_MS = 6_100;

async function providerRequest(path: string, token: string) {
  const waitMs = Math.max(0, PROVIDER_REQUEST_INTERVAL_MS - (Date.now() - lastProviderRequestAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));

  const response = await fetch(`https://api.football-data.org/v4/${path}`, {
    headers: { "X-Auth-Token": token, accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  lastProviderRequestAt = Date.now();

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Football-data provider returned ${response.status}: ${detail}`);
  }
  return await response.json();
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const syncSecret = Deno.env.get("ARENA_FOOTBALL_SYNC_SECRET");
  const apiToken = Deno.env.get("FOOTBALL_DATA_API_TOKEN");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!syncSecret || !apiToken || !serviceKey) {
    return json({ error: "Arena football data sync is not configured. Add the required server-side secrets." }, 503);
  }
  if (request.headers.get("authorization") !== `Bearer ${syncSecret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const now = new Date();
    const updatedAt = now.toISOString();
    const today = dateInNairobi(now);
    const dateFrom = shiftDate(today, -14);
    const dateTo = shiftDate(today, 45);
    const codes = COMPETITIONS.map((competition) => competition.code).join(",");
    const matches: FootballDataMatch[] = [];
    let windowStart = dateFrom;

    // The provider limits match date-range queries. Fetch the requested 59-day
    // window in non-overlapping chunks of at most 10 days (dateTo is exclusive).
    while (windowStart < dateTo) {
      const windowEnd = [shiftDate(windowStart, 10), dateTo].sort()[0];
      const matchParams = new URLSearchParams({
        dateFrom: windowStart,
        dateTo: windowEnd,
        competitions: codes,
      });
      const matchPayload = await providerRequest(`matches?${matchParams.toString()}`, apiToken);
      if (Array.isArray(matchPayload?.matches)) {
        matches.push(...matchPayload.matches as FootballDataMatch[]);
      }
      windowStart = windowEnd;
    }

    const matchRows = matches
      .map((match) => normalizeMatch(match, updatedAt))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (matchRows.length) {
      await restRequest("football_matches?on_conflict=provider,provider_id", serviceKey, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(matchRows),
      });
    }

    let standingsUpdated = 0;
    for (let index = 0; index < COMPETITIONS.length; index += 1) {
      const competition = COMPETITIONS[index];
      const payload = await providerRequest(`competitions/${competition.code}/standings`, apiToken) as FootballDataStandings;
      const rows = normalizeStandings(payload, competition, updatedAt);
      if (!rows.length) continue;
      await restRequest(
        "football_standings?on_conflict=provider,competition_code,season_id,standing_type,group_name,position",
        serviceKey,
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows),
        },
      );
      standingsUpdated += rows.length;
    }

    // Refresh scorer endpoints at most once per Nairobi calendar day per competition.
    let scorerRowsUpdated = 0;
    let scorerCompetitionsRefreshed = 0;
    for (const competition of COMPETITIONS) {
      const cached = await restRequest("football_scorers?select=updated_at&competition_code=eq." + encodeURIComponent(competition.code) + "&order=updated_at.desc&limit=1", serviceKey);
      const cachedRows = await cached.json() as Array<{ updated_at: string }>;
      if (cachedRows[0]?.updated_at && dateInNairobi(new Date(cachedRows[0].updated_at)) === today) continue;
      try {
        const payload = await providerRequest("competitions/" + competition.code + "/scorers", apiToken) as FootballDataScorers;
        const rows = normalizeScorers(payload, competition, updatedAt);
        if (!rows.length) continue;
        const seasonId = rows[0].season_id;
        await restRequest("football_scorers?provider=eq." + PROVIDER + "&competition_code=eq." + encodeURIComponent(competition.code) + "&season_id=neq." + encodeURIComponent(seasonId), serviceKey, { method: "DELETE", headers: { Prefer: "return=minimal" } });
        await restRequest("football_scorers?on_conflict=provider,competition_code,season_id,player_name,team_name", serviceKey, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
        scorerRowsUpdated += rows.length;
        scorerCompetitionsRefreshed += 1;
      } catch (scorerError) {
        // Scorer access can be restricted by provider plan; do not fail the core fixture sync.
        console.warn("Golden Boot refresh skipped for " + competition.code, scorerError);
      }
    }
    return json({ ok: true, provider: PROVIDER, fixturesAndResultsUpdated: matchRows.length, standingsRowsUpdated: standingsUpdated, scorerRowsUpdated, scorerCompetitionsRefreshed, competitions: COMPETITIONS.map((competition) => competition.code), updatedAt });
  } catch (error) {
    console.error("Arena football data sync failed", error);
    return json({ error: "Arena football data sync failed; previously cached data was left unchanged." }, 500);
  }
});
