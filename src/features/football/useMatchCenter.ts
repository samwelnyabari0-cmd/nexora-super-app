import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { normalizeTeamKey } from "./format";
import { fetchSportScoreMatches } from "./sportscore";
import { detectGoalAlerts, type GoalScoreSnapshot } from "./goal-alerts";
import { toast } from "sonner";
import { buildMatchShareMessage, hasActiveClubMembership } from "./club-sharing";
import type { FootballAnnouncement, FootballHighlight, FootballMatch } from "./types";

export type FavoriteFootballTeam = {
  id: string;
  team_name: string;
  team_provider_id: string;
  provider: string;
};
export type ClubTeamSync = {
  id: string;
  club_id: string;
  team_name: string;
  team_provider_id: string;
  enabled: boolean;
};

type MatchRow = {
  id: string;
  provider: string;
  provider_id: string;
  competition_code: string;
  competition_name: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: FootballMatch["status"];
  elapsed_minute: number | null;
  kickoff_at: string;
  updated_at: string;
  source_url: string | null;
};
type AnnouncementRow = {
  id: string;
  provider_id: string;
  source_name: string;
  headline: string;
  summary: string;
  source_url: string;
  published_at: string;
};
type HighlightRow = {
  id: string;
  provider_id: string;
  competition_code: string | null;
  match_label: string;
  score_label: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  video_url: string;
  source_name: string;
  published_at: string;
};
type MembershipRow = { id: string; user_id: string; status: string };
type QueryResult<T> = { data: T[] | null; error: { message: string } | null };
type MutationResult = { error: { message: string } | null };
type SingleResult<T> = { data: T | null; error: { message: string } | null };
type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  select: (columns: string) => QueryBuilder<T>;
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  gte: (column: string, value: unknown) => QueryBuilder<T>;
  lte: (column: string, value: unknown) => QueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
  maybeSingle: () => Promise<SingleResult<T>>;
  upsert: (
    values: Record<string, unknown>,
    options?: { onConflict?: string },
  ) => Promise<MutationResult>;
  insert: (values: Record<string, unknown>) => Promise<MutationResult>;
  update: (values: Record<string, unknown>) => QueryBuilder<T>;
  delete: () => QueryBuilder<T>;
};

function table<T>(name: string): QueryBuilder<T> {
  return supabase.from(name as never) as unknown as QueryBuilder<T>;
}

function toMatch(row: MatchRow): FootballMatch {
  return {
    id: row.id,
    provider: row.provider,
    providerId: row.provider_id,
    competitionCode: row.competition_code,
    competitionName: row.competition_name,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    elapsedMinute: row.elapsed_minute,
    kickoffAt: row.kickoff_at,
    updatedAt: row.updated_at,
    sourceUrl: row.source_url,
  };
}

function toAnnouncement(row: AnnouncementRow): FootballAnnouncement {
  return {
    id: row.id,
    providerId: row.provider_id,
    sourceName: row.source_name,
    headline: row.headline,
    summary: row.summary,
    sourceUrl: row.source_url,
    publishedAt: row.published_at,
  };
}

function toHighlight(row: HighlightRow): FootballHighlight {
  return {
    id: row.id,
    providerId: row.provider_id,
    competitionCode: row.competition_code,
    matchLabel: row.match_label,
    scoreLabel: row.score_label,
    durationSeconds: row.duration_seconds,
    thumbnailUrl: row.thumbnail_url,
    videoUrl: row.video_url,
    sourceName: row.source_name,
    publishedAt: row.published_at,
  };
}

export function useMatchCenter() {
  const { user, ready } = useSession();
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [announcements, setAnnouncements] = useState<FootballAnnouncement[]>([]);
  const [highlights, setHighlights] = useState<FootballHighlight[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFootballTeam[]>([]);
  const [clubSyncs, setClubSyncs] = useState<ClubTeamSync[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [goalAlertsEnabled, setGoalAlertsEnabledState] = useState(false);
  const previousGoalScores = useRef<Map<string, GoalScoreSnapshot>>(new Map());
  const seenGoalAlerts = useRef<Set<string>>(new Set());

  useEffect(() => {
    setGoalAlertsEnabledState(window.localStorage.getItem("nexora:arena-goal-alerts") === "true");
  }, []);

  const setGoalAlertsEnabled = useCallback((enabled: boolean) => {
    window.localStorage.setItem("nexora:arena-goal-alerts", enabled ? "true" : "false");
    if (enabled) {
      previousGoalScores.current = new Map(
        matches
          .filter((match) => match.provider === "sportscore" && match.homeScore !== null && match.awayScore !== null)
          .map((match) => [
            match.id,
            { homeScore: match.homeScore as number, awayScore: match.awayScore as number },
          ]),
      );
    }
    setGoalAlertsEnabledState(enabled);
  }, [matches]);

  const refresh = useCallback(async () => {
    const favoriteQuery = user
      ? table<FavoriteFootballTeam>("football_favorite_teams")
          .select("id,team_name,team_provider_id,provider")
          .eq("user_id", user.id)
          .order("team_name")
      : Promise.resolve({ data: [] as FavoriteFootballTeam[], error: null });
    const syncQuery = user
      ? table<ClubTeamSync>("football_club_team_sync")
          .select("id,club_id,team_name,team_provider_id,enabled")
          .eq("created_by", user.id)
      : Promise.resolve({ data: [] as ClubTeamSync[], error: null });
    const sportScorePromise = fetchSportScoreMatches()
      .then((matches) => ({ matches, error: null as string | null }))
      .catch((providerError: unknown) => ({
        matches: [] as FootballMatch[],
        error: providerError instanceof Error
          ? providerError.message
          : "SportScore live scores are temporarily unavailable.",
      }));
    const [matchResult, announcementResult, highlightResult, favoriteResult, syncResult, sportScoreResult] =
      await Promise.all([
        table<MatchRow>("football_matches")
          .select("*")
          .eq("is_published", true)
          .gte("kickoff_at", new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString())
          .lte("kickoff_at", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
          .order("kickoff_at", { ascending: true })
          .limit(100),
        table<AnnouncementRow>("football_announcements")
          .select("*")
          .eq("is_published", true)
          .eq("provider", "sky-sports-rss")
          .order("published_at", { ascending: false })
          .limit(8),
        table<HighlightRow>("football_highlights")
          .select("*")
          .eq("is_published", true)
          .order("published_at", { ascending: false })
          .limit(8),
        favoriteQuery,
        syncQuery,
        sportScorePromise,
      ]);

    const firstError =
      matchResult.error ??
      announcementResult.error ??
      highlightResult.error ??
      favoriteResult.error ??
      syncResult.error;
    const mergedMatches = new Map<string, FootballMatch>();
    const cacheMatches = (matchResult.data ?? []).map(toMatch);
    const fixtureKey = (match: FootballMatch) =>
      normalizeTeamKey(match.homeTeam) + "|" +
      normalizeTeamKey(match.awayTeam) + "|" +
      match.kickoffAt.slice(0, 10);
    for (const match of cacheMatches) mergedMatches.set(fixtureKey(match), match);
    for (const match of sportScoreResult.matches) mergedMatches.set(fixtureKey(match), match);

    const visibleMatches = [...mergedMatches.values()].sort(
      (left, right) => left.kickoffAt.localeCompare(right.kickoffAt),
    );
    const goalDetection = detectGoalAlerts(
      previousGoalScores.current,
      visibleMatches.filter((match) => match.provider === "sportscore"),
      seenGoalAlerts.current,
    );
    previousGoalScores.current = goalDetection.snapshots;
    seenGoalAlerts.current = goalDetection.seen;
    if (goalAlertsEnabled) {
      for (const alert of goalDetection.alerts) {
        const minute = alert.minute === null ? "" : ` · ${alert.minute}'`;
        toast.success(`GOAL! ${alert.scoringTeam}`, {
          description: `${alert.homeTeam} ${alert.score} ${alert.awayTeam} · ${alert.competitionName}${minute}`,
        });
      }
    }
    setMatches(visibleMatches);
    setAnnouncements((announcementResult.data ?? []).map(toAnnouncement));
    setHighlights((highlightResult.data ?? []).map(toHighlight));
    setFavorites(favoriteResult.data ?? []);
    setClubSyncs(syncResult.data ?? []);

    if (firstError) {
      setError("Some cached football updates could not load. Live scores may still be available.");
    } else if (sportScoreResult.error) {
      setError("SportScore is temporarily unavailable. Showing cached scores where available.");
    } else {
      setError(null);
    }

    const timestamps = visibleMatches.map((match) => match.updatedAt).filter(Boolean);
    setLastUpdated(timestamps.sort().at(-1) ?? null);
    setLoading(false);
  }, [goalAlertsEnabled, user]);

  useEffect(() => {
    if (!ready) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    refreshWhenVisible();
    const timer = window.setInterval(refreshWhenVisible, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [ready, refresh]);

  const addFavorite = useCallback(
    async (teamName: string) => {
      if (!user) return { error: "Sign in to follow teams." };
      const cleanName = teamName.trim();
      const teamKey = normalizeTeamKey(cleanName);
      if (cleanName.length < 2 || !teamKey) return { error: "Enter a valid team name." };
      const { error: insertError } = await table<FavoriteFootballTeam>(
        "football_favorite_teams",
      ).upsert(
        {
          user_id: user.id,
          provider: "name",
          team_provider_id: teamKey,
          team_name: cleanName,
        },
        { onConflict: "user_id,provider,team_provider_id" },
      );
      if (insertError) return { error: insertError.message };
      await refresh();
      return { error: null };
    },
    [refresh, user],
  );

  const removeFavorite = useCallback(
    async (favoriteId: string) => {
      if (!user) return { error: "Sign in to manage favorite teams." };
      const { error: deleteError } = await table<FavoriteFootballTeam>("football_favorite_teams")
        .delete()
        .eq("id", favoriteId)
        .eq("user_id", user.id);
      if (deleteError) return { error: deleteError.message };
      await refresh();
      return { error: null };
    },
    [refresh, user],
  );

  const connectTeamToClub = useCallback(
    async (team: FavoriteFootballTeam, clubId: string) => {
      if (!user) return { error: "Sign in to connect a team to a club." };
      if (!clubId) return { error: "Choose a club first." };
      const { error: saveError } = await table<ClubTeamSync>("football_club_team_sync").upsert(
        {
          club_id: clubId,
          created_by: user.id,
          provider: team.provider,
          team_provider_id: team.team_provider_id,
          team_name: team.team_name,
          enabled: true,
        },
        { onConflict: "club_id,provider,team_provider_id" },
      );
      if (saveError) return { error: saveError.message };
      await refresh();
      return { error: null };
    },
    [refresh, user],
  );

  const disconnectTeamFromClub = useCallback(
    async (teamProviderId: string, clubId: string) => {
      if (!user) return { error: "Sign in to manage club team updates." };
      if (!teamProviderId || !clubId) return { error: "Choose a team and club first." };
      const { error: updateError } = await table<ClubTeamSync>("football_club_team_sync")
        .update({ enabled: false })
        .eq("team_provider_id", teamProviderId)
        .eq("club_id", clubId)
        .eq("created_by", user.id);
      if (updateError) return { error: updateError.message };
      await refresh();
      return { error: null };
    },
    [refresh, user],
  );

  const shareMatchToClub = useCallback(
    async (match: FootballMatch, clubId: string) => {
      if (!user) return { error: "Sign in to discuss this match." };
      if (!clubId) return { error: "Choose a club first." };
      const { data: membership, error: membershipError } = await table<MembershipRow>(
        "club_memberships",
      )
        .select("id,user_id,status")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (membershipError || !hasActiveClubMembership(membership, user.id))
        return { error: "Join that club before sharing a match." };
      const body = buildMatchShareMessage(match);
      const senderName = String(
        user.user_metadata?.display_name ??
          user.user_metadata?.full_name ??
          user.email?.split("@")[0] ??
          "Nexora member",
      );
      const { error: insertError } = await table<Record<string, unknown>>("club_messages").insert({
        club_id: clubId,
        sender_id: user.id,
        sender_name: senderName,
        body,
        is_announcement: false,
      });
      if (insertError) return { error: insertError.message };
      return { error: null };
    },
    [user],
  );

  return {
    matches,
    announcements,
    highlights,
    favorites,
    clubSyncs,
    loading,
    error,
    lastUpdated,
    goalAlertsEnabled,
    setGoalAlertsEnabled,
    refresh,
    addFavorite,
    removeFavorite,
    connectTeamToClub,
    disconnectTeamFromClub,
    shareMatchToClub,
    authenticated: Boolean(user),
  };
}
